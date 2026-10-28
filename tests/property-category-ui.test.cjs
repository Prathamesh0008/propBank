const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const choices={residential:['Apartment','Independent House','Villa','Residential Plot'],commercial:['Office','Shop','Showroom','Commercial Plot'],industrial:['Warehouse','Factory','Industrial Shed','Industrial Plot']};
function harness(category){
 const state=[],requests=[],cache=new Map();let index=0;
 const react={...React,useState:initial=>{const key=index++;if(!(key in state))state[key]=initial;return [state[key],value=>{state[key]=typeof value==='function'?value(state[key]):value;}];}};
 const load=file=>{if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const scoped=name=>{
  if(name==='react')return react;
  if(name.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
  if(name==='@/ui/form')return {FormField:({name,render})=>render({field:{name,value:'',onChange:()=>{}}}),FormItem:props=>React.createElement('div',props),FormLabel:props=>React.createElement('label',props),FormControl:props=>React.createElement('div',props),FormMessage:()=>null};
  if(name==='@/ui/input')return {Input:props=>React.createElement('input',props)};
  if(name==='@/ui/button')return {Button:props=>React.createElement('button',props)};
  if(name==='@/contexts/AuthContext')return {useAuth:()=>({user:{uid:'tenant',email:'tenant@test.invalid',displayName:'Tenant'}})};
  if(name==='@tanstack/react-query')return {useQueryClient:()=>({invalidateQueries:async()=>{}})};
  if(name==='@/lib/navigation')return {useNavigate:()=>()=>{}};
  if(name==='@/lib/api-client')return {apiFetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return new Response('{"success":true}');}};
  if(name==='@/components/NextAgreementFields')return ()=>null;
  if(name==='./FurnishedChecklistModal')return {FurnishedChecklistModal:()=>null};
  if(name==='@/features/services/ServiceRequestWorkflow')return {readFile:()=>{throw new Error('No files in form test');}};
  if(name.startsWith('@/')){const root=path.resolve('src',name.slice(2));return load(root+(fs.existsSync(root+'.tsx')?'.tsx':'.ts'));}
  if(name.startsWith('./')){const root=path.resolve(path.dirname(file),name);return load(root+(fs.existsSync(root+'.tsx')?'.tsx':'.ts'));}
  return require(name);
 };new Function('require','exports',code)(scoped,out);return out;};
 const fields=load(path.resolve('src/features/properties/ClientPropertyFields.tsx')).default;
 const Tenant=load(path.resolve('src/features/properties/TenantPropertyForm.tsx')).default;
 const renderTenant=()=>{index=0;return Tenant({category});};
 const form={control:{},setValue:()=>{}};
 return {load,state,requests,renderTenant,ownerFields:(fixedCategory,creation=false)=>React.createElement(fields,{form,fixedCategory,creation})};
}
function nodes(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);if(typeof tree.type==='function')return nodes(tree.type(tree.props));return [tree,...nodes(tree.props?.children)];}
function texts(tree){return tree==null?'':Array.isArray(tree)?tree.map(texts).join(''):typeof tree==='object'?texts(tree.props?.children):String(tree);}
function options(tree){return nodes(tree).filter(node=>node.type==='select'&&['Property type','Property type / Structure'].includes(node.props['aria-label'])).flatMap(node=>nodes(node.props.children).filter(node=>node.type==='option').map(node=>texts(node.props.children))).slice(1);}
function expression(name){const file=path.resolve('src/features/properties/AddPropertyForm.tsx'),source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)result=node.initializer.getText(source);ts.forEachChild(node,walk);}walk(source);assert.ok(result);return ts.transpile(`const value=${result};`,{target:ts.ScriptTarget.ES2022}).replace(/^const value\s*=\s*/, '').replace(/;\s*$/,'');}

