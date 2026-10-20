// One same-route diagnosis after the retained title-guard failure.
import {NI_ENERGY_URL,NI_ENERGY_LIMIT} from '../../../lib/ni-energy.js';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const text=value=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,200).replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g,'[email omitted]').replace(/\b\d{7,}\b/g,'[number omitted]');
export default {async fetch(request){
 if(new URL(request.url).pathname!=='/diagnose-once')return new Response('Not found',{status:404});
 const started_at=new Date().toISOString();
 try{
  const response=await fetch(NI_ENERGY_URL,{redirect:'follow',headers:{accept:'text/html'},signal:AbortSignal.timeout(20000)});
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>NI_ENERGY_LIMIT)throw Error('body_bound');chunks.push(part.value);}}finally{await reader.cancel();}
  const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  const html=new TextDecoder().decode(body),titles=[...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map(m=>text(m[1])),headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>text(m[1]));
  return Response.json({started_at,finished_at:new Date().toISOString(),attempts:1,source_url:NI_ENERGY_URL,status:response.status,content_type:response.headers.get('content-type'),same_url:response.url===NI_ENERGY_URL,bytes,sha256:await hash(body),titles:titles.slice(0,4),h1_count:headings.length,headings:headings.slice(0,6),contains_publication_metadata:/<strong>\s*Publication date:\s*<\/strong>/.test(html),contains_expected_title:html.includes('Electricity Consumption and Renewable Generation in Northern Ireland'),has_challenge_markers:/cf-chl-|Just a moment|Checking your browser|Verify you are human|captcha/i.test(html),has_denial_markers:/Access Denied|Request blocked|Forbidden/i.test(html),retention:'Only public title/header classification and body digest/size retained; no raw report, footer, contact details, response headers or protected preview credential.'});
 }catch(error){return Response.json({started_at,finished_at:new Date().toISOString(),attempts:1,error:error.message==='body_bound'?'body_bound':error.name==='TimeoutError'?'timeout':'source_read_failed'},{status:502});}
}};
