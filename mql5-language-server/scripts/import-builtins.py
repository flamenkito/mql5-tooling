"""Import API identifiers (not documentation prose) from saved official reference pages."""
import argparse
from datetime import date
from html.parser import HTMLParser
import json
from pathlib import Path
import re

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=='tr': self.row=[]
        if tag in ('td','th'): self.cell=[]
    def handle_data(self, data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split())); self.cell=None
        if tag=='tr' and self.row: self.rows.append(self.row)

def tables(file):
    parser=Tables(); parser.feed(file.read_text()); return parser.rows

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=Path, required=True)
    args=parser.parse_args(); root=Path(__file__).resolve().parents[1]
    functions=[]; events=[]; indicators=[]
    for row in tables(args.pages/'mql5-function-indices.html'):
        if len(row)<3 or row[0]=='Function' or row[2]=='MetaTrader for Python': continue
        if not re.fullmatch('[A-Za-z_][A-Za-z_0-9]*',row[0]): continue
        functions.append(row[0])
        if row[2]=='Event Handling': events.append(row[0])
        if row[2] in ('Technical Indicators','Custom Indicators'): indicators.append(row[0])
    constants=[]
    for row in tables(args.pages/'mql5-constant-indices.html'):
        if len(row)<3 or row[0]=='Constant': continue
        constants.extend(re.findall(r'\b[A-Za-z_][A-Za-z_0-9]*\b',row[0]))
    color_html=(args.pages/'mql5-webcolors.html').read_text()
    constants.extend(re.findall(r'\bclr[A-Za-z][A-Za-z0-9]*\b',color_html))
    structures='MqlBookInfo MqlCalendarCountry MqlCalendarEvent MqlCalendarValue MqlDateTime MqlParam MqlRates MqlTick MqlTradeCheckResult MqlTradeRequest MqlTradeResult MqlTradeTransaction'.split()
    basic='bool char color datetime double float int long short string uchar uint ulong ushort void vector vectorf vectorc vectorcf matrix matrixf matrixc matrixcf complex'.split()
    enum_types=sorted(set(re.findall(r'\bENUM_[A-Z_0-9]+\b', (args.pages/'mql5-constant-indices.html').read_text()+(args.pages/'mql5-calendar-structures.html').read_text())))
    data={'checked':date.today().isoformat(), 'sources':[
        'https://www.mql5.com/en/docs/function_indices', 'https://www.mql5.com/en/docs/constant_indices',
        'https://www.mql5.com/en/docs/constants/structures', 'https://www.mql5.com/en/docs/constants/structures/mqlcalendar',
        'https://www.mql5.com/en/docs/constants/objectconstants/webcolors'],
        'types':sorted(set(basic+structures+enum_types)),
        'functions':sorted(set(functions)), 'constants':sorted(set(constants)),
        'events':sorted(set(events)), 'indicators':sorted(set(indicators)),
        'predefined':['_AppliedTo','_Digits','_IsX64','_LastError','_Period','_Point','_RandomSeed','_StopFlag','_Symbol','_UninitReason']}
    assert len(data['functions'])>400 and 'ObjectSetInteger' in functions and 'initialize' not in functions
    assert 'CORNER_LEFT_UPPER' in constants and 'MqlTick' in data['types']
    target=root/'data/builtins.json';target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(data,indent=2)+'\n')
    print({name:len(data[name]) for name in ['types','functions','constants','events','indicators']})

if __name__=='__main__': main()
