import assert from 'node:assert/strict';
export function acquisitionWindow(capture,health,provenance){
 const start=Date.parse(capture.started_at),end=Date.parse(capture.at),complete=Date.parse(health.fetched_at);
 assert.ok(Number.isFinite(start)&&Number.isFinite(end)&&Number.isFinite(complete)&&start<=complete&&complete<=end,'Fresh source completion must occur inside the sampled request');
 for(const p of provenance){const at=Date.parse(p.retrieved_at);assert.ok(Number.isFinite(at)&&start<=at&&at<=complete,'Publisher acquisition must occur inside the sampled request');if(p.requested_at!==undefined){const requested=Date.parse(p.requested_at);assert.ok(Number.isFinite(requested)&&start<=requested&&requested<=at,'Publisher request must start inside the sampled request');}}
 return {start,end,complete};
}
