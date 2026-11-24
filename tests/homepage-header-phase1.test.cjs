const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function header(overrides={},options={}){
 const changes=[],props={user:null,profileStatus:'anonymous',userName:'',userEmail:'',userPhone:'',userRole:'',isOpen:false,onOpenChange:open=>changes.push(open),handleLogout:async()=>{},...overrides};
 let dialogProps,userMenuProps;
 const plain=({children})=>React.createElement(React.Fragment,null,children);
 const link=({to,children,...rest})=>React.createElement('a',{...rest,href:to},children);
 const dialog={
  Root:p=>{dialogProps=p;return React.createElement(React.Fragment,null,p.children);},
  Trigger:plain,Close:plain,Portal:({children})=>props.isOpen?React.createElement(React.Fragment,null,children):null,
  Overlay:()=>null,Content:({children,...rest})=>React.createElement('section',{...rest,role:'dialog'},children),
  Title:({children,...rest})=>React.createElement('h2',rest,children),Description:({children,...rest})=>React.createElement('p',rest,children),
 };
 const dropdown={Root:plain,Trigger:plain,Item:plain,Label:plain,Separator:()=>null,Portal:({children})=>options.workspaceOpen?React.createElement(React.Fragment,null,children):null,Content:({children})=>React.createElement('div',{role:'menu'},children)};
 const loaded={};
 function load(file){
  if(loaded[file])return loaded[file];
  const output={},code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const scoped=name=>{
   if(name==='@/lib/navigation')return {Link:link};
   if(name==='@/features/brand/BrandLogo')return load('src/features/brand/BrandLogo.tsx');
   if(name.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
   if(name==='@radix-ui/react-dialog')return dialog;
   if(name==='@radix-ui/react-dropdown-menu')return dropdown;
   if(name==='./UserMenu')return {UserMenu:p=>{userMenuProps=p;return load('src/features/navbar/UserMenu.tsx').UserMenu(p);}};
   return require(name);
  };
  new Function('exports','require',code)(output,scoped);loaded[file]=output;return output;
 }
 const Component=load('src/features/navbar/HomepageHeader.tsx').default;
 const element=Component(props),html=renderToStaticMarkup(element);
 const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const result=find(child,predicate);if(result)return result;}return null;};
 return {html,props,changes,dialogProps,userMenuProps,find:predicate=>find(element,predicate)};
}

test('shared desktop navigation uses the requested existing routes in order',()=>{
 const {html}=header();const nav=html.match(/<nav aria-label="Main navigation"[^>]*>([\s\S]*?)<\/nav>/)[1];
 assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['/visit-planner','/properties','/contact']);
 for(const route of ['properties','contact','auth'])assert.ok(fs.existsSync(`src/app/${route}/page.tsx`));
 for(const route of ['manage-property','visit-planner','my-account'])assert.ok(fs.existsSync(`src/app/(protected)/${route}/page.tsx`));
});

test('original brand mark, manage CTA and anonymous sign-in remain available',()=>{
 const {html}=header();assert.match(html,/PropBank/);assert.match(html,/M4 4h26v8H12v32H4V4/);
 assert.match(html,/href="\/manage-property"/);assert.match(html,/Login \/ Sign Up/);assert.match(html,/href="\/auth"/);
 assert.doesNotMatch(html,/Search properties|List Property|Workspace|href="\/(buy|rent|services)"/);
});

test('signed-in identity and logout are passed to the existing UserMenu without new auth operations',async()=>{
 let signedOut=0;const user={uid:'owner',displayName:'Owner',email:'owner@test.invalid'},logout=async()=>signedOut++;
 const result=header({user,userName:'Verified owner',userEmail:user.email,userPhone:'123',handleLogout:logout});
 assert.equal(result.userMenuProps.user,user);assert.equal(result.userMenuProps.userName,'Verified owner');assert.equal(result.userMenuProps.handleLogout,logout);
 assert.doesNotMatch(result.html,/Login \/ Sign Up/);await result.userMenuProps.handleLogout();assert.equal(signedOut,1);
});

