const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),React=require('react');
function carousel(reduce=false,props={}){
 const state=[],deps=[],effects=[],cleanup=[],timers=new Map(),listeners=new Map();let slot=0,es=0,id=0,dirty=false,tree;
 const media={matches:reduce,addEventListener:(_,fn)=>listeners.set('media',fn),removeEventListener:()=>listeners.delete('media')};
 const win={matchMedia:()=>media,setInterval:(fn,ms)=>{assert.equal(ms,3000);timers.set(++id,fn);return id;},clearInterval:id=>timers.delete(id)};
 const doc={hidden:false,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
 const within=fn=>{const old=[global.window,global.document];global.window=win;global.document=doc;try{return fn()}finally{[global.window,global.document]=old;}};
 const hooks={...React,useState:initial=>{const i=slot++;if(!(i in state))state[i]=initial;return [state[i],value=>{const next=typeof value==='function'?value(state[i]):value;if(!Object.is(next,state[i])){state[i]=next;dirty=true;}}]},useEffect:(fn,next)=>{const i=es++;if(!deps[i]||next.some((v,j)=>v!==deps[i][j])){deps[i]=next;effects.push(()=>{cleanup[i]?.();cleanup[i]=fn()})}}};
 const code=ts.transpileModule(fs.readFileSync('src/features/landing-page/HeroImageCarousel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,output={};
 new Function('exports','require',code)(output,name=>name==='react'?hooks:name==='next/image'?{__esModule:true,default:()=>null}:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})}:require(name));
 const nodes=(node,predicate)=>{if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(n=>nodes(n,predicate))]};
 const render=()=>within(()=>{let rounds=0;do{assert.ok(rounds++<10,'state settles');dirty=false;slot=0;es=0;tree=output.default(props);effects.splice(0).forEach(fn=>fn())}while(dirty);return tree});
 const find=label=>nodes(tree,n=>n.props?.['aria-label']===label)[0];
 render();return {render,find,timers,load:()=>{nodes(tree,n=>typeof n.props?.onLoad==='function').forEach(n=>n.props.onLoad());render()},tick:()=>{[...timers.values()].forEach(fn=>fn());render()},active:()=>React.Children.toArray(tree.props.children).findIndex(n=>n.props?.['aria-hidden']===false)+1,reduce:()=>{media.matches=true;within(()=>listeners.get('media')());render()},hide:()=>{doc.hidden=true;within(()=>listeners.get('visibilitychange')());render()},show:()=>{doc.hidden=false;within(()=>listeners.get('visibilitychange')());render()},unmount:()=>within(()=>cleanup.forEach(fn=>fn?.())),listeners,images:()=>nodes(tree,n=>typeof n.props?.onLoad==='function')};
}
test('four local photographs, optimized first preload and next images prepared without external URLs',()=>{const c=carousel();assert.equal(c.images().length,4);for(const image of c.images()){assert.match(image.props.src,/^\/images\/hero\/.*\.webp$/);assert.ok(fs.existsSync('public'+image.props.src));}assert.equal(c.images()[0].props.preload,true);assert.equal(c.images()[1].props.loading,'eager');assert.equal(c.timers.size,0);c.load();assert.equal(c.timers.size,1);c.unmount()});
test('three-second autoplay loops seamlessly and ordinary rerenders do not duplicate timers',()=>{const c=carousel();c.load();for(let i=0;i<8;i++)c.render();assert.equal(c.timers.size,1);for(let i=0;i<4;i++){c.tick();assert.equal(c.active(),(i+1)%4+1)}c.unmount();assert.equal(c.timers.size,0);assert.equal(c.listeners.size,0)});
test('automatic carousel has no visible or hidden interactive controls',()=>{const c=carousel();c.load();const source=fs.readFileSync('src/features/landing-page/HeroImageCarousel.tsx','utf8');assert.doesNotMatch(source,/<button|Hero photograph controls|ChevronLeft|ChevronRight|Pause|Play/);assert.equal(c.find('Next hero photograph'),undefined);c.unmount()});
test('hidden tabs suspend autoplay and resume with only one timer',()=>{const c=carousel();c.load();c.hide();assert.equal(c.timers.size,0);const before=c.active();c.tick();assert.equal(c.active(),before);c.show();assert.equal(c.timers.size,1);c.tick();assert.notEqual(c.active(),before);c.unmount()});
test('reduced motion keeps a stable slide without animation or forced advancement',()=>{const c=carousel(true);c.load();assert.equal(c.timers.size,0);c.tick();assert.equal(c.active(),1);c.unmount();const live=carousel();live.load();live.tick();const selected=live.active();live.reduce();assert.equal(live.timers.size,0);live.tick();assert.equal(live.active(),selected);live.unmount()});
test('configured banners remain supported and failed sources use local fallback',()=>{const c=carousel(false,{bannerImages:['/custom.jpg','/other.jpg']});assert.equal(c.images()[0].props.src,'/custom.jpg');c.images()[0].props.onError();c.render();assert.match(c.images()[0].props.src,/\/images\/hero\/villa-pool-wide/);c.unmount()});
test('image-only crossfade preserves layout dimensions without additional zoom',()=>{const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');assert.match(css,/transition:opacity 400ms/);assert.match(css,/min-height:clamp\(620px,43vw,720px\)/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none !important/);assert.doesNotMatch(css,/\.copy\s*\{[^}]*animation:/);assert.doesNotMatch(fs.readFileSync('src/features/landing-page/useLandingProperties.ts','utf8'),/setInterval/)});

test('each slide supplies its own responsive focal point, including fallback images',()=>{
 const c=carousel();const frames=React.Children.toArray(c.render().props.children).filter(n=>typeof n.props?.['aria-hidden']==='boolean');
 assert.deepEqual(frames.map(n=>n.props.style['--hero-focal-desktop']),['62% 0%','48% 20%','50% 0%','45% 0%']);
 assert.deepEqual(frames.map(n=>n.props.style['--hero-focal-mobile']),['64% 18%','43% 18%','52% 35%','42% 12%']);c.unmount();
 const custom=carousel(false,{bannerImages:['/missing.jpg']});custom.images()[0].props.onError();const fallback=React.Children.toArray(custom.render().props.children).find(n=>typeof n.props?.['aria-hidden']==='boolean');assert.equal(fallback.props.style['--hero-focal-desktop'],'62% 0%');custom.unmount();
});

test('full-width image remains sharp while blur is confined to the readable content panel',()=>{
 const css=fs.readFileSync('src/features/landing-page/HeroSection.module.css','utf8');
 assert.match(css,/\.scene\s*\{[^}]*inset:0; width:100%/);
 assert.match(css,/\.copy\s*\{[^}]*backdrop-filter:blur\(14px\) saturate\(130%\)/);
 assert.doesNotMatch(css,/\.(?:hero|scene|image)\s*\{[^}]*backdrop-filter|[;{]\s*filter:blur/);
 assert.match(css,/background:#faf7f1f5/);
 const c=carousel();assert.equal(c.images()[0].props.sizes,'100vw');c.unmount();
});

test('search tabs join the search bar below the hero without negative overlay margins',()=>{
 const css=fs.readFileSync('src/features/landing-page/HeroPropertySearch.module.css','utf8');
 assert.doesNotMatch(css,/margin-top:-/);assert.match(css,/\.tabs \{ display:flex; gap:0; padding-left:0/);assert.match(css,/border-radius:0 0 10px 10px/);
});
