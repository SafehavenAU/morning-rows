// Read-only local compatibility preflight; no remote authentication or requests.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {routes as gapRoutes} from './gap-support.mjs';
const root=resolve(process.env.MR_REPO||''),tools=dirname(fileURLToPath(import.meta.url));
assert.equal(resolve('.'),root,'Run from the exact MR_REPO worktree');
const load=file=>import(pathToFileURL(resolve(root,file)));
const {catalogue,INFORMATION_SCHEMA}=await load('lib/information.js');
const expected=[['australia','grid_day',10],['england','care_assessment_cohort',5],['northern-ireland','electricity_balance',5],['scotland','college_activity',5],['canada','rental_benchmark',2]];
for(const [desk,key,n]of expected){const cards=catalogue(desk).sources.filter(c=>c.key===key);assert.equal(cards.length,1);assert.equal(cards[0].measures.length,n);}
assert.ok(!catalogue('england').sources.some(c=>c.key==='bedroom_rent'),'Unapproved ONS rent remains held');
assert.ok(INFORMATION_SCHEMA.$defs.aemoDailyNative&&INFORMATION_SCHEMA.$defs.remainingCqcNative&&INFORMATION_SCHEMA.$defs.remainingNiNative);
assert.ok(!Object.keys(INFORMATION_SCHEMA.$defs).some(k=>k.startsWith('remainingOns')||k.startsWith('gapAemo')));
assert.equal(gapRoutes().length,39);assert.ok(!gapRoutes().some(r=>r.path.includes('grid_day')));
const routeFiles=[['verification/remaining-gaps-2026-10-20/interface-checker/support.mjs',22],['verification/gap-followup-2026-10-20/interface-checker/support.mjs',23],['verification/gap-followup-2026-10-20/aemo-daily/interface-checker/support.mjs',34],['verification/gap-followup-2026-10-20/cqc-pdf/interface-checker/support.mjs',23]];
for(const[file,n]of routeFiles)assert.equal((await load(file)).routes().length,n,file);
const config=await readFile('wrangler.toml','utf8');assert.match(config,/\[limits\]\s+cpu_ms\s*=\s*1000\b/,'Whole-Worker ceiling must stay 1000 ms');assert.match(config,/minify\s*=\s*true/);
if(process.argv[2]==='scope'){console.log(JSON.stringify({pass:true,active:expected,held:['england/bedroom_rent'],source_states_expected:121}));process.exit(0);}
const files=['verify-us-version-cpu.mjs','verify-legacy-version-cpu.mjs','verify-claimant-repeat-cpu.mjs','verify-rent-source-cpu.mjs','verify-staged-preview.mjs','check-information.mjs','verify-preview-bodies.mjs','verify-followup-statsnz.py','check-statcan-gdp.mjs','verify-statcan-gdp-captures.py','check-claimants.mjs','verify-claimant-captures.mjs','verify-claimant-schemas.py','check-market-rent.mjs','verify-rent-captures.py','check-remaining-gaps.mjs','check-ni-energy-summary.mjs','check-aemo-daily-bundles.mjs','check-cqc-pdf.mjs','smoke.mjs'].map(f=>'scripts/'+f);
const inputs=[];for(const file of files){const bytes=await readFile(file);inputs.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
const manifest=JSON.parse(await readFile(resolve(tools,'manifest.json')));for(const file of manifest.files){const bytes=await readFile(resolve(tools,file.file));assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
assert.equal(spawnSync('bash',['-n',resolve(tools,'validate-release.sh')]).status,0);
assert.equal(spawnSync('python3',['-c','import jsonschema']).status,0);
for(const command of ['node','python3','curl','realpath','sha256sum'])assert.equal(spawnSync('bash',['-c','command -v "$1"','preflight',command],{stdio:'ignore'}).status,0);
await access('/workspace/.morning-rows-tools/node_modules/.bin/wrangler');
console.log(JSON.stringify({kind:'Read-only combined preflight; no authenticated or remote proof',pass:true,routes_per_domain:{gap:39,remaining:22,ni:23,aemo:34,cqc:23},budget_ms:{usa:100,legacy:500,claimant:500,rent:500,worker_ceiling:1000},source_states_expected:121,inputs,bundle:manifest}));
