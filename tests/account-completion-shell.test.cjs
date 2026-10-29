const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function render({status='anonymous',loading=false,path='/',href=path}={}){
  const redirects=[];
  const fakeReact={...React,useEffect:fn=>{fn();},useRef:value=>({current:value})};
  const marker=name=>({children})=>React.createElement(name,{},children);
  const source=ts.transpileModule(fs.readFileSync('src/components/ApplicationShell.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const output={};
  const scoped=name=>{
    if(name==='react')return fakeReact;
    if(name==='next/navigation')return {usePathname:()=>path,useRouter:()=>({replace:value=>redirects.push(value)})};
    if(name==='@/contexts/AuthContext')return {useAuth:()=>({loading,profileStatus:status})};
    if(name==='@/features/navbar/SiteHeader')return {__esModule:true,default:marker('site-header')};
    if(name==='@/features/brand/PublicMain')return {__esModule:true,default:marker('public-main')};
    if(name==='@/features/footer/SiteFooter')return {__esModule:true,default:marker('site-footer')};
    if(name==='@/components/DemoFormAutofill')return {__esModule:true,default:marker('demo-widget')};
    return require(name);
  };
  const previous=global.window;global.window={location:new URL(href,'http://local')};
  try{new Function('exports','require','process',source)(output,scoped,{env:{NODE_ENV:'test'}});return {html:renderToStaticMarkup(output.default({children:React.createElement('page-content',{},'PAGE')})),redirects};}
  finally{global.window=previous;}
}

test('anonymous and complete accounts retain the normal public application shell',()=>{
  for(const status of ['anonymous','complete']){const result=render({status});assert.match(result.html,/site-header/);assert.match(result.html,/site-footer/);assert.match(result.html,/PAGE/);assert.deepEqual(result.redirects,[]);}
});

test('loading state renders no page, header, footer, or clickable navigation surface',()=>{
  const result=render({status:'checking',loading:true,path:'/about'});assert.match(result.html,/Preparing your account/);assert.doesNotMatch(result.html,/site-header|site-footer|PAGE/);assert.deepEqual(result.redirects,[]);
});

test('incomplete accounts on public and protected URLs render nothing sensitive and are replaced with auth completion',()=>{
  for(const path of ['/','/about','/manage-property']){const result=render({status:'incomplete',path,href:`http://local${path}?source=test#section`});assert.doesNotMatch(result.html,/site-header|site-footer|PAGE/);assert.equal(result.redirects.length,1);assert.match(result.redirects[0],/^\/auth\?mode=complete&next=/);assert.equal(decodeURIComponent(result.redirects[0].split('next=')[1]),`${path}?source=test#section`);}
});

test('the auth completion route is the only rendered route and has no global navigation',()=>{
  const result=render({status:'incomplete',path:'/auth',href:'http://local/auth?mode=complete'});assert.match(result.html,/PAGE/);assert.doesNotMatch(result.html,/site-header|site-footer/);assert.deepEqual(result.redirects,[]);
});
