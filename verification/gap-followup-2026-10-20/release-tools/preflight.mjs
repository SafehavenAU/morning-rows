// Read-only local preflight. No remote command, capture, deployment or writes.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {routes as gapRoutes} from '../../gap-pass-2026-10-20/interface-checker/support.mjs';
import {routes as remainingRoutes} from '../../remaining-gaps-2026-10-20/interface-checker/support.mjs';
import {routes as niRoutes} from '../interface-checker/support.mjs';
const root=resolve(new URL('../../..',import.meta.url).pathname),prefix='verification/gap-followup-2026-10-20/release-tools';
assert.equal(resolve('.'),root,'Run preflight from the repository root');
assert.equal(gapRoutes().length,40);assert.equal(remainingRoutes().length,22);assert.equal(niRoutes().length,23);
const files=[
 `${prefix}/validate-release.sh`,`${prefix}/verify-added-source-cpu.mjs`,`${prefix}/verify-source-states.py`,`${prefix}/audit-reports.mjs`,
 ...['verify-us-version-cpu.mjs','verify-legacy-version-cpu.mjs','verify-claimant-repeat-cpu.mjs','verify-rent-source-cpu.mjs','verify-staged-preview.mjs','check-information.mjs','verify-preview-bodies.mjs','verify-followup-statsnz.py','check-statcan-gdp.mjs','verify-statcan-gdp-captures.py','check-claimants.mjs','verify-claimant-captures.mjs','verify-claimant-schemas.py','check-market-rent.mjs','verify-rent-captures.py','check-gap-pass.mjs','check-remaining-gaps.mjs','check-ni-energy-summary.mjs','smoke.mjs'].map(p=>'scripts/'+p),
 ...['verification/gap-pass-2026-10-20/interface-checker','verification/remaining-gaps-2026-10-20/interface-checker','verification/gap-followup-2026-10-20/interface-checker'].flatMap(p=>[p+'/verify-captures.mjs',p+'/verify-schemas.py']),
 'verification/gap-followup-2026-10-20/interface-checker/verify-existing-remaining-schemas.py',
];
const inputs=[];
for(const file of files){const bytes=await readFile(file);inputs.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});}
assert.equal(spawnSync('bash',['-n',prefix+'/validate-release.sh']).status,0,'Shell syntax failed');
assert.equal(spawnSync('python3',['-c','import jsonschema']).status,0,'Python jsonschema required');
for(const command of ['node','python3','curl','realpath','sha256sum'])assert.equal(spawnSync('bash',['-c','command -v "$1"','preflight',command],{stdio:'ignore'}).status,0,command+' required');
await access('/workspace/.morning-rows-tools/node_modules/.bin/wrangler');
const text=await readFile(prefix+'/validate-release.sh','utf8');
assert.ok(text.includes('node scripts/verify-preview-bodies.mjs'));
assert.ok(!text.includes('mr-gap-core-semantic-gate')&&!text.includes('mr-gap-production-health-gate'));
assert.ok(text.includes('CHECK_US=1 CHECK_CLAIMANTS=1 CHECK_NZ_RENT=1 CHECK_CA_GDP=1 CHECK_NZ_PRICES=1'));
console.log(JSON.stringify({kind:'Read-only release runner preflight, not remote authentication or release evidence',pass:true,routes_per_domain:{gap:40,remaining:22,ni:23},files:inputs}));
