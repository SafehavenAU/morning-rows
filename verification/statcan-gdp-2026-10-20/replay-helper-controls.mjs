// CONSTRUCTED LOCAL HARNESS CHECK ONLY: no candidate, release or scheduled proof.
import {mkdtemp,readFile,writeFile,copyFile,mkdir,rm} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {parseStatcanGdp} from '../../lib/statcan-gdp.js';
import {REGISTRY,inspectSource} from '../../lib/monitor-contracts.js';
const directory=await mkdtemp(join(tmpdir(),'mr-gdp-replay-CONSTRUCTED-'));
const evidenceDirectory=dirname(fileURLToPath(import.meta.url));
const root=resolve(evidenceDirectory,'../..');
// Normally all retained inputs live in this checkout. An explicit fixture root
// supports a pre-rebase check against the same accepted rent evidence.
const rent=process.argv[2]?resolve(process.argv[2]):root;
const priorReviewFile=join(evidenceDirectory,'replay-prior-rent-review.json');
const priorApprovalFile=join(evidenceDirectory,'replay-prior-rent-approvals.json');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const save=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const priorReview=await json(priorReviewFile);
const review=structuredClone(priorReview),evidence='verification/statcan-gdp-2026-10-20/README.md';
const target={source_revision:'d'.repeat(40),worker_version:'dddddddd-dddd-4ddd-addd-dddddddddddd',source_dirty:false,build_fingerprint:'d'.repeat(16)};
review.continuations.push({from:structuredClone(priorReview.continuations.at(-1).to),to:target,scope:'nine-desks-plus-claimants-and-nz-rent',evidence});
const captures=join(directory,'CONSTRUCTED-captures');
await mkdir(captures);
for(const desk of ['united-states','united-kingdom','england','scotland','wales','northern-ireland','new-zealand','canada'])
  await copyFile(join(rent,`verification/nz-market-rent-2026-10-20/production-apex-capture/_${desk}.json.response`),join(captures,`_${desk}.json.response`));
await save(join(captures,'_health.json.response'),target);
const body=await json(join(captures,'_canada.json.response'));
body.product=parseStatcanGdp(...await Promise.all(['wds-selected.json','series-metadata.json','cube-metadata.json'].map(file=>json(join(root,'verification/statcan-gdp-2026-10-20/original',file)))));
body.sources.product={status:'ok',fetched_at:new Date().toISOString()};
await save(join(captures,'_canada.json.response'),body);
const inspected=await inspectSource(body,REGISTRY.find(c=>c.key==='canada/product'));
assert.equal(inspected.kind,'success');
const approvals=await json(priorApprovalFile);
approvals['canada/product']={version:inspected.version,evidence,assurance:'CONSTRUCTED SELFTEST ONLY; not an actual approval'};
const reviewFile=join(directory,'CONSTRUCTED-proposed-review.json'),approvalFile=join(directory,'CONSTRUCTED-proposed-approvals.json');
await save(reviewFile,review);await save(approvalFile,approvals);
const invoke=output=>spawnSync(process.execPath,[
  'scripts/replay-gdp-release.mjs',
  join(rent,'verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json'),
  join(rent,'verification/us-paid-2026-10-20/checkpoint-predecessor/report.json'),
  priorReviewFile,priorApprovalFile,
  reviewFile,approvalFile,captures,'2026-09',join(directory,output),
],{cwd:root,encoding:'utf8'});
const good=invoke('CONSTRUCTED-positive-proof.json');
assert.equal(good.status,0,good.stderr);
const proof=await json(join(directory,'CONSTRUCTED-positive-proof.json'));
assert.equal(proof.pass,true);assert.equal(proof.constructed,true);
assert.equal(proof.direct.constructed_next_sequence,6);
assert.equal(proof.hypothetical_prefixes.length,3);
assert.equal(proof.actual_scheduled_cycles_added,0);
const rejected=[];
const broken=structuredClone(review);broken.continuations[2].from.source_revision='e'.repeat(40);
await save(reviewFile,broken);
assert.notEqual(invoke('MUST-NOT-EXIST-broken-chain.json').status,0);rejected.push('broken reviewed fourth-edge predecessor');
await save(reviewFile,review);
const changedApproval=structuredClone(approvals);changedApproval['canada/exchange'].version='f'.repeat(64);
await save(approvalFile,changedApproval);
assert.notEqual(invoke('MUST-NOT-EXIST-replaced-approval.json').status,0);rejected.push('unrelated old approval replacement');
await save(approvalFile,approvals);
const wrongGdp=structuredClone(body);wrongGdp.product.rows[0].value++;
await save(join(captures,'_canada.json.response'),wrongGdp);
assert.notEqual(invoke('MUST-NOT-EXIST-invalid-GDP.json').status,0);rejected.push('unreconciled GDP observation');
await save(join(captures,'_canada.json.response'),body);
assert.notEqual(invoke('CONSTRUCTED-positive-proof.json').status,0);rejected.push('overwrite retained proof');
const report={kind:'Constructed local GDP replay-helper controls only',pass:true,positive_direct_and_three_prefix_cases:true,rejected,actual_candidate:false,actual_scheduled_cycles_added:0,checkpoint_written:false,remote_calls:0,
  fixture_references:[
    'verification/statcan-gdp-2026-10-20/replay-prior-rent-review.json',
    'verification/statcan-gdp-2026-10-20/replay-prior-rent-approvals.json',
    'verification/statcan-gdp-2026-10-20/original/{wds-selected,series-metadata,cube-metadata}.json',
    'verification/statcan-gdp-2026-10-20/independent-report.json',
    'verification/us-paid-2026-10-20/checkpoint-predecessor/{fresh-checkpoint,report}.json',
    'verification/nz-market-rent-2026-10-20/production-apex-capture/_{united-states,united-kingdom,england,scotland,wales,northern-ireland,new-zealand,canada}.json.response',
  ],
  pinned_prior_review_sha256:'81bfe15405e42c7e1443c325ae34114601629c407ce6f7c86fd36fb0a7d44ccd',
  pinned_prior_approvals_sha256:'c792d33abc23254ca59f3250eabd44b2dad643ad04e5245b581b3c14d9cd192e',
  qualification:'Synthetic identity, GDP fixture and proposed approval are generated only in a temporary directory; no actual candidate, release or scheduled collection is established. Active operations files are never read.',
};
await rm(directory,{recursive:true,force:true});
console.log(JSON.stringify(report,null,2));
