import assert from 'node:assert/strict';
import {eligible} from './day-gate.mjs';
import {acquisitionWindow} from './acquisition-window.mjs';
let count=0;for(const [value,want]of [['2026-10-19T13:59:59.999Z',false],['2026-10-19T14:00:00Z',true],['2026-10-20T13:59:59.999Z',true],['2026-10-20T14:00:00Z',false],['2026-10-21T12:00:00Z',false],['invalid',false]]){assert.equal(eligible(Date.parse(value)),want);count++;}
const capture={started_at:'2026-10-20T13:00:00.000Z',at:'2026-10-20T13:00:04.000Z'},health={fetched_at:'2026-10-20T13:00:03.000Z'},p={requested_at:'2026-10-20T13:00:01.000Z',retrieved_at:'2026-10-20T13:00:02.000Z'};
acquisitionWindow(capture,health,[p]);count++;
for(const edit of [r=>r.p.retrieved_at='2026-10-20T12:00:00Z',r=>r.p.requested_at='2026-10-20T12:59:59Z',r=>r.p.retrieved_at='2026-10-20T13:00:03.001Z',r=>r.health.fetched_at='2026-10-20T13:00:04.001Z',r=>r.p.retrieved_at='invalid']){const r=structuredClone({capture,health,p});edit(r);assert.throws(()=>acquisitionWindow(r.capture,r.health,[r.p]));count++;}
console.log(JSON.stringify({kind:'Constructed offline clock and cold acquisition controls only',pass:true,controls:count}));