test('admin entry is restricted to verified admin profile dropdowns',()=>{
 const user={uid:'owner',email:'owner@test.invalid'};
 for(const props of [{userRole:'admin'},{user,userRole:''},{user,userRole:'individual'},{user,userRole:'tenant'}]){
  const r=header(props,{workspaceOpen:true});assert.doesNotMatch(r.html,/Admin Panel/);assert.match(r.html,/Visit Planner/);
 }
 const admin=header({user,userRole:'admin'},{workspaceOpen:true});assert.match(admin.html,/href="\/admin"/);assert.match(admin.html,/Admin Panel/);
});

test('all applicable routes retain identical navigation and correct active link',()=>{
 for(const pathname of ['/','/properties','/properties/example','/manage-property','/visit-planner','/contact','/admin']){
  const r=header({pathname});assert.match(r.html,/All Properties/);assert.match(r.html,/Visit Planner/);assert.match(r.html,/Contact Us/);assert.match(r.html,/Manage Property/);
  if(pathname.startsWith('/properties'))assert.match(r.html,/aria-current="page"[^>]*href="\/properties"/);
 }
});

test('mobile drawer retains controlled Radix open/close contract and closes links on selection',()=>{
 const result=header({isOpen:true});assert.equal(result.dialogProps.open,true);assert.equal(result.dialogProps.onOpenChange,result.props.onOpenChange);
 assert.match(result.html,/role="dialog"/);assert.match(result.html,/Explore PropBank/);assert.match(result.html,/aria-label="Close navigation"/);
 const mobileNav=result.find(n=>n.props?.['aria-label']==='Mobile navigation');
 const first=React.Children.toArray(mobileNav.props.children)[0];first.props.onClick();assert.deepEqual(result.changes,[false]);
 const list=result.find(n=>n.props?.to==='/manage-property'&&typeof n.props.onClick==='function');list.props.onClick();assert.deepEqual(result.changes,[false,false]);
 assert.doesNotMatch(header().html,/role="dialog"/);
});

test('mobile account retains authorized details, profile action and existing logout callback',async()=>{
 let calls=0;const r=header({isOpen:true,user:{uid:'owner',email:'owner@test.invalid'},userName:'Owner',userPhone:'123',handleLogout:async()=>calls++});
 assert.match(r.html,/owner@test.invalid/);assert.match(r.html,/href="\/my-account"/);
 const button=r.find(n=>n.type==='button'&&n.props.onClick===r.props.handleLogout);assert.ok(button);await button.props.onClick();assert.equal(calls,1);
});

test('incomplete profile retains completion label rather than bypassing onboarding',()=>{
 const r=header({profileStatus:'incomplete'});assert.match(r.html,/Complete account/);assert.doesNotMatch(r.html,/Login \/ Sign Up/);
});

test('homepage layout has scoped palette, responsive controls, touch targets and reduced-motion support',()=>{
 const source=fs.readFileSync('src/features/navbar/HomepageHeader.tsx','utf8');
 for(const token of ['bg-[#faf7f1]','text-[#0b1d39]','border-[#c89432]','hidden items-center gap-5 lg:flex','lg:hidden','h-11 w-11','focus-visible:outline','motion-reduce:transition-none'])assert.ok(source.includes(token),token);
 assert.match(source,/Dialog\.Root open=\{isOpen\} onOpenChange=\{onOpenChange\}/);assert.match(source,/Dialog\.Title/);assert.match(source,/Dialog\.Description/);assert.match(source,/Dialog\.Close asChild/);
 assert.doesNotMatch(source,/\bfetch\s*\(|axios|useEffect|useAuth|setTimeout|setInterval/);
});

test('all routes use one header while account loading and sign-out stay centralized',()=>{
 const source=fs.readFileSync('src/features/navbar/SiteHeader.tsx','utf8');
 assert.match(source,/return <HomepageHeader/);assert.doesNotMatch(source,/if \(pathname|<header/);
 assert.match(source,/\[uid\]/);assert.match(source,/auth\.currentUser\?\.uid!==uid/);assert.match(source,/await signOut\(\)/);
 const shell=fs.readFileSync('src/components/ApplicationShell.tsx','utf8');assert.match(shell,/if\(authRoute\)/);
});
