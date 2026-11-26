const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

function hero(overrides={},initialReduced=false){
 const selections=[],state=[],effects=[],deps=[],cleanups=[],listeners=[];let cursor=0,effectCursor=0,dirty=false,tree;
 const props={heroTitle:'',heroSubtitle:'',quote:'',bannerImages:[],currentBannerIndex:0,setCurrentBannerIndex:i=>selections.push(i),onNavigate:()=>{},...overrides};
 const hooks={...React,useState:initial=>{const slot=cursor++;if(!(slot in state))state[slot]=initial;return [state[slot],next=>{const value=typeof next==='function'?next(state[slot]):next;if(!Object.is(value,state[slot])){state[slot]=value;dirty=true;}}];},useEffect:(effect,next)=>{const slot=effectCursor++;if(!deps[slot]||next.some((x,i)=>x!==deps[slot][i])){deps[slot]=next;effects.push(()=>{cleanups[slot]?.();cleanups[slot]=effect();});}}};
 const media={matches:initialReduced,addEventListener:(_event,fn)=>listeners.push(fn),removeEventListener:(_event,fn)=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}};
 const imageProps=[];
 const source=ts.transpileModule(fs.readFileSync('src/features/landing-page/HeroSection.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const output={},scoped=name=>{
  if(name==='react')return hooks;
  if(name==='./HeroImageCarousel')return {__esModule:true,default:()=>React.createElement('div',{'data-hero-carousel':'true'})};
  if(name==='next/image')return {__esModule:true,default:p=>{imageProps.push(p);const {fill,preload,...rest}=p;return React.createElement('img',{...rest,'data-preload':String(preload),'data-fill':String(fill)});}};
  if(name==='@/lib/navigation')return {Link:({to,children,...rest})=>React.createElement('a',{...rest,href:to},children)};
  if(name.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
  return require(name);
 };
 new Function('exports','require',source)(output,scoped);
 function render(){const before=global.window;global.window={matchMedia:()=>media};try{let count=0;do{assert.ok(count++<8,'hero state must settle without a render loop');dirty=false;cursor=0;effectCursor=0;tree=output.HeroSection(props);for(const effect of effects.splice(0))effect();}while(dirty);return renderToStaticMarkup(tree);}finally{global.window=before;}}
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const value=find(child,predicate);if(value)return value;}return null;}
 return {props,selections,listeners,imageProps,render,find:fn=>find(tree,fn),reduce:value=>{media.matches=value;listeners.forEach(fn=>fn());},unmount:()=>cleanups.forEach(fn=>fn?.())};
}

test('default hero renders the requested serif headline with gold PropBank and no invented listing data',()=>{
 const h=hero(),html=h.render();assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/>Find, Manage and<\/span> <span/);assert.match(html,/>Grow Your Property<\/span> <span/);assert.match(html,/with <span class="brand">PropBank<\/span>/);
 assert.match(html,/Discover exceptional properties/);assert.doesNotMatch(html,/₹|guaranteed|properties sold|trusted by \d/i);
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');assert.match(css,/font-family:var\(--pb-editorial\)/);assert.match(css,/\.brand\s*\{\s*color:#6e4917/);assert.match(css,/\.primary\s*\{\s*background:#0b1d39/);
});

test('legacy defaults adopt the new copy while explicit admin titles and descriptions remain editable',()=>{
 const legacy=hero({heroTitle:'Your Smart Hub for Property Management',heroSubtitle:'Manage, list your properties and find your dream house— all in one platform',quote:'Manage your properties and plan visits with ease'}).render();assert.match(legacy,/Find, Manage and/);assert.doesNotMatch(legacy,/Your Smart Hub/);
 const custom=hero({heroTitle:'Your <script> portfolio',heroSubtitle:'A custom owner message'}).render();assert.match(custom,/Your &lt;script&gt; portfolio/);assert.match(custom,/A custom owner message/);assert.doesNotMatch(custom,/<script>/);
 assert.match(hero({quote:'An existing configured quote'}).render(),/An existing configured quote/);
});

