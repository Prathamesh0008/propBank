const assert=require('node:assert/strict');
const {test}=require('node:test');
const {isolated}=require('./fixtures/native-server.cjs');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const words=()=>isolated().load('@/lib/amount-to-words').amountToWords;

test('Indian currency words cover rupees, lakh, crore and paise without floating point parsing',()=>{
 const convert=words();
 for(const [input,expected] of [
  ['', ''],['0','Zero Rupees Only'],['1','One Rupee Only'],['1000','One Thousand Rupees Only'],
  ['25000','Twenty Five Thousand Rupees Only'],['125000','One Lakh Twenty Five Thousand Rupees Only'],
  ['1500000','Fifteen Lakh Rupees Only'],['25000000','Two Crore Fifty Lakh Rupees Only'],
  ['1250.50','One Thousand Two Hundred Fifty Rupees and Fifty Paise Only'],
  ['1,25,000.05','One Lakh Twenty Five Thousand Rupees and Five Paise Only'],
  ['9999999999','Nine Hundred Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Rupees Only'],
 ])assert.equal(convert(input),expected,String(input));
});

test('invalid, negative, incomplete, over-precision and unsupported large values stay hidden',()=>{
 const convert=words();for(const input of [null,undefined,'abc','-1','12.','12.345','10,00x','1,,2','12,34','10000000000',NaN,Infinity])assert.equal(convert(input),'',String(input));
});

test('AmountInWords renders subtle accessible text and hides empty or invalid values',()=>{
 const file=path.resolve('src/components/AmountInWords.tsx');
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const output={};new Function('require','exports',code)(name=>name==='@/lib/amount-to-words'?{amountToWords:words()}:require(name),output);
 const Component=output.default;
 const html=renderToStaticMarkup(React.createElement(Component,{amount:'125000'}));
 assert.match(html,/text-\[11px\]/);assert.match(html,/aria-live="off"/);assert.match(html,/One Lakh Twenty Five Thousand Rupees Only/);
 assert.equal(renderToStaticMarkup(React.createElement(Component,{amount:''})),'');
 assert.equal(renderToStaticMarkup(React.createElement(Component,{amount:'12.'})),'');
});