for(const category of Object.keys(choices))test(`${category} forms omit category controls and show only the category's structure options`,async()=>{
 const h=harness(category),owner=h.ownerFields(category),tenant=h.renderTenant();assert.doesNotMatch(renderToStaticMarkup(owner),/Property category|Choose property category/);assert.doesNotMatch(renderToStaticMarkup(tenant),/Property category/);assert.deepEqual(options(owner),choices[category]);assert.deepEqual(options(tenant),choices[category]);assert.equal(h.state[0].propertyCategory,category);assert.equal(h.state[0].propertyType,category);
 h.state[0]={...h.state[0],propertyTitle:'Fixture',location:'Fixture',structure:choices[category][0],configuration:category==='residential'?'2 BHK':'',monthlyRent:'25000',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31',propertyType:'tampered',propertyCategory:'tampered'};h.state[3]={personName:'Owner',phone:'9876543210'};await nodes(h.renderTenant()).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.requests.length,1);assert.equal(h.requests[0].body.propertyType,category);assert.equal(h.requests[0].body.propertyCategory,category);
});
test('owner submit uses the selected route category, not editable form metadata',async()=>{
 for(const category of Object.keys(choices)){let submitted;const scope={selectedPropertyType:category,structureUsesPlotArea:value=>/plot|land/i.test(value||''),toast:()=>{},auth:{currentUser:{uid:'owner'}},furnishedChecklist:[],uploadedImages:[],uploadedInternalImages:[],adminOwnerUID:'',accountRole:'individual',addNextAgreementManually:false,nextAgreementDraft:{},validateNextAgreementDraft:()=>'',apiFetch:async(url,init)=>{submitted=JSON.parse(init.body);return new Response('{"success":true}');},API_BASE_URL:'/api',readPropertyResponse:async response=>response.json(),queryClient:{invalidateQueries:()=>{}},navigate:()=>{},form:{setError:()=>{}},PropertySubmissionError:class extends Error{}};const submit=new Function(...Object.keys(scope),`return (${expression('onSubmit')});`)(...Object.values(scope));await submit({propertyTitle:'Fixture',listingType:'sell',sellingPrice:'1000',structure:choices[category][0],configuration:category==='residential'?'2 BHK':'',propertyType:'wrong',propertyCategory:'wrong',carpetArea:'850',carpetAreaUnit:'sq m',constructedArea:'1000',constructedAreaUnit:'sq yd'});assert.equal(submitted.propertyType,category);assert.equal(submitted.propertyCategory,category);assert.equal(submitted.carpetAreaUnit,'sq m');assert.equal(submitted.constructedAreaUnit,'sq yd');assert.equal(submitted.areaUnit,'sq m');assert.equal(submitted.configuration,category==='residential'?'2 BHK':'');}
});
test('configuration is a residential layout and no longer repeats commercial or industrial property types',()=>{
 const getOptions=new Function('PROPERTY_CONFIGURATIONS',`return (${expression('getConfigurationOptions')});`)(['Studio','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK']);assert.deepEqual(getOptions().map(value=>value.label),['Studio','1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK']);
});
test('tenant fields follow structure semantics without discarding retained form state',()=>{
 const residential=harness('residential');let html=renderToStaticMarkup(residential.renderTenant());assert.match(html,/Residential layout/);assert.match(html,/Carpet area/);assert.doesNotMatch(html,/>Plot area</);
 residential.state[0]={...residential.state[0],structure:'Residential Plot',configuration:'3 BHK',carpetArea:'850',plotArea:'1200'};html=renderToStaticMarkup(residential.renderTenant());assert.match(html,/>Plot area</);assert.match(html,/Plot area unit/);assert.doesNotMatch(html,/Residential layout|Carpet area unit|Built-up \/ Constructed area unit/);assert.equal(residential.state[0].configuration,'3 BHK');assert.equal(residential.state[0].carpetArea,'850');
 for(const category of ['commercial','industrial']){const h=harness(category),markup=renderToStaticMarkup(h.renderTenant());assert.doesNotMatch(markup,/Residential layout|BHK/);}
});
test('owner creation summary omits duplicate area units and expected rent while Edit Property keeps them',()=>{
 const h=harness('residential'),creation=renderToStaticMarkup(h.ownerFields('residential',true)),edit=renderToStaticMarkup(h.ownerFields(undefined));
 assert.match(creation,/Property type/);assert.match(creation,/Building \/ Society name/);
 for(const label of ['Area unit','Carpet area unit','Built-up \/ Constructed area unit','Plot area unit','Expected rent'])assert.doesNotMatch(creation,new RegExp(label));
 for(const label of ['Area unit','Carpet area unit','Built-up \/ Constructed area unit','Plot area unit'])assert.match(edit,new RegExp(label));
});
test('Edit Property keeps its editable category control and legacy structure options',()=>{
 const h=harness('residential'),html=renderToStaticMarkup(h.ownerFields(undefined));assert.match(html,/aria-label="Property category"/);for(const value of ['Residential','Commercial','Industrial'])assert.match(html,new RegExp(value.toLowerCase()));for(const value of ['Apartment','Warehouse','Flat','RCC Shed'])assert.match(html,new RegExp(value));
});
