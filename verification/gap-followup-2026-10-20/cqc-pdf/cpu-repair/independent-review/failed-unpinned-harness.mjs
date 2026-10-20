import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as old from '/workspace/morning-rows-aemo-followup/lib/cqc-pdf.js';
import * as next from '/workspace/morning-rows-cqc-cpu-repair/lib/cqc-pdf.js';
const encode=x=>new TextEncoder().encode(x), hash=x=>createHash('sha256').update(x).digest('hex');
const outcome=(module,text,opts={})=>{const lex=new module.PdfLexer(encode(text),opts);try {const result=lex.value();lex.complete();return {ok:true,result,pos:lex.pos,tokens:lex.tokens};}catch(e){return {ok:false,error:e.message,pos:lex.pos,tokens:lex.tokens};}};
const entries=n=>Array.from({length:n},(_,i)=>`/K${i} true`).join(' ');
const cases=[
 ['empty dictionary','<< >>',true],
 ['single key','<< /K false >>',true],
 ['1023 keys',`<< ${entries(1023)} >>`,true],
 ['1024 keys',`<< ${entries(1024)} >>`,true],
 ['1025 keys',`<< ${entries(1025)} >>`,false],
 ['1024 with duplicate tail',`<< ${entries(1024)} /K0 null >>`,false],
 ['1024 with numeric names',`<< ${Array.from({length:1024},(_,i)=>`/${i} ${i}`).join(' ')} >>`,true],
 ['1025 numeric names',`<< ${Array.from({length:1025},(_,i)=>`/${i} ${i}`).join(' ')} >>`,false],
 ['null-prototype names','<< /__proto__ true /constructor false /toString null >>',true],
 ['duplicate special name','<< /__proto__ true /__proto__ false >>',false],
 ['escaped duplicate','<< /AB true /A#42 false >>',false],
 ['independent sibling dictionaries',`<< /A << ${entries(1024)} >> /B << ${entries(1024)} >> >>`,true],
 ['nested overflow',`<< /A << ${entries(1025)} >> >>`,false],
 ['last parent key has nested dictionary',`<< ${entries(1023)} /Last << ${entries(1024)} >> >>`,true],
 ['overflow value parse error precedes size error',`<< ${entries(1024)} /Extra [ >>`,false],
 ['invalid key after bound',`<< ${entries(1024)} 7 false >>`,false],
 ['missing dictionary close',`<< ${entries(1024)}`,false],
 ['trailing bytes after accepted dictionary',`<< ${entries(1024)} >> true`,false],
 ['token bound preserved','<< /A true /B false >>',false,{maxTokens:4}],
 ['depth bound preserved','<< /A << /B << /C true >> >> >>',false,{maxDepth:2}],
];
const checks=[];
for(const [name,text,ok,opts] of cases){const before=outcome(old,text,opts),after=outcome(next,text,opts);assert.deepEqual(after,before,name);assert.equal(after.ok,ok,name);checks.push({name,pass:true,expected_acceptance:ok,...(!ok?{error:after.error}:{})});}
const input=readFileSync('/tmp/mr-cqc-pdf-original/report.pdf');
assert.equal(input.length,7175967);assert.equal(hash(input),'61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef');
const before=old.parseCqcPdf(new Uint8Array(input),{retrieved_at:'2026-10-20T17:56:31.747Z'}),after=next.parseCqcPdf(new Uint8Array(input),{retrieved_at:'2026-10-20T17:56:31.747Z'});
assert.deepEqual(after,before);assert.deepEqual(after.rows.map(r=>r.value),[125,809,2063,65,3062]);
const priorSource=readFileSync('/workspace/morning-rows-aemo-followup/lib/cqc-pdf.js'),currentSource=readFileSync('/workspace/morning-rows-cqc-cpu-repair/lib/cqc-pdf.js');
const snapshot=readFileSync('/workspace/morning-rows-cqc-cpu-repair/verification/gap-followup-2026-10-20/cqc-pdf/cpu-repair/prior-reader.js');assert.deepEqual(snapshot,priorSource);
const report={pass:true,recorded_at:new Date().toISOString(),scope:'Independent local differential parser review only; no remote release or CPU acceptance',before_module_sha256:hash(priorSource),after_module_sha256:hash(currentSource),original_pdf_sha256:hash(input),original_pdf_bytes:input.length,checks,control_count:checks.length,full_native_deep_equal:true,native_sha256:hash(JSON.stringify(after)),values:after.rows.map(r=>r.value),prior_reader_byte_identical:true,no_http:true,no_repository_writes:true};
writeFileSync('/tmp/mr-cqc-cpu-independent-review/controls.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,control_count:checks.length,full_native_deep_equal:true,native_sha256:report.native_sha256}));
