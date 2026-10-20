#!/usr/bin/env python3
"""Freeze dated public checkers only AFTER successful original extraction."""
from hashlib import sha256
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
REPO = Path('/workspace/morning-rows-aemo-followup')
OLD = REPO / 'verification/gap-followup-2026-10-20/aemo-daily/interface-checker'

def replace(text, old, new, count=1):
    if text.count(old) != count:
        raise ValueError('Unexpected source template occurrence count: ' + old[:90])
    return text.replace(old, new)

def build(raw):
    """Pure template adaptation; only main() writes a bound original oracle."""
    refs = json.loads(raw)
    if not (refs['pass'] and refs['calendar_day'] == '2026-10-20'
            and refs['independently_extracted_intervals'] == refs['layout_numeric_agreement_count'] == 576
            and refs['exact_cent_comparisons'] == 576 and refs['derived_summary_count'] == 10
            and len(refs['observations']) == 576 and refs['monthly_comparison'] == {'status': 'matched', 'count': 576}):
        raise ValueError('Successful exact new-day extraction required')
    files = {}
    text = (OLD / 'support.mjs').read_text()
    text = replace(text, "import {join} from 'node:path';",
                   "import {join} from 'node:path';\nimport {fileURLToPath} from 'node:url';\nconst evidenceRoot=fileURLToPath(new URL('../',import.meta.url));")
    text = replace(text, "period='2026-10-19'", "period='2026-10-20'")
    text = replace(text, "observation=2026-10-18", "observation=2026-10-19")
    text = replace(text, "export async function references(root){", "export async function references(_root){\n const root=evidenceRoot;")
    text = replace(text, "for(const input of refs.input_files){const raw=await readFile(join(root,input.file));",
                   "for(const input of refs.input_files){if(typeof input.file!=='string'||!input.file.startsWith('original/')||input.file.split('/').some(p=>!p||p==='.'||p==='..')||input.file.includes('\\\\'))throw Error('Unsafe original evidence path');const raw=await readFile(join(root,input.file));")
    text = replace(text, "verification/gap-followup-2026-10-20/aemo-daily/review/independent-rounding.json",
                   "evidence/independent-rounding.json")
    text = replace(text, '3909cffb8ed82401adebe9785aaeb092e51085a760f097bf4c0c7ba36a889de0', sha256(raw).hexdigest())
    text = replace(text, "refs.exact_cent_comparisons!==576",
                   "refs.exact_cent_comparisons!==576||refs.independently_extracted_intervals!==576||refs.layout_numeric_agreement_count!==576||refs.derived_summary_count!==10||refs.monthly_comparison.status!=='matched'||refs.monthly_comparison.count!==576")
    text = replace(text, "native.next_rollover_at==='2026-10-20T14:00:00.000Z'",
                   "native.next_rollover_at==='2026-10-21T14:00:00.000Z'")
    text = replace(text, "b.trading_day===(i?'2026-10-19':'2026-10-18')&&b.report_generated_at===(i?'2026-10-20T04:05:03+10:00':'2026-10-19T04:05:02+10:00')",
                   "b.trading_day===zipRefs[i].trading_day&&b.report_generated_at===zipRefs[i].report_generated_at")
    text = replace(text, "r.period_end==='2026-10-20T00:00:00+10:00'", "r.period_end==='2026-10-21T00:00:00+10:00'")
    text = replace(text, "Date.parse(now)>=Date.parse('2026-10-19T14:00:00Z')&&Date.parse(now)<Date.parse('2026-10-20T14:00:00Z')",
                   "Date.parse(now)>=Date.parse('2026-10-20T14:00:00Z')&&Date.parse(now)<Date.parse('2026-10-21T14:00:00Z')")
    text = replace(text, "Date.parse('2026-10-20T14:00:00Z')", "Date.parse('2026-10-21T14:00:00Z')", count=3)
    # The prior replacement also matched the new lower bound. Restore that one
    # exact eligibility expression; no other reader's dated references change.
    text = replace(text, "Date.parse(now)>=Date.parse('2026-10-21T14:00:00Z')",
                   "Date.parse(now)>=Date.parse('2026-10-20T14:00:00Z')")
    text = replace(text, "source_presentations_share_statistical_lineage: true",
                   "source_presentations_share_statistical_lineage: true, separate_presentation_comparison: {status:'matched',count:576}, reference_scope:'576 independently extracted daily intervals matched to separate monthly presentation; ten derived values'")
    files['support.mjs'] = text

    text = (REPO / 'scripts/check-aemo-daily-bundles.mjs').read_text()
    text = replace(text, "../verification/gap-followup-2026-10-20/aemo-daily/interface-checker/support.mjs", "./support.mjs")
    text = replace(text, 'node scripts/check-aemo-daily-bundles.mjs', 'node tools/check-aemo-daily-bundles.mjs')
    files['check-aemo-daily-bundles.mjs'] = text
    text = (OLD / 'verify-captures.mjs').read_text()
    text = replace(text, "new URL('../../../../',import.meta.url)", "new URL('../',import.meta.url)")
    files['verify-captures.mjs'] = text

    text = (OLD / 'verify-numbers.py').read_text()
    text = replace(text, "ROOT=Path(__file__).resolve().parents[4]", "ROOT=Path(__file__).resolve().parent.parent")
    text = replace(text, "Path(__file__).resolve().parent.parent/'review/verify-rounding.py'",
                   "Path(__file__).resolve().parent.parent/'extract.py'")
    text = replace(text, "PERIOD='2026-10-19'", "PERIOD='2026-10-20'")
    text = replace(text, "'shared_aemo_market_lineage':True",
                   "'shared_aemo_market_lineage':True,'separate_presentation_comparison':{'status':'matched','count':576}")
    text = replace(text, "for request in captured['requests']:\n",
                   "for request in captured['requests']:\n   need(datetime.fromisoformat('2026-10-20T14:00:00+00:00') <= datetime.fromisoformat(request['started_at'].replace('Z','+00:00')) <= datetime.fromisoformat(request['completed_at'].replace('Z','+00:00')) < datetime.fromisoformat('2026-10-21T14:00:00+00:00'),'Actual eligible specimen capture window')\n")
    files['verify-numbers.py'] = text

    text = (OLD / 'verify-schemas.py').read_text()
    text = replace(text, "import copy", "import copy\nimport os")
    text = replace(text, "ROOT = Path(__file__).resolve().parents[4]",
                   "ROOT = Path(os.environ['MR_REPO']).resolve()")
    text = replace(text, "PERIOD = '2026-10-19'", "PERIOD = '2026-10-20'")
    text = replace(text, "observation=2026-10-18", "observation=2026-10-19")
    text = replace(text, "The retained 19 October specimen does not approve another calendar day.",
                   "The retained 20 October specimen does not approve another calendar day; the separate monthly presentation shares AEMO market lineage.")
    files['verify-schemas.py'] = text
    return files

