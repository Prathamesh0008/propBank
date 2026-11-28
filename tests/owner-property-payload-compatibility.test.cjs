const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {z}=require('zod'),{zodResolver}=require('@hookform/resolvers/zod');
const {isolated}=require('./fixtures/native-server.cjs');
const source=fs.readFileSync('src/features/properties/AddPropertyForm.tsx','utf8');
function initializer(text,name){const tree=ts.createSourceFile('fixture.tsx',text,99,true,4);let result;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===name)result=node.initializer.getText(tree);ts.forEachChild(node,walk);}walk(tree);assert.ok(result,name);return result;}
function evaluate(expression,scope){return vm.runInNewContext(ts.transpileModule('('+expression+')',{compilerOptions:{target:99,module:1}}).outputText,scope);}
const lib=isolated();
const client=fs.readFileSync('src/features/properties/ClientPropertyFields.tsx','utf8');
const schemaFields=evaluate(initializer(client,'schemaFields'),{});
const clientPropertySchema=evaluate(initializer(client,'clientPropertySchema'),{z,schemaFields});
const purposeFormSchema=evaluate(initializer(fs.readFileSync('src/features/properties/PropertyPurposeFields.tsx','utf8'),'purposeFormSchema'),{z});
const formSchema=evaluate(initializer(source,'formSchema'),{z,clientPropertySchema,purposeFormSchema,...lib.load('@/lib/property-address')});
function resolver(role='individual'){
 const tree=ts.createSourceFile('form.tsx',source,99,true,4);let expression;function walk(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useForm')expression=node.arguments[0].properties.find(p=>p.name?.getText(tree)==='resolver').initializer.getText(tree);ts.forEachChild(node,walk);}walk(tree);
 return evaluate(expression,{zodResolver,formSchema,accountRole:role,adminIntake:false});
}
const options={criteriaMode:'firstError',fields:{},shouldUseNativeValidation:false};
const lease={existingTenant:{type:'individual',name:'Synthetic Tenant',mobile:'9123456782',email:'tenant@example.invalid',occupancyStartDate:'2020-01-01'},tenantOccupied:true,monthlyRentalIncome:'20000',leaseTenureMonths:948,leaseStartDate:'2020-01-01',leaseEndDate:'2098-12-31',leaseType:'registered',securityDeposit:'0',paymentFrequency:'monthly'};
function fixture(category,listingType){return {propertyTitle:'Synthetic compatibility property',propertyType:category,propertyCategory:category,structure:category==='residential'?'Flat':category==='commercial'?'Office':'Unit',configuration:category==='residential'?'2 BHK':'',listingType,location:'Synthetic address',rentalStatus:'available',expectedRent:'25000',securityDeposit:'0',sellingPrice:'8000000',saleStatus:'available',tenantFirstName:'',tenantLastName:'',tenantEmail:'',agentOwnerEmail:'',images:[],internalImages:[],unitCondition:'unfurnished',...(listingType==='pre_leased'?{preLeased:lease}:{})};}
async function submit(data,category,extra={}){
 const requests=[],navigation=[],errors=[];
 const scope={...lib.load('@/lib/property-purpose'),...lib.load('@/lib/property-category'),...lib.load('@/lib/property-furnishing'),...lib.load('@/lib/next-agreement-draft'),adminIntake:false,selectedPropertyType:category,accountRole:'individual',adminOwnerUID:'',addNextAgreementManually:false,nextAgreementDraft:{},auth:{currentUser:{uid:'synthetic-owner'}},form:{setError:(name,error)=>errors.push({name,error})},toast:message=>{if(message.variant==='destructive')errors.push(message);},setWizardError:()=>{},goStep:()=>{},wizardForm:{current:null},furnishedChecklist:[],uploadedImages:[],uploadedInternalImages:[],leaseFiles:{},API_BASE_URL:'/api',apiFetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({success:true,property:{id:'SYNTHETIC'}}));},readPropertyResponse:response=>response.json(),queryClient:{invalidateQueries:async()=>{}},navigate:url=>navigation.push(url),PropertySubmissionError:class extends Error{},Error,...extra};
 scope.validationToast=scope.toast;scope.validateOwnerStep=evaluate(initializer(source,'validateOwnerStep'),scope);
 await evaluate(initializer(source,'onSubmit'),scope)(data);
 return {requests,navigation,errors,scope};
}
test('non-pre-leased Owner submissions omit lease keys, including after changing purpose',async()=>{
 for(const category of ['residential','commercial','industrial'])for(const purpose of ['rent','sell','manage','sell_rent'])for(const previous of ['absent',undefined,null,lease,{existingTenant:{email:123}}]){
  const values=fixture(category,purpose);if(previous!=='absent')values.preLeased=previous;
  const result=await resolver()(values,undefined,options);assert.deepEqual(Object.keys(result.errors),[]);
  assert.equal(Object.hasOwn(result.values,'preLeased'),false,category+'/'+purpose);
  const sent=await submit(result.values,category);assert.equal(sent.requests.length,1,JSON.stringify(sent.errors));
  const body=sent.requests[0].body;assert.equal(sent.requests[0].url,'/api/properties');assert.equal(body.ownerUID,'synthetic-owner');assert.equal(body.propertyCategory,category);assert.equal(Object.hasOwn(body,'preLeased'),false);
  // To Manage already explicitly set this flag before the six-step conversion.
  assert.equal(Object.hasOwn(body,'isPreLeased'),purpose==='manage');
  assert.equal(Object.hasOwn(values,'preLeased'),previous!=='absent');if(previous!=='absent')assert.equal(values.preLeased,previous);
  assert.deepEqual(sent.navigation,['/manage-property']);
 }
});
test('active Pre-Leased Sale retains and normalizes the required lease payload',async()=>{
 for(const category of ['residential','commercial','industrial']){
  const values=fixture(category,'pre_leased'),result=await resolver()(values,undefined,options);assert.deepEqual(Object.keys(result.errors),[]);assert.equal(result.values.preLeased.leaseTenureMonths,948);
  const sent=await submit(result.values,category);assert.equal(sent.requests.length,1,JSON.stringify(sent.errors));const body=sent.requests[0].body;
  assert.equal(body.isPreLeased,true);assert.equal(body.preLeased.existingTenant.name,'Synthetic Tenant');assert.equal(body.preLeased.leaseTenureMonths,948);assert.equal(body.preLeased.verificationStatus,'pending');assert.equal(body.sellingPrice,'8000000');
 }
});
test('active lease and tenant validation remain enforced; inactive email cleanup is preserved',async()=>{
 const values=fixture('residential','pre_leased');values.preLeased={...lease,leaseEndDate:'2000-01-01'};const parsed=await resolver()(values,undefined,options);const sent=await submit(parsed.values,'residential');assert.equal(sent.requests.length,0);assert.ok(sent.errors.length);
 const occupied={...fixture('residential','rent'),rentalStatus:'rented',tenantEmail:'invalid'};const invalid=await resolver()(occupied,undefined,options);assert.ok(invalid.errors.tenantEmail);
 const inactive={...fixture('residential','sell'),tenantEmail:'invalid',agentOwnerEmail:'invalid',preLeased:null};const cleaned=await resolver()(inactive,undefined,options);assert.deepEqual(Object.keys(cleaned.errors),[]);assert.equal(cleaned.values.tenantEmail,'');assert.equal(cleaned.values.agentOwnerEmail,'');assert.equal(inactive.tenantEmail,'invalid');
 const agent=await resolver('agent')(inactive,undefined,options);assert.ok(agent.errors.agentOwnerEmail);
});
