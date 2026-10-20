import test from 'node:test';
import assert from 'node:assert/strict';
import {PdfLexer} from '../lib/cqc-pdf.js';

const encode=text=>new TextEncoder().encode(text);
const lexer=(text,options)=>new PdfLexer(encode(text),options);
const read=text=>lexer(text).next();
const word=value=>({kind:'word',value});

test('PDF integer tokens preserve signs, leading zeroes and exact safe boundaries',()=>{
 for(const [text,expected] of [
  ['0',0],['+0',0],['-0',-0],['000',0],['-000',-0],['+000123',123],
  ['9007199254740991',Number.MAX_SAFE_INTEGER],['-9007199254740991',-Number.MAX_SAFE_INTEGER],
  ['0'.repeat(112)+'9007199254740991',Number.MAX_SAFE_INTEGER],
 ])assert.ok(Object.is(read(text),expected),text);
 for(const text of ['9007199254740992','-9007199254740992','9'.repeat(128)])
  assert.throws(()=>read(text),/^Error: Bounded PDF: Unsafe number$/);
});

test('decimal grammar and malformed integer-prefix words retain their meaning',()=>{
 for(const [text,expected] of [['1.',1],['.5',.5],['-.5',-.5],['+01.50',1.5],['-0.',-0]])
  assert.ok(Object.is(read(text),expected),text);
 for(const text of ['+','-','--1','+x','12e2','1.2.3','9007199254740992x','9'.repeat(127)+'x'])
  assert.deepEqual(read(text),word(text));
 assert.equal(read('true'),true);assert.equal(read('false'),false);assert.equal(read('null'),null);
});

test('token length and token budget retain their refusal order and consumed positions',()=>{
 const accepted=lexer('0'.repeat(128));assert.equal(accepted.next(),0);assert.equal(accepted.pos,128);assert.equal(accepted.tokens,1);
 for(const text of ['0'.repeat(129),'9'.repeat(129),'x'.repeat(129)]){
  const l=lexer(text);assert.throws(()=>l.next(),/Token length exceeded/);assert.equal(l.pos,129);assert.equal(l.tokens,1);
 }
 const limited=lexer('  '+ '9'.repeat(129),{maxTokens:0});
 assert.throws(()=>limited.next(),/Token limit exceeded/);assert.equal(limited.pos,2);assert.equal(limited.tokens,1);
});

test('indirect-reference lookahead preserves rollback, token count and invalid-generation refusal',()=>{
 const reference=lexer('001 0 R');assert.deepEqual(reference.value(),{kind:'ref',id:1,generation:0});reference.complete();assert.equal(reference.tokens,3);
 const number=lexer('-0 2 x');assert.ok(Object.is(number.value(),-0));assert.equal(number.pos,2);assert.equal(number.tokens,3);assert.equal(number.next(),2);
 for(const text of ['0 0 R','1 1 R'])assert.throws(()=>lexer(text).value(),/Unsupported indirect reference generation/);
});

test('hex strings recognize exactly ASCII hex digits and PDF whitespace',()=>{
 const white=new Set([0,9,10,12,13,32]),digits='0123456789ABCDEFabcdef';
 for(let byte=0;byte<256;byte++){
  const l=new PdfLexer(Uint8Array.of(60,byte,62));
  if(byte===62)assert.deepEqual(l.next().bytes,new Uint8Array());
  else if(byte===60)assert.deepEqual(l.next(),{kind:'delimiter',value:'<<'});
  else if(white.has(byte))assert.deepEqual(l.next().bytes,new Uint8Array());
  else if(digits.includes(String.fromCharCode(byte)))assert.deepEqual(l.next().bytes,Uint8Array.of(parseInt(String.fromCharCode(byte),16)*16));
  else assert.throws(()=>l.next(),/Invalid hexadecimal string/);
 }
 assert.deepEqual(read('<4a 6F 7>').bytes,Uint8Array.of(74,111,112));
});

test('hex truncation and existing length-bound behavior retain exact refusal positions',()=>{
 const invalid=lexer('<0G>');assert.throws(()=>invalid.next(),/Invalid hexadecimal string/);assert.equal(invalid.pos,3);
 const truncated=lexer('<00');assert.throws(()=>truncated.next(),/Unterminated hexadecimal string/);assert.equal(truncated.pos,3);
 const exceeded=lexer('<0011>',{maxString:1});assert.throws(()=>exceeded.next(),/Hex string limit exceeded/);assert.equal(exceeded.pos,5);
 assert.deepEqual(lexer('<001>',{maxString:1}).next().bytes,Uint8Array.of(0,16));
});

test('escaped names preserve all decoded-byte restrictions and both hex cases',()=>{
 for(let byte=0;byte<256;byte++){
  for(const hex of [byte.toString(16).padStart(2,'0'),byte.toString(16).padStart(2,'0').toUpperCase()]){
   const l=lexer('/X#'+hex);
   if(byte>0&&byte<128)assert.deepEqual(l.next(),{kind:'name',value:'X'+String.fromCharCode(byte)});
   else assert.throws(()=>l.next(),/Unsupported name character/);
  }
 }
 for(const text of ['/X#0','/X#'])assert.throws(()=>read(text),/Truncated escaped name/);
 for(const text of ['/X#G0','/X#0G']){const l=lexer(text);assert.throws(()=>l.next(),/Invalid escaped name/);assert.equal(l.pos,3);}
});

test('escaped-name aliases remain duplicate dictionary keys and names remain bounded',()=>{
 assert.throws(()=>lexer('<< /A true /#41 false >>').value(),/Invalid or duplicate dictionary key/);
 assert.equal(read('/'+'#41'.repeat(256)).value.length,256);
 assert.throws(()=>read('/'+'#41'.repeat(257)),/Name limit exceeded/);
});

test('array token handoff preserves depth-before-budget refusal and skipped positions',()=>{
 const depth=lexer('[ % comment\n 1 ]',{maxDepth:0,maxTokens:2});
 assert.throws(()=>depth.value(),/Value nesting exceeded/);assert.equal(depth.pos,1);assert.equal(depth.tokens,2);
 const budget=lexer('[ % comment\n 1 ]',{maxDepth:1,maxTokens:2});
 assert.throws(()=>budget.value(),/Token limit exceeded/);assert.equal(budget.pos,13);assert.equal(budget.tokens,3);
 const l=lexer('[1 0 R [<41> /N true null] -0]');
 const value=l.value();l.complete();
 assert.deepEqual(value.slice(0,2),[{kind:'ref',id:1,generation:0},[{kind:'string',bytes:Uint8Array.of(65)},{kind:'name',value:'N'},true,null]]);
 assert.ok(Object.is(value[2],-0));
});

test('array handoff retains malformed-token refusals and bounded coverage',()=>{
 for(const [text,error] of [
  ['[word]','Unexpected token as PDF value'],['[1','Unterminated array'],
  ['[<0G>]','Invalid hexadecimal string'],['[1 1 R]','Unsupported indirect reference generation'],
  ['[<< /A true /#41 false >>]','Invalid or duplicate dictionary key'],
 ])assert.throws(()=>lexer(text).value(),new RegExp(error));
 const l=lexer('['+'true '.repeat(32768)+']');assert.equal(l.value().length,32768);l.complete();
 assert.throws(()=>lexer('['+'true '.repeat(32769)+']').value(),/Array limit exceeded/);
});
