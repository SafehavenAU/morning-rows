// Reproducible refusal controls. No publisher, checkpoint or active operations
// writes. Temporary review inputs are explicitly constructed and never approved.
// node verification/gap-followup-2026-10-20/ni-energy-summary/monitoring/replay-helper-controls.mjs NEW_REPORT
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {NI_ELECTRICITY_SCOPE,NI_ELECTRICITY_CONTRACT_KEY,NI_ELECTRICITY_SOURCE_KEYS} from '../../../../lib/monitor-contracts.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=resolve('.'),output=process.argv[2];
assert.equal(process.argv.length,3,'A new report path is required');
const paths={
 checkpoint:'verification/us-paid-2026-10-20/checkpoint-predecessor/fresh-checkpoint.json',
 old:'verification/us-paid-2026-10-20/checkpoint-predecessor/report.json',
 review:'verification/remaining-gaps-2026-10-20/release-validation/monitoring/proposal/review.json',
 approvals:'verification/remaining-gaps-2026-10-20/release-validation/monitoring/proposal/approvals.json',
};
const retained=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await readFile(path)])));
const target={source_revision:'e'.repeat(40),worker_version:'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',build_fingerprint:'e'.repeat(16),source_dirty:false};
const priorReview=JSON.parse(retained.review),priorApprovals=JSON.parse(retained.approvals),evidence='CONSTRUCTED input-refusal control only';
const review={...structuredClone(priorReview),continuations:[...structuredClone(priorReview.continuations),{from:structuredClone(priorReview.continuations.at(-1).to),to:target,scope:NI_ELECTRICITY_SCOPE,source_contracts:[...NI_ELECTRICITY_SOURCE_KEYS],evidence}]};
const approvals={...structuredClone(priorApprovals),[NI_ELECTRICITY_CONTRACT_KEY]:{version:'0'.repeat(64),evidence}};
const temporary=await mkdtemp(join(tmpdir(),'mr-ni-replay-refusals-')),cases=[];
const instant=new Date().toISOString();
try{
 const currentReview=join(temporary,'constructed-review.json'),currentApprovals=join(temporary,'constructed-approvals.json');
 const absent=join(temporary,'NO-ACTUAL-CAPTURES'),report=join(temporary,'NEVER-WRITTEN.json');
 const args=()=>[paths.checkpoint,paths.old,paths.review,paths.approvals,sha(retained.review),sha(retained.approvals),currentReview,currentApprovals,absent,absent,absent,absent,absent,report,instant];
 async function check(label,mutate,expected){
  const proposed=structuredClone(review),approval=structuredClone(approvals),arguments_=args();
  await mutate({proposed,approval,arguments_});
  await writeFile(currentReview,JSON.stringify(proposed));await writeFile(currentApprovals,JSON.stringify(approval));
  const result=spawnSync(process.execPath,['scripts/replay-ni-energy-release.mjs',...arguments_],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024});
  assert.notEqual(result.status,0,label+': control must refuse');
  assert.match(result.stderr,expected,label+': exact refusal boundary required');
  if(label!=='existing output refusal')await assert.rejects(access(report),{code:'ENOENT'});
  cases.push({label,pass:true,output_written:false});
 }
 await check('valid retained prefix reaches actual capture requirement',()=>{},/NO-ACTUAL-CAPTURES/);
 await check('prior review hash mismatch',({arguments_:a})=>{a[4]='0'.repeat(64);},/Exact accepted six-edge predecessor review required/);
 await check('prior approval hash mismatch',({arguments_:a})=>{a[5]='0'.repeat(64);},/Exact twenty-three prior approvals required/);
 await check('missing NI approval',({approval})=>{delete approval[NI_ELECTRICITY_CONTRACT_KEY];},/Only the independently reconciled NI electricity approval/);
 await check('unexpected extra approval',({approval})=>{approval['england/bedroom_rent']={version:'1'.repeat(64),evidence};},/Only the independently reconciled NI electricity approval/);
 await check('old approval rewritten',({approval})=>{approval[Object.keys(priorApprovals)[0]].version='f'.repeat(64);},/prior approval must be retained/);
 await check('earlier review metadata rewritten',({proposed})=>{proposed.evidence+=' rewritten';},/All accepted release edges remain exact/);
 await check('new edge disconnected',({proposed})=>{proposed.continuations.at(-1).from.source_revision='0'.repeat(40);},/Exact contiguous reviewed release identities/);
 await check('new edge loses prior exact set',({proposed})=>{proposed.continuations.at(-1).source_contracts=[NI_ELECTRICITY_CONTRACT_KEY];},/Exact prior SFC\/CMHC set/);
 await check('unreviewed future clock',({arguments_:a})=>{a[14]='2199-01-01T00:00:00.000Z';},/A future simulated clock/);
 await check('invalid calendar clock',({arguments_:a})=>{a[14]='2026-02-30T00:00:00.000Z';},/real UTC calendar instant/);
 await check('existing output refusal',async()=>{await writeFile(report,'existing evidence');},/Output must be new evidence/);
 assert.equal(await readFile(report,'utf8'),'existing evidence');
 for(const [key,path]of Object.entries(paths))assert.equal(sha(await readFile(path)),sha(retained[key]),'Retained input unchanged');
 const result={kind:'Constructed NI replay-helper input/refusal controls; not capture, release or scheduled acceptance',pass:true,constructed:true,checked_at:new Date().toISOString(),helper:'scripts/replay-ni-energy-release.mjs',helper_sha256:sha(await readFile('scripts/replay-ni-energy-release.mjs')),cases,inputs:Object.entries(paths).map(([key,path])=>({path,sha256:sha(retained[key])})),full_capture_replay_performed:false,actual_checkpoint_written:false,active_operations_written:false,remote_calls:0};
 await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({pass:true,controls:cases.length,full_capture_replay_performed:false,output}));
}finally{await rm(temporary,{recursive:true,force:true});}
