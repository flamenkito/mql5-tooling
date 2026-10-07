"""Import declarations from HTML pages extracted from the official mql5.chm."""
import argparse
from collections import defaultdict
from datetime import date
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from declarations import declarations, without_comments

ROOT=Path(__file__).resolve().parents[1]
URL='https://www.mql5.com/files/docs/mql5.chm'

class Contents(HTMLParser):
    def __init__(self):super().__init__();self.depth=0;self.params={};self.stack=[];self.topics=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='ul':self.depth+=1
        elif tag=='object':self.params={}
        elif tag=='param':self.params[attrs.get('name','').lower()]=attrs.get('value','')
    def handle_endtag(self,tag):
        if tag=='ul':self.depth-=1
        if tag=='object' and self.params.get('local'):
            while self.stack and self.stack[-1][0]>=self.depth:self.stack.pop()
            self.stack.append((self.depth,self.params.get('name','')))
            self.topics.append({'title':self.params.get('name',''),'file':self.params['local'].split('#')[0],
                                'path':[name for _,name in self.stack]})

class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.paragraph=None;self.paragraphs=[];self.links=[];self.link=None;self.rows=[];self.row=[];self.cell=None;self.cell_links=[];self.enum_owner=None;self.enum_rows=[];self.enum_table=False;self.enum_summaries={};self.title="";self.breadcrumbs=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='table':self.enum_table=attrs.get('class')=='EnumTable'
        if tag in ('p','h1','h2','pre'):self.paragraph=[tag,attrs.get('class',''),[]]
        if tag=='br' and self.paragraph:self.paragraph[2].append('\n')
        if tag=='a':
            self.link=[attrs.get('href',''),[]]
            if attrs.get('class')=='h_m':self.breadcrumbs.append(attrs.get('href',''))
        if tag=='tr':self.row=[]
        if tag in ('td','th'):self.cell=[];self.cell_links=[]
    def handle_data(self,data):
        if self.paragraph:self.paragraph[2].append(data)
        if self.link:self.link[1].append(data)
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        if self.paragraph and tag==self.paragraph[0]:
            _,cls,parts=self.paragraph;text=''.join(parts).replace('\xa0',' ');self.paragraphs.append((cls,text));self.paragraph=None
            if cls=='p_H1' and not self.title:self.title=' '.join(text.split())
            if self.cell is None and not self.enum_table and re.fullmatch(r'ENUM_[A-Z_0-9]+',text.strip()):
                self.enum_owner=text.strip()
                self.enum_summaries[self.enum_owner]=self.summary()
        if tag=='a' and self.link:
            href,parts=self.link;item={'href':href,'text':' '.join(''.join(parts).split())};self.links.append(item);self.cell_links.append(item);self.link=None
        if tag in ('td','th') and self.cell is not None:
            self.row.append({'text':' '.join(''.join(self.cell).split()),'links':self.cell_links});self.cell=None;self.cell_links=[]
        if tag=='tr' and self.row:
            self.rows.append(self.row)
            if self.enum_table and self.enum_owner:self.enum_rows.append((self.enum_owner,self.row))
        if tag=='table':self.enum_table=False;self.enum_owner=None
    def summary(self):
        for cls,text in self.paragraphs:
            if cls=='p_CodeExample':break
            if (cls in ('p_Function','p_fortable') and text.strip() or cls=='p_Text' and len(text.strip())>45) and not re.fullmatch(r'ENUM_[A-Z_0-9]+',text.strip()):
                clean=' '.join(text.split())
                clean=re.sub(r'\s*These are the following.*$', '', clean)
                return clean if len(clean)<=800 else clean[:800].rsplit(' ',1)[0]+'…'
        return ''
    def function_docs(self):
        parameters={};returns=[];notes=[];section='';parameter=None
        for cls,text in self.paragraphs:
            text=' '.join(text.split())
            if re.match(r'^Example(?:\s|:|$)',text,re.I):break
            if cls=='p_BoldTitles':
                section=text
                if section=='See also':break
                continue
            if section=='Parameters':
                if cls=='p_FunctionParameter':parameter=text
                elif cls in ('p_ParameterDesrciption','p_ParameterDescription') and parameter:
                    parameters[parameter]=(parameters.get(parameter,'')+' '+text).strip()
            elif section=='Return Value' and cls in ('p_FunctionRemark','p_Text','p_Function'):returns.append(text)
            elif section=='Note' and cls in ('p_FunctionRemark','p_Text') and not notes:notes.append(text)
        return {'parameterDocs':parameters,'returns':' '.join(returns),'note':' '.join(notes)}
    def declaration_blocks(self):
        blocks=[]
        for cls,text in self.paragraphs:
            if text.strip() in ('Parameters','Return Value','Note') or re.match(r'^Example(?:\s|:|$)',text.strip(),re.I):break
            if cls=='p_CodeExample':blocks.append(text)
        return blocks

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html',type=Path,default=ROOT/'reference/chm')
    parser.add_argument('--chm',type=Path,default=ROOT/'reference/mql5.chm')
    args=parser.parse_args();toc=Contents();toc.feed((args.html/'MQL5.hhc').read_text(encoding='utf-8-sig'))
    pages={};functions=defaultdict(list);methods=defaultdict(list);library=defaultdict(list);unqualified_methods=defaultdict(list);structures={};enums=set();enum_docs={}
    old=json.loads((ROOT/'data/builtins.json').read_text());known_structures={name for name in old['types'] if name.startswith('Mql')}
    for item in toc.topics:
        file=args.html/item['file']
        if not file.exists():continue
        if item['file'] not in pages:
            p=Page()
            try:text=file.read_text(encoding='utf-8-sig')
            except UnicodeDecodeError:text=file.read_text(encoding='cp1252')
            p.feed(text);pages[item['file']]=p
        page=pages[item['file']];group=item['path'][1] if len(item['path'])>1 else ''
        blocks=page.declaration_blocks()
        if group=='Constants, Enumerations and Structures':
            for cls,text in page.paragraphs:
                if re.match(r'^Example(?:\s|:|$)',text.strip(),re.I):break
                enums.update(re.findall(r'\bENUM_[A-Z_0-9]+\b',text))
            for owner,row in page.enum_rows:
                if len(row)<2 or not re.fullmatch(r'[A-Z][A-Z_0-9]*',row[0]['text']) or row[0]['text']=='ID':continue
                doc=enum_docs.setdefault(owner,{'topic':item['file'],'title':page.title,'summary':page.enum_summaries.get(owner,''),'members':[]})
                member={'name':row[0]['text'],'description':row[-1]['text']}
                if not any(m['name']==member['name'] for m in doc['members']):doc['members'].append(member)
            for code in blocks:
                code=without_comments(code)
                for name in known_structures:
                    match=re.search(r'\bstruct\s+'+re.escape(name)+r'\s*\{(.*?)\};',code,flags=re.S)
                    if not match:continue
                    fields=[{'name':m[2],'type':m[1]}for m in re.finditer(r'\b([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*;',match[1])]
                    if fields and name not in structures:structures[name]={'name':name,'topic':item['file'],'fields':fields}
        title=item['title']
        if not re.fullmatch(r'[A-Za-z_]\w*',title) or group in {'Language Basics','Constants, Enumerations and Structures','MQL5 programs','Predefined Variables','Python Integration','Moving from MQL4'}:continue
        owner=next((name for name in reversed(item['path'][:-1]) if re.fullmatch(r'C[A-Z]\w*',name)),None) if group=='Standard Library' else None
        for block in blocks:
            corrected=None
            errata={'cryptdecode.htm':('CryptEncode','CryptDecode'), 'databasebindarray.htm':('DatabaseBind','DatabaseBindArray')}
            if item['file'] in errata:
                wrong,right=errata[item['file']]
                if re.search(r'\b'+wrong+r'\s*\(',block):
                    block=re.sub(r'\b'+wrong+r'(?=\s*\()',right,block)
                    corrected=f'Prototype name {wrong} corrected to topic/example name {right}'
            for record in declarations(block,title,owner):
                record.update({'topic':item['file'],'group':group})
                if corrected:record['erratum']=corrected
                # These three prototype details were checked against MetaEditor's diagnostic signatures.
                if title=='DatabaseBindArray' and len(record['parameters'])==3:
                    parameter=record['parameters'][2]
                    if parameter['type']=='T&':
                        parameter['type']='const T&';parameter['label']='const '+parameter['label']
                        record['erratum']=(record.get('erratum','')+'; const array qualifier verified with MetaEditor 2026-10-06').strip('; ')
                if title=='ObjectCreate' and len(record['parameters'])>=6:
                    parameter=record['parameters'][3]
                    if parameter['type']=='sub_window':parameter['type']='int';parameter['label']='int '+parameter['name']
                    record['parameters']=record['parameters'][:6]+[{'label':'...','name':'','type':'','optional':True,'variadic':True}]
                    record['erratum']='Integer subwindow type and variadic coordinates verified with MetaEditor 2026-10-06'
                record['summary']=page.summary()
                record.update(page.function_docs())
                for parameter in record['parameters']:
                    description=record['parameterDocs'].get(parameter['name'])
                    if description:parameter['documentation']=description
                record['label']=record['returnType']+' '+record['qualifiedName'].split('::')[-1]+'('+', '.join(p['label']for p in record['parameters'])+')'+(' const' if record['label'].endswith(' const') else '')
                key=record['qualifiedName'];bucket=methods if '::' in key else library if group=='Standard Library' else unqualified_methods if group=='Matrix and Vector Methods' else functions
                if not any(r['label']==record['label']for r in bucket[key]):bucket[key].append(record)
    # The official function index maps aliases such as acos to their MathArccos topic.
    index=Page();index.feed((args.html/'function_indices.htm').read_text(encoding='utf-8-sig'))
    by_topic=defaultdict(list)
    for records in functions.values():
        for record in records:by_topic[record['topic']].append(record)
    for row in index.rows:
        if len(row)<3 or row[2]['text']=='MetaTrader for Python':continue
        name=row[0]['text']
        if name in functions or not re.fullmatch(r'[A-Za-z_]\w*',name) or not row[0]['links']:continue
        target=row[0]['links'][0]['href'].split('#')[0]
        records=by_topic.get(target,[])
        if len({r['name']for r in records})!=1:continue
        for record in records:
            alias={**record,'name':name,'qualifiedName':name,'aliasOf':record['name'],
                   'label':record['label'].replace(record['name']+'(',name+'(',1)}
            functions[name].append(alias)
    assert len(functions)>450 and len(functions['ObjectSetInteger'])==2 and len(functions['SymbolInfoDouble'])==2
    assert len(functions['CopyRates'])==3 and len(structures)==12 and 'ENUM_BASE_CORNER' in enums
    reference={'source':{'url':URL,'sha256':hashlib.sha256(args.chm.read_bytes()).hexdigest(),'format':'CHM/HTML',
                         'topics':len(toc.topics),'htmlPages':len(pages),'checked':date.today().isoformat()},
               'functions':dict(sorted(functions.items())),'methods':dict(sorted(methods.items())),
               'topics':{file:'https://www.mql5.com/en/docs/'+ '/'.join([Path(part).stem for part in page.breadcrumbs if Path(part).stem!='mql5_guide']+[Path(file).stem]) for file,page in sorted(pages.items())},
               'structures':dict(sorted(structures.items())),'enums':sorted(enums),'enumDocs':dict(sorted(enum_docs.items())),'libraryFunctions':dict(sorted(library.items())),
               'unqualifiedMethods':dict(sorted(unqualified_methods.items()))}
    (ROOT/'data/reference.json').write_text(json.dumps(reference,indent=2)+'\n')
    old['types']=sorted(set(old['types'])|enums|set(structures));old['functions']=sorted(set(old['functions'])|set(functions))
    old['sources']=sorted((set(old['sources'])-{'https://www.mql5.com/files/docs/mql5.pdf'})|{URL});old['referenceSource']=reference['source']
    (ROOT/'data/builtins.json').write_text(json.dumps(old,indent=2)+'\n')
    report={'functions':len(functions),'overloads':sum(map(len,functions.values())),'methods':len(methods),'structures':len(structures),
            'enumTypes':len(enums),'functionDocs':sum(bool(records[0].get('summary')) for records in functions.values()),
            'functionsWithoutSummary':[name for name,records in functions.items() if not records[0].get('summary')],
            'missingCatalogSignatures':sorted(set(old['functions'])-set(functions))}
    (ROOT/'reference/chm-import-report.json').write_text(json.dumps(report,indent=2)+'\n');print(report)

if __name__=='__main__':main()