def prepare():
    if len(sys.argv) != 1:
        raise ValueError('No oracle or date override supported')
    raw = (HERE / 'evidence/independent-rounding.json').read_bytes()
    files = build(raw)
    for name, body in files.items():
        with (HERE / 'tools' / name).open('x') as handle:
            handle.write(body)
    manifest = {'kind': 'Dated 20 October external checker adaptation', 'oracle_sha256': sha256(raw).hexdigest(),
                'inputs': [{'file': str(path.relative_to(REPO)), 'sha256': sha256(path.read_bytes()).hexdigest()}
                           for path in [OLD / name for name in ['support.mjs', 'verify-captures.mjs', 'verify-numbers.py', 'verify-schemas.py']]
                           + [REPO / 'scripts/check-aemo-daily-bundles.mjs']],
                'outputs': [{'file': 'tools/' + name, 'bytes': len(body.encode()), 'sha256': sha256(body.encode()).hexdigest()}
                            for name, body in files.items()],
                'limits': ['Only dated AEMO evidence checkers changed outside the repository.',
                           'No combined release runner, runtime reader or unrelated BoC date was changed.',
                           'MR_REPO is required only by the existing schema helper import.']}
    with (HERE / 'evidence/checker-adaptation.json').open('x') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')
    def binding(file):
        body = (HERE / file).read_bytes()
        return {'file': file, 'bytes': len(body), 'sha256': sha256(body).hexdigest()}
    refs = json.loads(raw)
    oracle_manifest = {'schema_version': 1, 'calendar_day': '2026-10-20', 'input_root': '.',
                       'eligible_start': '2026-10-20T14:00:00Z', 'eligible_end': '2026-10-21T14:00:00Z',
                       'reference': binding('evidence/independent-rounding.json'), 'input_files': refs['input_files'],
                       'checkers': {key: binding(file) for key, file in {
                           'support': 'tools/support.mjs', 'capture': 'tools/check-aemo-daily-bundles.mjs',
                           'offline_capture': 'tools/verify-captures.mjs', 'numbers': 'tools/verify-numbers.py',
                           'schemas': 'tools/verify-schemas.py', 'extractor': 'extract.py'}.items()},
                       'auxiliary': [binding(file) for file in ['CONTRACT.md', 'acquire.py', 'audit-acquisition.py', 'prepare-checkers.py',
                                                               'evidence/checker-adaptation.json']],
                       'lineage': 'Separate official daily/monthly presentations share AEMO market lineage',
                       'limits': ['Exact 20 October specimen only; no future-vintage or runtime/resource/release/scheduled acceptance']}
    with (HERE / 'evidence/oracle-manifest.json').open('x') as handle:
        json.dump(oracle_manifest, handle, indent=2)
        handle.write('\n')
    print(json.dumps({'pass': True, 'files': len(files), 'oracle_sha256': manifest['oracle_sha256']}))

if __name__ == '__main__':
    prepare()
