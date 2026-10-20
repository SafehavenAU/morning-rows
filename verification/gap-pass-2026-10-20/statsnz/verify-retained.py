#!/usr/bin/env python3
"""Verify minimal original official publication evidence against fixed reader targets.
Python standard library only. No runtime-reader imports or network access.
"""
import csv, decimal, hashlib, html, io, json, pathlib, re, zipfile, xml.etree.ElementTree as ET
B=pathlib.Path(__file__).resolve().parent
D=decimal.Decimal

def source(name):return json.loads((B/'sources'/(name+'.json')).read_text())
def block(name,i):return next(x['original_fields'] for x in source(name)['selected_blocks'] if x['json_pointer']==f'/PageBlocks/{i}')
def graph(name,i,label,period):
    rows=list(csv.reader(io.StringIO(block(name,i)['SeriesData'][0]['GraphCsvData'].lstrip('\ufeff'))))
    assert rows[0].count(period)==1
    matches=[r for r in rows[1:] if r[0]==label];assert len(matches)==1
    return D(matches[0][rows[0].index(period)])
def table_rows(content):
    return [[html.unescape(re.sub('<[^>]+>','',cell)).strip() for cell in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',row,re.S)] for row in re.findall(r'<tr[^>]*>(.*?)</tr>',content,re.S)]
def xlsx_cells(path,sheetname):
    ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as z:
        shared=[''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
        sheets=ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet',ns)
        sh=next(s for s in sheets if s.attrib['name']==sheetname)
        rid=sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target=next(x.attrib['Target'] for x in rels if x.attrib['Id']==rid)
        xml=ET.fromstring(z.read('xl/'+target));out={}
        for c in xml.findall('.//m:sheetData/m:row/m:c',ns):
            v=c.find('m:v',ns)
            if v is not None:out[c.attrib['r']]=shared[int(v.text)] if c.attrib.get('t')=='s' else v.text
        return out

def main():
    m=json.loads((B/'manifest.json').read_text())
    for a in m['artifacts']:assert hashlib.sha256((B/a['file']).read_bytes()).hexdigest()==a['sha256'],a['file']
    targets={r['id']:r for r in json.loads((B/'reader-targets.json').read_text())['rows']};assert len(targets)==23
    comparisons=[]
    def check(id,value,evidence,qualifier):
        r=targets[id];assert value==D(str(r['value'])),(id,value,r['value'])
        comparisons.append({'id':id,'period':r['period'],'reader_value':r['value'],'official_value':str(value),'evidence':evidence,'result':'exact_match_at_published_precision','qualification':qualifier})
    check('BDS_BDS_004',graph('enterprise',3,'Enterprises','2025'),'sources/enterprise.json /PageBlocks/3','At February 2025; economically significant enterprises, provisional. Graph preserves exact count while prose rounds to ten.')
    check('HES_HES_001',graph('hes',5,'Expenditure ($)','2023'),'sources/hes.json /PageBlocks/5','Year ended June 2023; average weekly expenditure net of deductions; same 1597.5 published graph cell.')
    check('INC_INC_010',graph('income-release',8,'Gender pay gap','Jun-26'),'sources/income-release.json /PageBlocks/8','June-quarter median hourly wage/salary gap; 5.3 percent at published one-decimal precision, not an adjusted pay-equality measure.')
    iwi=next(r for r in table_rows(block('iwi',24)['Content']) if r and r[0]=='03 Ngāi Tahu Whānui')
    check('IWI18_GRP_001',D(iwi[2].replace(',','')),'sources/iwi.json /PageBlocks/24','2018 estimated iwi grouping count; shared census/admin/nonresponse-weighting lineage, not an official 2018 Census count or 2023 observation.')
    check('POPPR_NAT_007',graph('pop-projection',28,'50th percentile','2026'),'sources/pop-projection.json /PageBlocks/28','2024-base median projection at 30 June 2026; not an observed population count.')
    check('PRD_PRD_001',graph('productivity',3,'Measured sector','2025'),'sources/productivity.json /PageBlocks/3','Measured sector, year ended March 2025; 1996=1000 index; provisional.')
    prows=table_rows(block('productivity',2)['Content'])
    for id,label in [('PRD_PRD_002','Labour productivity'),('PRD_PRD_003','Value added')]:
        row=next(r for r in prows if r and r[0]==label)
        check(id,D(row[5]),'sources/productivity.json /PageBlocks/2, latest annual 2025 column','Measured-sector year ended March 2025 annual percentage change; provisional, not the longer growth-cycle columns.')
    cells=xlsx_cells(B/'sources/pop-sub-workbook.xlsx','Table 1')
    assert cells['A25']=='New Zealand(3)' and cells['B6']=='2023' and cells['D6']=='2025 P'
    assert 'Estimated resident population' in cells['A2'] and '2023 census usually resident' in cells['A26']
    check('POPES_SUB_001',D(cells['D25']),'sources/pop-sub-workbook.xlsx Table 1 D25','At 30 June 2025 provisional national estimated resident population, regional council total; 2023 census base.')
    check('POPES_ERP_005',D(cells['B25']),'sources/pop-sub-workbook.xlsx Table 1 B25','At 30 June 2023 national estimated resident population, all people. Exact all-person total; does not certify the ethnic disaggregation or its broader dataset.')
    with (B/'sources/injury-current-selected.csv').open() as f:
        injuries=list(csv.DictReader(f))
    cell=next(x for x in injuries if x['Series_reference']=='W_I21' and x['Period']=='2021' and x['Type']=='Single year' and x['Severity']=='Serious' and x['Cause']=='All' and x['Population']=='Whole pop' and x['Age']=='All ages' and x['Indicator']=='Number' and x['Units']=='Injuries')
    check('INJ_INJ_001',D(cell['Data_value']),'sources/injury-current-selected.csv, W_I21/2021','Original updated 2000–2024 release CSV: all-population/all-age/all-cause combined serious injuries, 2021. Publication points to INJ_INJ_001. Later nonfatal-only year is not substituted; mortality/revision caveats remain.')
    # The frozen reader target is not independent evidence. Exact metadata/period
    # predicates above precede each decimal comparison; zero tolerance.
    result={'checked_at':'2026-10-20','target_count':len(targets),'exact_numeric_comparisons':len(comparisons),'comparisons':comparisons,'uncompared_ids':sorted(set(targets)-{c['id'] for c in comparisons}),'all_23_accepted':False,'statistical_independence':'Separate Python extraction and official publication presentation; all share Stats NZ statistical lineage. No independent re-estimation or future-vintage approval.'}
    (B/'comparison-results.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'targets':len(targets),'exact_comparisons':len(comparisons),'remaining':len(result['uncompared_ids']),'all_23_accepted':False}))
if __name__=='__main__':main()
