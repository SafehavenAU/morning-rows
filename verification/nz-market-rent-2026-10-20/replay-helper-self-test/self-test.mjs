import {mkdtemp,readFile,writeFile,mkdir,copyFile,access} from'node:fs/promises';
import {tmpdir}from'node:os';import {join,resolve}from'node:path';import {pathToFileURL}from'node:url';import{spawnSync}from'node:child_process';import assert from'node:assert/strict';
const {readNzMarketRent,NZ_RENT_LOCATIONS}=await import(pathToFileURL(resolve('lib/nz-market-rent.js')));
const {inspectSource,RENT_CONTRACT}=await import(pathToFileURL(resolve('lib/monitor-contracts.js')));
const base=await mkdtemp(join(tmpdir(),'mr-CONSTRUCTED-replay-helper-test-')),dir=join(base,'captures');await mkdir(dir);
const read=async path=>JSON.parse(await readFile(path,'utf8')),save=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
for(const name of ['_united-states.json.response','_united-kingdom.json.response','_england.json.response','_scotland.json.response','_wales.json.response','_northern-ireland.json.response'])await copyFile(join('verification/claimant-count-2026-10-20/staged-preview',name),join(dir,name));
const identity={source_revision:'d'.repeat(40),source_dirty:false,build_fingerprint:'d'.repeat(16),worker_version:'dddddddd-dddd-4ddd-addd-dddddddddddd'};
await save(join(dir,'_health.json.response'),identity);
const at=new Date().toISOString();
const rent=await readNzMarketRent({now:()=>at,fetcher:async url=>{const place=Object.values(NZ_RENT_LOCATIONS).find(v=>v.source_url===url);assert.ok(place);return new Response(JSON.stringify({Finder:'',Table:await readFile(`verification/nz-market-rent-2026-10-20/original/${place.id.includes('avondale')?'avondale':'kelburn'}-ajax.html`,'utf8')}));}});
const body={country:'New Zealand',market_rent:rent,sources:{market_rent:{status:'ok',fetched_at:at}}};
await save(join(dir,'_new-zealand.json.response'),body);
// Pin the pre-rent review and August approvals to the retained August captures.
// Later accepted releases must not mutate this historical constructed specimen.
const review=await read('verification/nz-market-rent-2026-10-20/monitor-prior-release-review.json');review.continuations.push({from:structuredClone(review.continuations.at(-1).to),to:identity,scope:'nine-desks-plus-claimants-and-nz-rent',evidence:'CONSTRUCTED-only helper test; not accepted release'});
const approvals=await read('verification/nz-market-rent-2026-10-20/monitor-prior-approved-observations.json');approvals[RENT_CONTRACT.key]={version:(await inspectSource(body,RENT_CONTRACT)).version,evidence:review.continuations.at(-1).evidence};
const reviewPath=join(base,'CONSTRUCTED-review.json'),approvalPath=join(base,'CONSTRUCTED-approvals.json');await save(reviewPath,review);await save(approvalPath,approvals);
const checkpoint=resolve('verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json'),report=resolve('verification/us-paid-2026-10-20/checkpoint-predecessor/report.json');
const run=(output,latest='2026-08')=>spawnSync(process.execPath,[resolve('scripts/replay-rent-release.mjs'),checkpoint,report,reviewPath,approvalPath,dir,latest,output],{encoding:'utf8'});
const good=join(base,'CONSTRUCTED-pass.json'),success=run(good);assert.equal(success.status,0,success.stderr);const proof=await read(good);assert.equal(proof.pass,true);assert.equal(proof.prior_108_source_states_equal,true);assert.equal(proof.hypothetical_prefixes.length,2);assert.equal(proof.actual_scheduled_cycles_added,0);
const cases=[];
async function rejected(name,mutate,restore){await mutate();const output=join(base,name+'.json'),result=run(output);assert.notEqual(result.status,0,name);await assert.rejects(access(output));await restore();cases.push(name);}
await rejected('wrong-approval',async()=>{const bad=structuredClone(approvals);bad[RENT_CONTRACT.key].version='0'.repeat(64);await save(approvalPath,bad)},()=>save(approvalPath,approvals));
await rejected('broken-edge',async()=>{const bad=structuredClone(review);bad.continuations[1].from.worker_version='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';await save(reviewPath,bad)},()=>save(reviewPath,review));
await rejected('wrong-identity',async()=>save(join(dir,'_health.json.response'),{...identity,source_dirty:true}),()=>save(join(dir,'_health.json.response'),identity));
await rejected('missing-row',async()=>{const bad=structuredClone(body);bad.market_rent.rows.pop();await save(join(dir,'_new-zealand.json.response'),bad)},()=>save(join(dir,'_new-zealand.json.response'),body));
await rejected('invented-intermediate',async()=>{const bad=structuredClone(review);bad.to.worker_version='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';bad.continuations[0].from.worker_version=bad.to.worker_version;await save(reviewPath,bad)},()=>save(reviewPath,review));
const wrongPeriodOutput=join(base,'wrong-claimant-month.json');assert.notEqual(run(wrongPeriodOutput,'2026-09').status,0);await assert.rejects(access(wrongPeriodOutput));cases.push('wrong-claimant-month');
const duplicate=run(good);assert.notEqual(duplicate.status,0);cases.push('overwrite-refused');
console.log(JSON.stringify({constructed_test_only:true,base,pass:true,success_cases:1,rejected_cases:cases,remote_calls:0,checkout_edits:0}));
