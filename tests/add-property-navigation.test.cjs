const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function harness(initial='/manage-property'){
 const history=[initial],cache=new Map(),state=[];let position=0,index=0;
 const current=()=>new URL(history[position],'http://local');
 const router={push:url=>{history.splice(++position);history.push(url);},replace:url=>{history[position]=url;},back:()=>{if(position>0)position--;},forward:()=>{if(position<history.length-1)position++;}};
 const OwnerForm=()=>null,TenantForm=()=>null;
 const load=file=>{if(cache.has(file))return cache.get(file);const output={};cache.set(file,output);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const scoped=name=>{
   if(name==='react')return {...React,useCallback:fn=>fn,useState:initial=>{const key=index++;if(!(key in state))state[key]=typeof initial==='function'?initial():initial;return [state[key],value=>{state[key]=value;}];}};
   if(name==='next/navigation')return {useRouter:()=>router,usePathname:()=>current().pathname,useSearchParams:()=>current().searchParams,useParams:()=>({}),redirect:url=>{const error=new Error('Redirect');error.location=url;throw error;}};
   if(name==='next/link')return ()=>null;
   if(name==='lucide-react')return new Proxy({},{get:(_,key)=>key==='__esModule'?false:()=>null});
   if(name.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
   if(name==='@/features/properties/AddPropertyForm')return {__esModule:true,default:OwnerForm};
   if(name==='@/features/properties/TenantPropertyForm')return {__esModule:true,default:TenantForm};
   if(name.startsWith('@/')){const base=path.resolve('src',name.slice(2));return load(base+(fs.existsSync(base+'.tsx')?'.tsx':'.ts'));}
   if(name.startsWith('./'))return load(path.resolve(path.dirname(file),name)+'.tsx');
   return require(name);
  };new Function('require','exports',code)(scoped,output);return output;
 };
 const Selection=load(path.resolve('src/features/properties/SelectPropertyType.tsx')).default;
 const Page=load(path.resolve('src/app/(protected)/add-property/page.tsx')).default;
 const render=()=>{index=0;return Selection();};
 const nodes=element=>{if(!element||typeof element!=='object')return [];if(Array.isArray(element))return element.flatMap(nodes);if(typeof element.type==='function')return nodes(element.type(element.props));return [element,...nodes(element.props?.children)];};
 const text=element=>element==null?'':Array.isArray(element)?element.map(text).join(''):typeof element==='object'?text(element.props?.children):String(element);
 const button=label=>nodes(render()).find(node=>node.type==='button'&&(node.props['aria-label']===label||text(node).trim()===label));
 const navigate=load(path.resolve('src/lib/navigation.tsx')).useNavigate();
 return {router,navigate,current,render,button,html:()=>renderToStaticMarkup(render()),legacyPage:()=>load(path.resolve('src/app/(protected)/tenant-property/page.tsx')).default({searchParams:Promise.resolve(Object.fromEntries(current().searchParams))}),page:()=>Page({searchParams:Promise.resolve(Object.fromEntries(current().searchParams))}),OwnerForm,TenantForm};
}

// Execute the existing dropdown/back callbacks without rendering unrelated
// account, Firebase, query or form workflows. The actual navigation adapter and
// selection/category/page components above are used throughout.
function handler(file,tag,label,attribute='onSelect',scope={}){
 const filename=path.resolve(file),source=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
 function visit(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)===tag&&node.children.filter(ts.isJsxText).map(child=>child.text).join('').trim()===label){const prop=node.openingElement.attributes.properties.find(prop=>ts.isJsxAttribute(prop)&&prop.name.getText(source)===attribute);if(prop?.initializer&&ts.isJsxExpression(prop.initializer))expression=prop.initializer.expression.getText(source);}ts.forEachChild(node,visit);}
 visit(source);assert.ok(expression,`Missing ${label} action`);return new Function(...Object.keys(scope),`return (${expression});`)(...Object.values(scope));
}

