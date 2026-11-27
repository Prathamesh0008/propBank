const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {isolated}=require('./fixtures/native-server.cjs');
function compile(path,requireModule){const output={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(output,requireModule);return output;}
test('sorting resolves each price once, skips recommended pricing, preserves ties, unknowns and inputs',()=>{
 let calls=0;const app=isolated(),lib=compile('src/features/search/discovery-filters.ts',name=>name.endsWith('property-presentation')?{propertyPricing:p=>{calls++;return {amount:p.amount}}}:app.load(name));
 const rows=[{id:'a',amount:20},{id:'b',amount:null},{id:'c',amount:10},{id:'d',amount:20},{id:'e',amount:null}],original=[...rows];
 const recommended=lib.sortDiscoveryProperties(rows,'recommended');assert.deepEqual(recommended,rows);assert.notEqual(recommended,rows);assert.equal(calls,0);
 assert.deepEqual(lib.sortDiscoveryProperties(rows,'price-low').map(p=>p.id),['c','a','d','b','e']);assert.equal(calls,rows.length);
 calls=0;assert.deepEqual(lib.sortDiscoveryProperties(rows,'price-high').map(p=>p.id),['a','d','c','b','e']);assert.equal(calls,rows.length);assert.deepEqual(rows,original);
});
test('only contractual pricing resolves the current date; explicit billing dates and multiple contracts remain intact',()=>{
 let dates=0;const received=[],app=isolated();const lib=compile('src/lib/property-presentation.ts',name=>name==='./rent-resolution'?{localRentDate:()=>{dates++;return '2026-11-27'},resolveRent:(property,day,tenant)=>{received.push({day,tenant});return {amount:15000}}}:app.load('@/lib/'+name.replace('./','')));
 for(const property of [{listingType:'manage'},{listingType:'sell',sellingPrice:200000},{listingType:'pre_leased',sellingPrice:300000},{listingType:'rent',expectedRent:10000},{listingType:'rent',tenants:[{isActive:true},{isActive:true}]}])lib.propertyPricing(property);
 assert.equal(dates,0);assert.equal(received.length,0);
 const property={listingType:'rent',rentalStatus:'rented'};assert.equal(lib.propertyPricing(property).amount,15000);assert.equal(dates,1);assert.equal(received[0].day,'2026-11-27');lib.propertyPricing(property,'2026-12-01');assert.equal(dates,1);assert.equal(received[1].day,'2026-12-01');
});
test('Property Details uses the existing fresh authenticated summary for its role-only lookup',()=>{const source=fs.readFileSync('src/features/properties/PropertyDetails.tsx','utf8');assert.match(source,/apiFetch\(`\$\{API_BASE_URL\}\/users\/\$\{currentUser.uid\}\?summary=true`\)/);});