test('CTA links use the existing protected management route and an existing sticky-header-safe section anchor',()=>{
 const html=hero().render();assert.match(html,/href="\/manage-property"/);assert.match(html,/Manage Property/);assert.match(html,/href="#how-it-works-heading"/);assert.match(html,/How It Works/);
 assert.ok(fs.existsSync('src/app/(protected)/manage-property/page.tsx'));
 assert.match(fs.readFileSync('src/features/landing-page/PortfolioSections.tsx','utf8'),/id="how-it-works-heading"/);
 assert.match(fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8'),/#how-it-works-heading\)\s*\{\s*scroll-margin-top:104px/);
});

test('hero delegates image-only state and controls to the isolated carousel',()=>{
 const html=hero().render();assert.match(html,/data-hero-carousel="true"/);
 const source=fs.readFileSync('src/features/landing-page/HeroSection.tsx','utf8');assert.match(source,/<HeroImageCarousel bannerImages=\{bannerImages\}/);
 assert.doesNotMatch(source,/setInterval|setTimeout/);
});

test('homepage still composes all existing sections and the original search flow after this hero',()=>{
 const source=fs.readFileSync('src/features/landing-page/LandingPage.tsx','utf8');
 const hero=source.indexOf('<HeroSection');for(const section of ['<PropertyManagementSections','<SearchFilterSection','<PropertiesSection','<PortfolioCallToAction'])assert.ok(source.indexOf(section)>hero,section);
 assert.match(source,/heroTitle=\{siteSettings.heroTitle\}/);assert.match(source,/onNavigate=\{navigate\}/);
});

 test('legacy corrupted descriptions are repaired without corrupting valid Unicode or custom copy',()=>{
 for(const separator of ['\u2014 ', '\u00e2\u20ac\u201d ', '\u00e2\u20ac ']) {
  const html=hero({heroSubtitle:'Manage, list your properties and find your dream house'+separator+'all in one platform'}).render();
  assert.match(html,/Discover exceptional properties/);assert.doesNotMatch(html,/dream house/);
 }
 assert.match(hero({heroSubtitle:'Your home\u00e2\u20ac\u201d your future'}).render(),/Your home\u2014 your future/);
 assert.match(hero({heroSubtitle:'Pune \u2022 Caf\u00e9 \u2022 \u0918\u0930'}).render(),/Pune \u2022 Caf\u00e9 \u2022 \u0918\u0930/);
});
 test('desktop composition remains compact without additional image zoom',()=>{
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');
 assert.match(css,/min-height:clamp\(620px,43vw,720px\)/);assert.match(css,/font-size:clamp\(42px,3.65vw,56px\)/);
 assert.match(css,/object-position:var\(--hero-focal-desktop/);assert.doesNotMatch(css,/hero-photo-drift|scale\(/);assert.match(css,/padding:48px 32px 104px/);
});

test('desktop glass panel aligns right and centers vertically without changing mobile sizing',()=>{
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');
 assert.match(css,/@media \(min-width:1024px\)\s*\{\s*\.shell\s*\{\s*justify-content:flex-end; padding-block:76px;/);
 assert.match(css,/align-items:center; min-height:clamp\(620px,43vw,720px\)/);
 assert.match(css,/max-width:1440px; margin-inline:auto; padding:48px 32px 104px/);
 assert.match(css,/width:min\(100%,580px\)/);assert.match(css,/backdrop-filter:blur\(14px\) saturate\(130%\)/);
 assert.match(css,/@media \(max-width:767px\)/);assert.match(css,/padding:28px 20px 148px/);
 const h=hero();h.render();const primary=h.find(n=>n.props?.to==='/manage-property');assert.ok(primary);assert.equal(primary.props.className,'primary');
 assert.match(fs.readFileSync('src/app/(protected)/layout.tsx','utf8'),/RouteGuard/);
});