for(const mode of ['owner','tenant'])test(`${mode} dropdown opens categories directly and carries mode through every category`,async()=>{
 for(const category of ['residential','commercial','industrial']){const h=harness();handler('src/features/properties/ManageProperty.tsx','DropdownMenuItem',mode==='owner'?'As an Owner':'As a Tenant','onSelect',{navigate:h.navigate})();assert.equal(h.current().pathname,'/select-property-type');assert.equal(h.current().searchParams.get('as'),mode);assert.match(h.html(),/Select property category/);assert.doesNotMatch(h.html(),/I&#x27;m the owner|I&#x27;m a tenant|Change owner \/ tenant choice|Adding as/);h.button(`Select ${category[0].toUpperCase()+category.slice(1)} property`).props.onClick();assert.equal(h.current().pathname,'/add-property');assert.equal(h.current().searchParams.get('type'),category);assert.equal(h.current().searchParams.get('as'),mode);const page=await h.page();assert.equal(page.type,mode==='tenant'?h.TenantForm:h.OwnerForm);assert.equal(page.props.category,category);}
});
test('URL without mode retains role choice and records the chosen mode in navigation history',()=>{
 const h=harness('/select-property-type');assert.match(h.html(),/First, tell us your connection/);assert.doesNotMatch(h.html(),/Select Residential property/);h.button("I'm a tenantRecord the home or space you're renting.").props.onClick();assert.equal(h.current().searchParams.get('as'),'tenant');assert.match(h.html(),/Select Residential property/);h.button('Select Commercial property').props.onClick();h.router.back();assert.equal(h.current().searchParams.get('as'),'tenant');assert.match(h.html(),/Select Commercial property/);h.router.back();assert.equal(h.current().search,'');assert.match(h.html(),/First, tell us your connection/);
});
test('browser Back/Forward and category Back preserve the dropdown-selected mode without another role prompt',async()=>{
 const h=harness();h.navigate('/select-property-type?as=tenant');assert.match(h.html(),/Select property category/);h.button('Select Residential property').props.onClick();h.router.back();assert.equal(h.current().pathname,'/select-property-type');assert.match(h.html(),/Select property category/);assert.doesNotMatch(h.html(),/First, tell us/);h.router.forward();assert.equal((await h.page()).type,h.TenantForm);h.router.back();h.button('Back').props.onClick();assert.equal(h.current().pathname,'/manage-property');
});
test('selection follows changed search parameters while the same component remains mounted',async()=>{
 const h=harness('/select-property-type');assert.match(h.html(),/First, tell us/);h.router.push('/select-property-type?as=owner');assert.match(h.html(),/Select property category/);h.router.push('/select-property-type?as=tenant');h.button('Select Industrial property').props.onClick();assert.equal((await h.page()).type,h.TenantForm);h.router.back();h.router.back();assert.equal(h.current().searchParams.get('as'),'owner');h.button('Select Commercial property').props.onClick();assert.equal((await h.page()).type,h.OwnerForm);
});
test('missing or invalid modes never silently select an owner or tenant',()=>{
 for(const query of ['', '?as=', '?as=OWNER','?as=other','?as=undefined']){const h=harness('/select-property-type'+query);assert.match(h.html(),/First, tell us/);assert.doesNotMatch(h.html(),/Select Residential property/);}
});
test('admin owner context survives explicit role/category selection and encoded navigation',()=>{
 const h=harness('/select-property-type?as=owner&adminOwnerUID=owner%2Bfixture');h.button('Select Residential property').props.onClick();assert.equal(h.current().searchParams.get('adminOwnerUID'),'owner+fixture');assert.equal(h.current().searchParams.get('as'),'owner');
 const direct=harness('/select-property-type?adminOwnerUID=owner%2Bfixture');direct.button("I'm the ownerAdd a property you own or manage.").props.onClick();assert.equal(direct.current().searchParams.get('adminOwnerUID'),'owner+fixture');
});
test('existing form deep links keep their owner default and tenant category selection',async()=>{
 for(const [url,mode,category]of [['/add-property?type=commercial','owner'],['/add-property?as=owner&type=industrial','owner'],['/add-property?as=tenant&type=commercial','tenant','commercial']]){const h=harness(url),page=await h.page();assert.equal(page.type,mode==='tenant'?h.TenantForm:h.OwnerForm);if(category)assert.equal(page.props.category,category);}
});
test('form Back actions retain the role and administrator context',()=>{
 const h=harness('/add-property?as=tenant&type=residential');handler('src/features/properties/TenantPropertyForm.tsx','Button','Back','onClick',{navigate:h.navigate})();assert.equal(h.current().searchParams.get('as'),'tenant');assert.match(h.html(),/Select property category/);
 const owner=harness('/add-property?type=industrial&adminOwnerUID=owner%2Bfixture');handler('src/features/properties/AddPropertyForm.tsx','Button','Back to Property Type Selection','onClick',{navigate:owner.navigate,selectedRole:'owner',adminOwnerUID:'owner+fixture'})();assert.equal(owner.current().searchParams.get('as'),'owner');assert.equal(owner.current().searchParams.get('adminOwnerUID'),'owner+fixture');assert.match(owner.html(),/Select property category/);
});


test('missing or invalid category redirects to existing selection with the chosen role and admin context',async()=>{
 for(const mode of ['owner','tenant'])for(const type of ['', '&type=', '&type=unknown', '&type=../../private']){const h=harness(`/add-property?as=${mode}${type}&adminOwnerUID=owner%2Bfixture`);await assert.rejects(()=>h.page(),error=>{assert.equal(error.location,`/select-property-type?as=${mode}&adminOwnerUID=owner%2Bfixture`);return true;});}
 const legacy=harness('/add-property');await assert.rejects(()=>legacy.page(),error=>error.location==='/select-property-type?as=owner');
});


test('legacy tenant route preserves valid categories and sends missing categories to selection',async()=>{
 const valid=harness('/tenant-property?type=commercial');await assert.rejects(()=>valid.legacyPage(),error=>error.location==='/add-property?as=tenant&type=commercial');
 const missing=harness('/tenant-property');await assert.rejects(()=>missing.legacyPage(),error=>error.location==='/select-property-type?as=tenant');
});
