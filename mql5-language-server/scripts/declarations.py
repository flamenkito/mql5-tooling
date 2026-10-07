"""Parse declaration-shaped code blocks, retaining API facts rather than prose."""
import re

IDENTIFIER=r'[A-Za-z_]\w*'

def without_comments(text):
    pattern=r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')|//[^\n]*|/\*.*?\*/'
    return re.sub(pattern,lambda m:m[1] or '',text,flags=re.S)

def parameters(text):
    # The help uses trailing commas and repeated ellipses in schematic prototypes.
    text=re.sub(r'\.\.\.(?:\s+\.\.\.)*', '...', text)
    text=re.sub(r',\s*$', '', text)
    text=re.sub(r'[ \t\r]+\n', '\n', text)
    # Each parameter is a separate HTML code line; schematic varargs sometimes omit commas.
    text=re.sub(r'(?<=[^,\n])\n\s*(?=(?:const\s+)?[A-Za-z_]\w*\s*[&*]?\s+[A-Za-z_]\w*|\.\.\.)', ',\n', text)
    parts=[];start=0;depth=0;quote=None;escaped=False
    for i,c in enumerate(text):
        if quote:
            if escaped:escaped=False
            elif c=='\\':escaped=True
            elif c==quote:quote=None
        elif c in '\"\'':quote=c
        elif c in '([<':depth+=1
        elif c in ')]>':depth=max(0,depth-1)
        elif c==',' and depth==0:parts.append(text[start:i]);start=i+1
    parts.append(text[start:])
    if len(parts)==1 and parts[0].strip() in ('','void'):return []
    result=[]
    for part in parts:
        label=re.sub(r'\s+',' ',part).strip()
        if label=='...':result.append({'label':label,'name':'','type':'','optional':True,'variadic':True});continue
        header=label.split('=',1)[0].strip()
        match=re.search(r'\b('+IDENTIFIER+r')\s*(?:\[[^\]]*\]\s*)*$',header)
        if not match:return None
        name=match[1];type_name=header[:match.start()].strip()
        if not type_name and not re.fullmatch(r'argument\d*',name):return None
        if type_name and not re.fullmatch(r'(?:const\s+)?[A-Za-z_]\w*(?:\s*<[^>]+>)?\s*[&*]?',type_name):return None
        result.append({'label':label,'name':name,'type':type_name,'optional':'=' in label})
    return result

def declarations(code, topic, owner=None):
    code=without_comments(code.replace('\xa0',' '))
    pattern=re.compile(r'^\s*((?:const\s+)?[A-Za-z_]\w*(?:\s*<[^>\n]+>)?\s*[&*]?)\s+'
                       r'((?:(?:[A-Za-z_]\w*)(?:\s*<[^>\n]+>)?::)*'+re.escape(topic)+r')\s*\(',re.M|re.I)
    result=[]
    for match in pattern.finditer(code):
        at=match.end();first=at;depth=1;quote=None;escaped=False
        while at<len(code) and depth:
            c=code[at]
            if quote:
                if escaped:escaped=False
                elif c=='\\':escaped=True
                elif c==quote:quote=None
            elif c in '\"\'':quote=c
            elif c=='(':depth+=1
            elif c==')':depth-=1
            at+=1
        if depth:continue
        params=parameters(code[first:at-1])
        if params is None:continue
        name=match[2].replace(' ','');ret=re.sub(r'\s+',' ',match[1]).strip()
        qualified=name if '::' in name else owner+'::'+name if owner else name
        label=f'{ret} {name}('+', '.join(p['label']for p in params)+')'
        if code[at:].lstrip().startswith('const'):label+=' const'
        result.append({'name':name.split('::')[-1],'qualifiedName':qualified,'label':label,'returnType':ret,'parameters':params})
    return result
