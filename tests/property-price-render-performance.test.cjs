const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{performance}=require('node:perf_hooks');
for(const file of ['src/features/properties/ManageProperty.tsx','src/features/search/SearchResults.tsx'])test(`${file}: reuse currency formatter without changing displayed prices`,t=>{
 const source=fs.readFileSync(file,'utf8'),formatter=source.match(/^const priceFormatter=.*;$/m)?.[0]||'',expression=source.match(/  const formatPrice=.*;$/m)?.[0];assert.ok(expression);
 let constructors=0;const trackedIntl={NumberFormat:function(...args){constructors++;return new Intl.NumberFormat(...args)}};
 const compiled=ts.transpile(`${formatter}\n${expression}\nreturn formatPrice;`,{target:ts.ScriptTarget.ES2022});
 const format=new Function('propertyPricing','Intl',compiled)(p=>p.pricing,trackedIntl),manage=file.includes('ManageProperty');
 const expected=p=>p.amount===null?(manage?p.label+': Not recorded':'Price not recorded'):new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(p.amount)+(p.monthly?' / month':'')+(manage?' - '+p.label:'');
 for(const pricing of [{amount:0,label:'Asking',monthly:true},{amount:125000.5,label:'Selling price',monthly:false},{amount:null,label:'Private management',monthly:false},{amount:15000,label:'Contractual',monthly:true}])assert.equal(format({pricing}),expected(pricing));
 const timings=[];for(let sample=0;sample<3;sample++){const start=performance.now();for(let i=0;i<500;i++)format({pricing:{amount:i*7919,label:'Asking',monthly:true}});timings.push(performance.now()-start);}
 t.diagnostic(JSON.stringify({formatterConstructions:constructors,median500FormattingMs:timings.sort((a,b)=>a-b)[1]}));assert.equal(constructors,1);
});
