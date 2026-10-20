import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.env.MR_CQC_REVIEW_REPO||'/workspace/morning-rows-cqc-cpu-r2',base='79e251cab4314c328e84d9ac4ca7bf5e5408bdbb',hash=x=>createHash('sha256').update(x).digest('hex');
const prior=execFileSync('git',['show',base+':lib/cqc-pdf.js'],{cwd:root});
assert.equal(hash(prior),'7ee99d03615ee0cbfed4d7e8dff709f45dcde0839c410c2a56f0997563f61dbc');
const imported=prior.toString().replace("from 'fflate'","from 'file:///workspace/morning-rows-aemo-followup/node_modules/fflate/esm/index.mjs'").replace("from './sources.js'",`from '${pathToFileURL(root+'/lib/sources.js').href}'`).replace("from './cqc-cohort.js'",`from '${pathToFileURL(root+'/lib/cqc-cohort.js').href}'`);
const old=await import('data:text/javascript;base64,'+Buffer.from(imported).toString('base64'));
const currentSource=readFileSync(root+'/lib/cqc-pdf.js');
const next=await import(pathToFileURL(root+'/lib/cqc-pdf.js'));
const enc=s=>new TextEncoder().encode(s),cat=parts=>new Uint8Array(Buffer.concat(parts.map(b=>Buffer.from(b))));
function section({prefix=enc('%PDF-1.7\n'),objects=[[1,'<< /Value 101 >>']],id=3,size=4,widths=[1,4,2],index,entries,prev,rootRef=1}={}){
 const parts=[prefix],offsets={};let length=prefix.length;
 for(const [n,content]of objects){offsets[n]=length;const b=enc(`${n} 0 obj\n${content}\nendobj\n`);parts.push(b);length+=b.length;}
 const xref=length;offsets[id]=xref;
 const rows=(entries||[[1,1,'object',0],[id,1,'object',0]]).map(([n,type,first,second])=>[n,type,first==='object'?offsets[n]:first,second]);
 const ranges=index||rows.flatMap(([n])=>[n,1]);
 const body=new Uint8Array(rows.length*widths.reduce((a,b)=>a+b,0));let cursor=0;
 for(const [,type,first,second]of rows)for(const [i,value]of [type,first,second].entries())for(let shift=widths[i]-1;shift>=0;shift--)body[cursor++]=Math.floor(value/256**shift)%256;
 const text=`${id} 0 obj\n<< /Type /XRef /Size ${size} /Root ${rootRef} 0 R /W [${widths.join(' ')}] /Index [${ranges.join(' ')}] /Length ${body.length}${prev===undefined?'':` /Prev ${prev}`} >>\nstream\n`;
 parts.push(enc(text),body,enc(`\nendstream\nendobj\nstartxref\n${xref}\n%%EOF\n`));return {bytes:cat(parts),xref,offsets};
}
const ordinary=section();
const newest=opts=>section({prefix:cat([ordinary.bytes,enc('\n')]),id:4,size:5,prev:ordinary.xref,...opts});
const badOlder=section({entries:[[1,1,4294967295,0],[3,1,'object',0]]});
const objectStream='1 0 << /Value 303 >>',compressed=opts=>section({objects:[[2,`<< /Type /ObjStm /N 1 /First 4 /Length ${objectStream.length} >>\nstream\n${objectStream}\nendstream`]],entries:[[1,2,2,0],[2,1,'object',0],[3,1,'object',0]],...opts});
const cases=[
 ['ordinary sparse entries',ordinary,true,101],
 ['default entry type width0',section({widths:[0,4,2]}),true,101],
 ['default generation width0',section({widths:[1,4,0]}),true,101],
 ['both default widths',section({widths:[0,4,0]}),true,101],
 ['missing root entry',section({entries:[[3,1,'object',0]]}),false],
 ['free root entry',section({entries:[[1,0,0,0],[3,1,'object',0]]}),false],
 ['unknown entry type',section({entries:[[1,3,0,0],[3,1,'object',0]]}),false],
 ['nonzero generation',section({entries:[[1,1,'object',1],[3,1,'object',0]]}),false],
 ['unsigned offset outside PDF',section({entries:[[1,1,4294967295,0],[3,1,'object',0]]}),false],
 ['overlap within section',section({index:[1,1,1,1],entries:[[1,1,'object',0],[3,1,'object',0]]}),false],
 ['out of range section',section({index:[4,1,3,1]}),false],
 ['zero first-field width',section({widths:[1,0,2]}),false],
 ['latest repeated object supersedes old',newest({objects:[[1,'<< /Value 202 >>']]}),true,202],
 ['latest free shadows older live',newest({objects:[],entries:[[1,0,0,0],[4,1,'object',0]]}),false],
 ['latest unseen root falls back older',newest({objects:[],entries:[[4,1,'object',0]]}),true,101],
 ['invalid older row still checked despite new root',section({prefix:cat([badOlder.bytes,enc('\n')]),objects:[[1,'<< /Value 202 >>']],id:4,size:5,prev:badOlder.xref}),false],
 ['compressed object root',compressed({}),true,303],
 ['compressed owner zero',compressed({entries:[[1,2,0,0],[2,1,'object',0],[3,1,'object',0]]}),false],
 ['compressed owner outside size',compressed({entries:[[1,2,4,0],[2,1,'object',0],[3,1,'object',0]]}),false],
 ['compressed index outside group',compressed({entries:[[1,2,2,1],[2,1,'object',0],[3,1,'object',0]]}),false],
];
const read=(module,input)=>{try{const pdf=module.openPdf(input),value=pdf.object(1);return {ok:true,value,stats:pdf.stats,xref_size:pdf.xref_size};}catch(e){return {ok:false,error:e.message};}};
const checks=[];
for(const [name,item,ok,value]of cases){const a=read(old,item.bytes),b=read(next,item.bytes);assert.equal(a.ok,ok,name);if(ok)assert.equal(a.value.Value,value,name);assert.deepEqual(b,a,name);checks.push({name,pass:true,expected_acceptance:ok,input_sha256:hash(item.bytes),...(ok?{value}:{error:a.error})});}
const original=new Uint8Array(readFileSync('/tmp/mr-cqc-pdf-original/report.pdf'));
assert.equal(hash(original),'61614bff618645c52cf61405b9c6a2115854e29262d76e324513d2348e555fef');
const a=old.parseCqcPdf(original,{retrieved_at:'2026-10-20T17:56:31.747Z'}),b=next.parseCqcPdf(original,{retrieved_at:'2026-10-20T17:56:31.747Z'});assert.deepEqual(b,a);
assert.deepEqual(readFileSync(root+'/lib/cqc-pdf.js'),currentSource,'Current module unchanged during review');
const report={pass:true,recorded_at:new Date().toISOString(),base_revision:base,before_module_sha256:hash(prior),after_module_sha256:hash(currentSource),checks,control_count:checks.length,full_native_deep_equal:true,native_sha256:hash(JSON.stringify(b)),values:b.rows.map(r=>r.value),no_http:true,no_repository_writes:true,scope:'Independent local constructed xref controls and original PDF output comparison, not resource acceptance'};
const output=process.argv[2];assert.ok(output,'Fresh output path required');writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,controls:checks.length,full_native_deep_equal:true,module_sha256:report.after_module_sha256}));
