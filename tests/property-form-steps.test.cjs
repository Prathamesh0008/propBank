const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {isolated}=require('./fixtures/native-server.cjs');
const owner=fs.readFileSync('src/features/properties/AddPropertyForm.tsx','utf8');
const tenant=fs.readFileSync('src/features/properties/TenantPropertyForm.tsx','utf8');
function callback(source,name,context){
 const ast=ts.createSourceFile('form.tsx',source,99,true,4);let initializer;
 function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name)initializer=node.initializer.getText(ast);ts.forEachChild(node,walk);}walk(ast);
 assert.ok(initializer,name);return vm.runInNewContext(ts.transpileModule('('+initializer+')',{compilerOptions:{target:99,module:1}}).outputText,context);
}
function ownerCheck(category='residential',extra={}){
 const errors={},messages=[];const lib=isolated();
 const check=callback(owner,'validateOwnerStep',{selectedPropertyType:category,accountRole:'individual',addNextAgreementManually:false,nextAgreementDraft:{},form:{setError:(key,value)=>errors[key]=value},validationToast:value=>messages.push(value),setWizardError:value=>messages.push(value),structureUsesPlotArea:lib.load('@/lib/property-category').structureUsesPlotArea,normalizePurpose:lib.load('@/lib/property-purpose').normalizePurpose,validateNextAgreementDraft:lib.load('@/lib/next-agreement-draft').validateNextAgreementDraft,...extra});
 return {check,errors,messages};
}
test('owner validates only the current applicable step for all categories and purposes',()=>{
 for(const category of ['residential','commercial','industrial'])for(const listingType of ['rent','sell','pre_leased','manage']){
  const h=ownerCheck(category),data={structure:category==='residential'?'Flat':category==='commercial'?'Office':'Warehouse',configuration:'2 BHK',listingType,rentalStatus:'available'};
  assert.equal(h.check(data,1),true,category+' '+listingType);
  assert.equal(h.check(data,3),true);assert.equal(h.check(data,5),true);
  if(['rent','sell','pre_leased'].includes(listingType))assert.equal(h.check(data,2),false);
  else assert.equal(h.check(data,2),true);
 }
});
test('owner asking rent, zero deposit, sold buyer, and occupied tenancy checks are preserved',()=>{
 let h=ownerCheck(),data={structure:'Flat',configuration:'2 BHK',listingType:'rent',rentalStatus:'available',expectedRent:'25000',securityDeposit:'0'};
 assert.equal(h.check(data,2),true);assert.equal(h.check({...data,expectedRent:'0'},2),false);
 h=ownerCheck();assert.equal(h.check({...data,listingType:'sell',sellingPrice:'7000000',saleStatus:'sold'},2),false);assert.ok(h.errors.buyerFirstName);
 h=ownerCheck();assert.equal(h.check({...data,rentalStatus:'rented',monthlyRent:'30000'},2),true);assert.equal(h.check({...data,rentalStatus:'rented'},4),false);assert.ok(h.errors.tenantFirstName);
 const occupied={...data,rentalStatus:'rented',tenantFirstName:'Synthetic',tenantLastName:'Tenant',mobileNumber:'9876543210',tenantEmail:'tenant@example.invalid',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31',paymentDueDate:'5'};
 assert.equal(h.check(occupied,4),true);assert.equal(h.check({...occupied,tenantEmail:''},4),false);
});
test('pre-leased validation reuses the canonical tenure and active-lease validation',()=>{
 const lib=isolated(),{calculateLeaseEndDate}=lib.load('@/lib/lease-tenure');
 const today=new Date().toISOString().slice(0,10),year=Number(today.slice(0,4)),start=(year-1)+'-01-01',duration=60;
 const data={structure:'Flat',configuration:'2 BHK',listingType:'pre_leased',sellingPrice:'8000000',preLeased:{existingTenant:{type:'individual',name:'Synthetic Tenant',mobile:'9876543210',occupancyStartDate:start},tenantOccupied:true,monthlyRentalIncome:'30000',leaseTenureMonths:duration,leaseStartDate:start,leaseEndDate:calculateLeaseEndDate(start,duration),leaseType:'registered'}};
 assert.equal(ownerCheck().check(data,2),true);assert.equal(ownerCheck().check({...data,preLeased:{...data.preLeased,leaseEndDate:'2000-01-01'}},2),false);
});
function tenantCheck(extra={}){
 const lib=isolated();return callback(tenant,'validationError',{createdPropertyId:'',category:'residential',values:{structure:'Flat',configuration:'2 BHK',agreementPeriod:'12',agreementStartDate:'2028-02-29',agreementEndDate:'2029-02-27'},address:{structured:{streetLocality:'Synthetic Lane',city:'Pune',state:'Maharashtra',postalCode:'411001',country:'India'},legacyText:''},owner:{companyName:'Synthetic Owner',phone:'9876543210'},rentSchedule:[],structureUsesPlotArea:lib.load('@/lib/property-category').structureUsesPlotArea,resolvePropertyAddress:lib.load('@/lib/property-address').resolvePropertyAddress,indianMobile:lib.load('@/lib/indian-phone').indianMobile,...lib.load('@/lib/rent-schedule'),...extra});
}
test('tenant steps do not demand later owner or rent fields and preserve date validation',()=>{
 const check=tenantCheck({owner:{}});assert.equal(check(1),'');assert.equal(check(2),'');assert.match(check(3),/positive monthly rent/);assert.match(check(4),/owner or company/);
 assert.match(tenantCheck({values:{agreementPeriod:'12',agreementStartDate:'2028-02-29',agreementEndDate:'2029-02-28'}})(2),/dates must match/);
 assert.match(tenantCheck({address:{structured:{city:'Pune'},legacyText:''}})(1),/address/i);
 assert.equal(tenantCheck({createdPropertyId:'already-saved',values:{},owner:{}})(4),'');
});
test('tenant schedule retains coverage validation, partial schedules cannot advance',()=>{
 const row={year:'1st Year',months:'12',amount:'25000',fromDate:'2028-02-29',toDate:'2029-02-27'};
 assert.equal(tenantCheck({rentSchedule:[row]})(3),'');
 assert.match(tenantCheck({rentSchedule:[{...row,toDate:'2028-12-31'}]})(3),/entire agreement|gaps|month|dates/i);
 assert.match(tenantCheck({owner:{companyName:'Synthetic Owner',phone:'123'}})(4),/mobile/);
});
test('final submission routes invalid fields back and synchronous lock prevents duplicate submissions',async()=>{
 for(const [source,isOwner] of [[owner,true],[tenant,false]]){
  const lock={current:false},steps=[],calls=[];let release;
  const pending=new Promise(resolve=>release=resolve);
  const context={wizardStep:6,submitLock:lock,busy:false,uploading:false,isUploading:false,isInternalUploading:false,wizardForm:{current:null},checkStep:()=>true,setWizardStep:step=>steps.push(step),nextStep:()=>{throw Error('unexpected Next')},form:{handleSubmit:handler=>handler},onSubmit:async()=>{calls.push('create');await pending;},submit:async()=>{calls.push('create');await pending;}};
  const handler=callback(source,'submitWizard',context),event={preventDefault(){}};
  const first=handler(event);await handler(event);assert.equal(calls.length,1);release();await first;assert.equal(lock.current,false);
  context.checkStep=step=>step!==3;await callback(source,'submitWizard',context)(event);assert.deepEqual(steps,[3]);assert.equal(calls.length,1,isOwner?'owner':'tenant');
  context.wizardStep=2;let next=0;context.nextStep=()=>next++;await callback(source,'submitWizard',context)(event);assert.equal(next,1);assert.equal(calls.length,1);
 }
});
test('all panels remain mounted, navigation is non-submit, canonical upload/retry paths remain singular',()=>{
 for(const source of [owner,tenant]){
  assert.equal((source.match(/<form\b/g)||[]).length,1);assert.equal((source.match(/<PropertyStepPanel number=/g)||[]).length,6);
  assert.equal((source.match(/method:\s*['"]POST['"]/g)||[]).length,1);
 }
 const shared=fs.readFileSync('src/features/properties/PropertyFormSteps.tsx','utf8');assert.match(shared,/hidden=\{step!==number\}/);assert.doesNotMatch(shared,/step===number\s*&&/);assert.match(shared,/type="button"[^>]+onClick=\{onNext\}/);assert.match(shared,/type="button"[^>]+onClick=\{onBack\}/);
 assert.match(tenant,/let propertyId=createdPropertyId;if\(!propertyId\)/);assert.match(tenant,/setSupportingDocuments\(failed\)/);assert.match(tenant,/setWizardStep\(5\);setError\(`Property saved/);assert.match(tenant,/selected locally, not yet uploaded/);
 assert.match(owner,/adminOwnerUID/);assert.match(owner,/uploadSupportingDocument/);assert.match(owner,/activeFurnishedItems/);
});
test('tenant post-creation document retry uses the saved property and the original idempotency key',async()=>{
 const lib=isolated(),ast=ts.createSourceFile('tenant.tsx',tenant,99,true,4);let declaration;
 function walk(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='submit')declaration=node.getText(ast);ts.forEachChild(node,walk);}walk(ast);
 const requests=[],uploads=[],messages=[],steps=[];let fail=true;
 const context={busy:false,user:{displayName:'Synthetic Tenant',email:'tenant@example.invalid'},createdPropertyId:'',category:'commercial',values:{propertyTitle:'Synthetic',structure:'Office',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31'},address:{structured:{},legacyText:'Synthetic legacy address'},rentSchedule:[{amount:'25000'}],owner:{personName:'Synthetic Owner',phone:'9876543210'},images:[],checklist:[],supportingDocuments:[{key:'stable-file-key',file:{name:'synthetic.pdf'},documentType:'rental_agreement'}],validationError:()=>'',setError:message=>messages.push(message),setOwnerEmailError:()=>{},setBusy:value=>context.busy=value,setWizardStep:step=>steps.push(step),setCreatedPropertyId:value=>context.createdPropertyId=value,setSupportingDocuments:items=>context.supportingDocuments=items,cache:{invalidateQueries:async()=>{}},navigate:path=>requests.push({navigation:path}),structureUsesPlotArea:()=>false,resolvePropertyAddress:lib.load('@/lib/property-address').resolvePropertyAddress,apiFetch:async(path,init)=>{requests.push({path,body:JSON.parse(init.body)});return new Response(JSON.stringify({success:true,property:{id:'SYNTHETIC_SAVED'}}));},readPropertyResponse:async response=>response.json(),uploadSupportingDocument:async(id,file,type,key)=>{uploads.push({id,key});if(fail)throw Error('Synthetic upload failure');},PropertySubmissionError:class extends Error{},Error};
 const submit=vm.runInNewContext(ts.transpileModule(declaration+'\nsubmit;',{compilerOptions:{target:99,module:1}}).outputText,context);
 await submit({preventDefault(){}});assert.equal(context.createdPropertyId,'SYNTHETIC_SAVED');assert.deepEqual(steps,[5]);assert.match(messages.at(-1),/saved successfully.*could not be uploaded/);assert.equal(context.supportingDocuments.length,1);
 fail=false;await submit({preventDefault(){}});assert.equal(requests.filter(item=>item.path==='/api/properties').length,1);assert.deepEqual(uploads,[{id:'SYNTHETIC_SAVED',key:'stable-file-key'},{id:'SYNTHETIC_SAVED',key:'stable-file-key'}]);assert.equal(context.supportingDocuments.length,0);assert.equal(requests.at(-1).navigation,'/manage-property?tab=tenant');
});
test('owner optional next-agreement draft is checked in occupancy, not purpose or media',()=>{
 const h=ownerCheck('commercial',{addNextAgreementManually:true,validateNextAgreementDraft:()=> 'Synthetic next agreement needs a date.'});
 const data={structure:'Office',listingType:'rent',rentalStatus:'available',expectedRent:'25000',securityDeposit:'0'};
 assert.equal(h.check(data,2),true);assert.equal(h.check(data,4),false);assert.equal(h.check(data,5),true);
});
