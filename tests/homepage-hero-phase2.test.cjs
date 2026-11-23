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
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');assert.match(css,/font-family:var\(--pb-editorial\)/);assert.match(css,/\.brand\s*\{\s*color:#c89432/);assert.match(css,/\.primary\s*\{\s*background:#0b1d39/);
});

test('legacy defaults adopt the new copy while explicit admin titles and descriptions remain editable',()=>{
 const legacy=hero({heroTitle:'Your Smart Hub for Property Management',heroSubtitle:'Manage, list your properties and find your dream house— all in one platform',quote:'Manage your properties and plan visits with ease'}).render();assert.match(legacy,/Find, Manage and/);assert.doesNotMatch(legacy,/Your Smart Hub/);
 const custom=hero({heroTitle:'Your <script> portfolio',heroSubtitle:'A custom owner message'}).render();assert.match(custom,/Your &lt;script&gt; portfolio/);assert.match(custom,/A custom owner message/);assert.doesNotMatch(custom,/<script>/);
 assert.match(hero({quote:'An existing configured quote'}).render(),/An existing configured quote/);
});

test('CTA links use the legitimate property directory and an existing sticky-header-safe section anchor',()=>{
 const html=hero().render();assert.match(html,/href="\/properties"/);assert.match(html,/Explore Properties/);assert.match(html,/href="#how-it-works-heading"/);assert.match(html,/How It Works/);
 assert.ok(fs.existsSync('src/app/properties/page.tsx'));
 assert.match(fs.readFileSync('src/features/landing-page/PortfolioSections.tsx','utf8'),/id="how-it-works-heading"/);
 assert.match(fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8'),/#how-it-works-heading\)\s*\{\s*scroll-margin-top:104px/);
});

test('existing villa is used with responsive optimized preload and no new remote imagery',()=>{
 const h=hero(),html=h.render();const image=h.imageProps.at(-1);assert.equal(image.src,'/images/portfolio/residential.jpg');assert.equal(image.preload,true);assert.equal(image.fill,true);assert.match(image.sizes,/100vw, \(min-width: 1775px\) 1100px, 62vw/);assert.match(html,/Modern white villa/);
 assert.equal(fs.readFileSync('public/images/portfolio/residential.jpg').readUInt16BE(0),0xffd8);
});

test('configured banner selection remains controlled, with out-of-range and missing legacy data handled',()=>{
 const h=hero({bannerImages:['/images/portfolio/residential.jpg','/images/portfolio/portfolio.jpg'],currentBannerIndex:1});assert.match(h.render(),/src="\/images\/portfolio\/portfolio.jpg"/);
 h.find(n=>n.props?.['aria-label']==='Show hero photograph 1 of 2').props.onClick();assert.deepEqual(h.selections,[0]);assert.match(h.render(),/src="\/images\/portfolio\/residential.jpg"/);
 assert.doesNotThrow(()=>hero({heroTitle:undefined,heroSubtitle:null,quote:undefined,bannerImages:null}).render());
 const bad=hero({bannerImages:['/a.jpg'],currentBannerIndex:NaN});assert.match(bad.render(),/src="\/a.jpg"/);
});

test('failed configured photograph falls back to the local villa without repeated state updates',()=>{
 const h=hero({bannerImages:['/unavailable.jpg']});h.render();const image=h.find(n=>n.type==='img');image.props.onError();assert.match(h.render(),/src="\/images\/portfolio\/residential.jpg"/);assert.doesNotMatch(h.render(),/src="\/unavailable.jpg"/);
});

test('pause holds the photograph during parent carousel updates and resume returns control',()=>{
 const h=hero({bannerImages:['/a.jpg','/b.jpg'],currentBannerIndex:1});h.render();h.find(n=>n.props?.['aria-label']==='Pause hero slideshow').props.onClick();h.props.currentBannerIndex=0;assert.match(h.render(),/src="\/b.jpg"/);h.find(n=>n.props?.['aria-label']==='Resume hero slideshow').props.onClick();assert.match(h.render(),/src="\/a.jpg"/);
});

test('reduced motion prevents automatic photo changes while allowing deliberate selection and cleans up the listener',()=>{
 const h=hero({bannerImages:['/a.jpg','/b.jpg'],currentBannerIndex:1},true);assert.match(h.render(),/src="\/a.jpg"/);assert.equal(h.listeners.length,1);assert.doesNotMatch(h.render(),/Pause hero slideshow|Resume hero slideshow/);
 h.find(n=>n.props?.['aria-label']==='Show hero photograph 2 of 2').props.onClick();assert.match(h.render(),/src="\/b.jpg"/);h.props.currentBannerIndex=0;assert.match(h.render(),/src="\/b.jpg"/);assert.equal(h.listeners.length,1);h.unmount();assert.equal(h.listeners.length,0);
});

test('hero uses finite opt-in motion, responsive stacking, bounded controls and no new fetches or autoplay timers',()=>{
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8'),source=fs.readFileSync('src/features/landing-page/HeroSection.tsx','utf8');
 assert.match(css,/prefers-reduced-motion:no-preference/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none !important/);assert.doesNotMatch(css,/infinite|100vw/);
 assert.match(css,/max-width:767px/);assert.match(css,/position:relative; inset:auto; order:2/);assert.match(css,/overflow:hidden/);assert.match(css,/max-width:calc\(100% - 40px\)/);assert.match(css,/min-width:44px; min-height:44px/);assert.match(css,/focus-visible/);
 assert.doesNotMatch(source,/setInterval|setTimeout|fetch\s*\(|axios|useAuth|canvas|three\.js|GradientSpotlight/);
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
 test('desktop composition is compact and preserves the architecture without image zoom',()=>{
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');
 assert.match(css,/min-height:clamp\(480px,35vw,540px\)/);assert.match(css,/font-size:clamp\(42px,3.65vw,56px\)/);
 assert.match(css,/object-position:center top/);assert.doesNotMatch(css,/scale\(/);assert.match(css,/padding:48px 32px 72px/);
});
