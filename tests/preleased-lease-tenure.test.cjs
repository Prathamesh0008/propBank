const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
const {isolated, users, properties, request, route, context} = require('./fixtures/native-server.cjs');
const load = isolated({users}).load;
const tenure = load('@/lib/lease-tenure');
const lease = {leaseTenureMonths:960,leaseStartDate:'2020-01-01',leaseEndDate:'2099-12-31',monthlyRentalIncome:'20000',tenantOccupied:true,leaseType:'registered',existingTenant:{type:'individual',name:'Private Fixture Tenant',mobile:'9123456782',occupancyStartDate:'2020-01-01'}};
const payload = {propertyTitle:'Tenure fixture',propertyType:'residential',structure:'Apartment',configuration:'2 BHK',location:'Isolated',ownerUID:'owner',listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease};
const post = (a, body, uid='owner') => route(a,'properties').POST(request('/properties',uid,'POST',body));
const patch = (a, body, uid='owner') => route(a,'properties/[id]').PATCH(request('/properties/P',uid,'PATCH',body),context('P'));
function setup(details=lease) {return isolated({users,properties:{P:{...properties.P,listingType:'pre_leased',sellingPrice:'4000000',preLeased:structuredClone(details)}}});}

for (const [start,months,end] of [
  ['2026-01-01',12,'2026-12-31'],['2026-01-01',15,'2027-03-31'],
  ['2024-01-31',1,'2024-02-28'],['2023-01-31',1,'2023-02-27'],
  ['2024-02-29',12,'2025-02-27'],['2024-02-01',1,'2024-02-29'],['2023-02-01',1,'2023-02-28'],
]) test(`inclusive existing agreement convention: ${start} + ${months} months`, () => assert.equal(tenure.calculateLeaseEndDate(start,months),end));
test('invalid tenure and invalid civil dates cannot calculate an end', () => {
  for (const value of [undefined,null,'',0,-1,1.5,'1.5','12 months',true,NaN,Infinity,1201]) {
    assert.equal(tenure.validLeaseTenure(value),false);
    assert.equal(tenure.calculateLeaseEndDate('2024-01-01',value),'');
  }
  for (const date of ['2025-02-29','2024-04-31','01/01/2024','not-a-date']) assert.equal(tenure.calculateLeaseEndDate(date,12),'');
  assert.equal(tenure.validLeaseTenure('12'),true);
});
test('calculation is independent of browser/server timezone', () => {
  const old=process.env.TZ;
  try {for (const zone of ['UTC','Asia/Kolkata','America/Los_Angeles','Pacific/Auckland']) {process.env.TZ=zone;assert.equal(tenure.calculateLeaseEndDate('2024-02-29',12),'2025-02-27');}}
  finally {if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
for (const propertyType of ['residential','commercial']) test(`${propertyType} creation persists tenure without linking a tenant`, async () => {
  const a=isolated({users}), r=await post(a,{...payload,propertyType,structure:propertyType==='commercial'?'Office':'Apartment'});
  assert.equal(r.status,200,await r.clone().text());const body=await r.json(),p=a.state.properties[body.property.id];
  assert.equal(p.preLeased.leaseTenureMonths,960);assert.equal(p.preLeased.leaseEndDate,'2099-12-31');
  assert.equal(p.preLeased.verificationStatus,'pending');assert.equal(Object.keys(a.state.tenants||{}).length,0);
});
test('new and admin-assisted submissions require positive consistent tenure', async () => {
  for (const uid of ['owner','admin']) for(const value of [undefined,0,-1,'bad',1.5,960]) {
    const a=isolated({users}), details={...lease,leaseTenureMonths:value,...(value===960?{leaseEndDate:'2099-12-30'}:{})};
    const r=await post(a,{...payload,preLeased:details},uid);
    assert.equal(r.status,400,await r.clone().text());assert.match((await r.json()).message,/preLeased\.lease(TenureMonths|EndDate)/);
    assert.equal(Object.keys(a.state.properties||{}).length,0);
  }
});
test('legacy unrelated edits and complete legacy payloads preserve historical dates without inventing tenure', async () => {
  const legacy={...lease,leaseEndDate:'2099-12-30'};delete legacy.leaseTenureMonths;
  const a=setup(legacy);
  for (const body of [{description:'Unrelated edit'},{preLeased:{...legacy,monthlyRentalIncome:'21000'}}]) {
    const r=await patch(a,body);assert.equal(r.status,200,await r.clone().text());
    assert.equal(a.state.properties.P.preLeased.leaseTenureMonths,undefined);assert.equal(a.state.properties.P.preLeased.leaseEndDate,legacy.leaseEndDate);
  }
});
test('legacy lease date edits require tenure; explicit tenure cannot be removed or contradicted', async () => {
  const legacy={...lease};delete legacy.leaseTenureMonths;
  for (const [prior,details] of [[legacy,{...legacy,leaseEndDate:'2099-12-30'}],[lease,legacy],[lease,{...lease,leaseTenureMonths:959}],[lease,{...lease,leaseStartDate:'2020-02-01'}]]) {
    const a=setup(prior), before=structuredClone(a.state.properties.P);
    const r=await patch(a,{preLeased:details});assert.equal(r.status,400,await r.clone().text());
    assert.deepEqual(a.state.properties.P,before);
  }
});
test('owner/admin updates persist matched dates and tenure, keep tenant privacy and invalidate claimed verification', async () => {
  for (const uid of ['owner','admin']) {
    const a=setup(),r=await patch(a,{preLeased:{...lease,leaseTenureMonths:'959',leaseEndDate:'2099-11-30',verificationStatus:'verified'}},uid);
    assert.equal(r.status,200,await r.clone().text());assert.equal(a.state.properties.P.preLeased.leaseTenureMonths,959);
    assert.equal(a.state.properties.P.preLeased.verificationStatus,'pending');
    const read=await route(a,'properties/[id]').GET(request('/properties/P',uid),context('P'));
    assert.equal((await read.json()).property.preLeased.leaseTenureMonths,959);
  }
});
test('unrelated owner/tenant writes remain denied and public responses contain no private tenant', async () => {
  for (const uid of ['other','tenant',null]) {
    const a=setup(),r=await patch(a,{preLeased:{...lease,leaseTenureMonths:959,leaseEndDate:'2099-11-30'}},uid);
    assert.ok([401,403].includes(r.status));assert.equal(a.state.properties.P.preLeased.leaseTenureMonths,960);
  }
  const a=setup();Object.assign(a.state.properties.P,{moderationStatus:'approved',isActive:true,isRented:false,isSold:false});
  const r=await route(a,'properties/[id]').GET(request('/properties/P'),context('P'));assert.equal(r.status,200);
  assert.ok(!JSON.stringify(await r.json()).includes('Private Fixture Tenant'));
});
test('legacy tenure labels infer only exact matches, never mutate saved dates', () => {
  const legacy={...lease};delete legacy.leaseTenureMonths;const before=JSON.stringify(legacy);
  assert.equal(tenure.leaseTenureLabel(lease),'960 months');assert.equal(tenure.leaseTenureLabel(legacy),'960 months (from recorded dates)');
  assert.equal(tenure.leaseTenureLabel({...legacy,leaseEndDate:'2099-12-30'}),'Not recorded');
  assert.equal(JSON.stringify(legacy),before);
});
test('all shared summaries express explicit tenure in months, including complete years', () => {
  for (const [months,label] of [[1,'1 month'],[12,'12 months'],[15,'15 months'],[1200,'1200 months']]) {
    assert.equal(tenure.leaseTenureLabel({...lease,leaseTenureMonths:months}),label);
  }
  for (const file of ['src/features/admin/AdminPropertyDetailsDialog.tsx','src/features/properties/ManageProperty.tsx','src/features/properties/PropertyPurposeSummary.tsx']) assert.match(fs.readFileSync(file,'utf8'),/leaseTenureLabel\(/);
});

function uiLoader(){const cache=new Map();return function ui(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.tsx')?'.tsx':'.ts';if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const scoped=name=>{if(name.endsWith('.module.css'))return {__esModule:true,default:{}};if(name.startsWith('@/'))return ui(path.resolve('src',name.slice(2)));if(name.startsWith('.'))return ui(path.resolve(path.dirname(file),name));return require(name);};new Function('require','exports',code)(scoped,out);return out;};}
const ui=uiLoader();
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);return tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function formFixture(details={}) {const values={listingType:'pre_leased',sellingPrice:'4000000',preLeased:{...details}},changes=[];return {values,changes,watch:key=>key.split('.').reduce((o,k)=>o?.[k],values),setValue(key,value){changes.push([key,value]);const parts=key.split('.');let obj=values;for(const k of parts.slice(0,-1))obj=obj[k]??={};obj[parts.at(-1)]=value;}};}
test('actual shared residential/commercial form spans its grid and tenure precedes date inputs', () => {
  const Fields=ui('src/features/properties/PropertyPurposeFields.tsx').default;
  const tree=Fields({form:formFixture(lease)}),html=renderToStaticMarkup(tree);
  assert.match(tree.props.className,/col-span-full/);assert.match(html,/grid-cols-1 gap-4 sm:grid-cols-2/);
  assert.ok(html.indexOf('Lease Tenure (in Months)')<html.indexOf('Lease start date'));
  assert.match(html,/Lease Tenure \(in Months\) \*/);assert.match(html,/placeholder="Enter tenure in months"/);
  assert.match(html,/type="number"[^>]*aria-label="Lease Tenure \(in Months\)"/);
  assert.match(html,/min="1" max="1200" step="1"/);assert.doesNotMatch(html,/Lease tenure years|Lease tenure months|Select years|Select months/);
  assert.match(html,/value="01\/01\/2020"/);assert.match(html,/value="31\/12\/2099"/);
  assert.equal(ui('src/features/properties/PropertyPurposeFields.tsx').purposeFormSchema.preLeased.parse(lease).leaseTenureMonths,960);
});
test('months input and start-date handlers recalculate without resetting unrelated form values', () => {
  const Fields=ui('src/features/properties/PropertyPurposeFields.tsx').default,form=formFixture({...lease,leaseStartDate:'2024-01-31',leaseTenureMonths:12});
  let tree=Fields({form});nodes(tree).find(n=>n.props?.['aria-label']==='Lease Tenure (in Months)').props.onChange({target:{value:'1'}});
  assert.equal(form.values.preLeased.leaseEndDate,'2024-02-28');
  tree=Fields({form});const field=nodes(tree).find(n=>n.props?.children?.[0]==='Lease start date');field.props.children.find(n=>n?.props?.onChange).props.onChange({target:{value:'2024-02-01'}});
  assert.equal(form.values.preLeased.leaseEndDate,'2024-02-29');assert.equal(form.values.preLeased.existingTenant.name,lease.existingTenant.name);
  assert.equal(form.values.sellingPrice,'4000000');
});
test('numeric entry retains strict whole-month validation and the existing supported bounds', () => {
  const Fields=ui('src/features/properties/PropertyPurposeFields.tsx').default;
  for(const value of ['0','-1','1.5','1e2','1201','']) {
    const form=formFixture(lease),tree=Fields({form});
    nodes(tree).find(n=>n.props?.['aria-label']==='Lease Tenure (in Months)').props.onChange({target:{value}});
    assert.equal(form.values.preLeased.leaseTenureMonths,value);
    assert.equal(form.values.preLeased.leaseEndDate,'');
    assert.ok(tenure.leaseTenureError(form.values.preLeased));
  }
  assert.equal(tenure.validLeaseTenure('1200'),true);
});
test('loading legacy edit is read-only to form state until the owner explicitly changes tenure', () => {
  const legacy={...lease};delete legacy.leaseTenureMonths;
  const form=formFixture(legacy),Fields=ui('src/features/properties/PropertyPurposeFields.tsx').default;
  const html=renderToStaticMarkup(Fields({form,existingLease:legacy}));
  assert.deepEqual(form.changes,[]);assert.match(html,/Existing dates are preserved/);
  assert.equal(form.values.preLeased.leaseEndDate,'2099-12-31');
  const ordinary=formFixture();ordinary.values.listingType='rent';assert.equal(Fields({form:ordinary}),null);
});
