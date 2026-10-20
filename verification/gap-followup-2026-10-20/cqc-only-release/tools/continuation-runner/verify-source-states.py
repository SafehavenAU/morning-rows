"""Strict offline staged-to-production source-state comparison. No exceptions.

STAGE_STRICT APEX_STRICT WWW_STRICT NEW_OUTPUT REVISION VERSION
"""
import hashlib
import json
from pathlib import Path
import re
import sys

DESKS = {'australia','new-zealand','canada','united-kingdom','england','scotland','wales','northern-ireland','united-states'}

def require(ok, label):
    if not ok:
        raise ValueError(label)

def classify(desk, source, old, new):
    if not isinstance(old, dict) or not isinstance(new, dict):
        return 'requires_review_added_or_missing_source'
    if old.get('status') == new.get('status') == 'ok':
        return 'unchanged_healthy'
    if desk == 'england' and source in {'service','rail','also.roads'} and all(
        s.get('status') == 'ok' or (s.get('status') == 'error'
        and s.get('http_status') == 429 and s.get('error') == 'api.tfl.gov.uk returned HTTP 429')
        for s in [old, new]):
        return 'known_intermittent_TfL_429'
    if old.get('status') == new.get('status') == 'error':
        if old.get('http_status') == new.get('http_status') and old.get('error') == new.get('error'):
            return 'unchanged_known_failure'
        if all(s.get('http_status') in {403,429}
               and s.get('error') == f"www.ons.gov.uk returned HTTP {s['http_status']}" for s in [old,new]):
            return 'known_ONS_403_429_availability_change'
    return 'requires_review_changed_source_state'

def strict(report, revision, version):
    require(report.get('pass') is True and len(report.get('checks',[])) == 50
            and all(c.get('pass') is True for c in report['checks']), 'All 50 strict semantic checks must pass')
    identity = report.get('identity',{})
    require(identity.get('source_revision') == revision and identity.get('worker_version') == version
            and identity.get('source_dirty') is False and re.fullmatch('[a-f0-9]{16}',identity.get('build_fingerprint','')),
            'Exact clean semantic capture identity required')
    require(set(report['source_status']) == DESKS,'Exact nine desks required')
    require(report['source_status']['scotland']['river_level'].get('status') == 'ok',
            'SEPA must be successful; no historical availability exception is allowed')
    return {k:identity[k] for k in ['source_revision','worker_version','build_fingerprint','source_dirty']}

def main():
    require(len(sys.argv) == 7,'STAGE_STRICT APEX_STRICT WWW_STRICT NEW_OUTPUT REVISION VERSION required')
    stage_path,apex_path,www_path,output,revision,version = sys.argv[1:]
    result={'kind':'Strict actual source-state comparison with no semantic exception','pass':False,'semantic_exceptions_allowed':False,
            'inputs':[],'source_comparison':{},'limitations':['Source availability comparison does not independently approve numbers or future vintages.','Only known ONS 403/429 and TfL 429 fluctuations may change without separate review; all other changed states fail.']}
    def load(path):
        raw=Path(path).read_bytes()
        result['inputs'].append({'path':path,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
        return json.loads(raw)
    try:
        stage=load(stage_path);identity=strict(stage,revision,version)
        for host,path in [('apex',apex_path),('www',www_path)]:
            production=load(path);require(strict(production,revision,version)==identity,'Both domains must match exact staged identity')
            rows=[]
            for desk in sorted(DESKS):
                old=stage['source_status'][desk];new=production['source_status'][desk]
                for source in sorted(set(old)|set(new)):
                    rows.append({'desk':desk,'source':source,'staged':old.get(source),'production':new.get(source),
                                 'classification':classify(desk,source,old.get(source),new.get(source))})
            failures=[r for r in rows if r['classification'].startswith('requires_review')]
            result['source_comparison'][host]={'compared_source_states':len(rows),'states':rows,
                'changes':[r for r in rows if r['classification'] not in {'unchanged_healthy','unchanged_known_failure'}],
                'requires_review':failures}
            require(len(rows)==120,'Exact 120 source-state obligations required')
            require(not failures,'Unreviewed changed source state on '+host)
        result['identity']=identity;result['pass']=True
    except (ValueError,KeyError,TypeError,OSError) as error:
        result['error']=str(error)
    with Path(output).open('x') as stream:
        json.dump(result,stream,indent=2);stream.write('\n')
    print(json.dumps({'pass':result['pass'],'error':result.get('error'),'output':output}))
    return 0 if result['pass'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
