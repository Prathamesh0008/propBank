const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {isolated,users,properties:stored,request}=require('./fixtures/native-server.cjs');
function setup(overrides={}) {
 const app=isolated({users}),state=[];let slot=0;
 const calls=[],hooks={...React,useState:initial=>{const i=slot++;if(!(i in state))state[i]=initial;return[state[i],next=>state[i]=next];}};
 const props={properties:[],loading:false,loadingMore:false,hasMore:false,loadMoreProperties:()=>calls.push('load'),isSearching:false,selectedCategories:[],searchQuery:'',searchType:'all',selectedProjectCondition:'',budgetRange:{min:0,max:0},filteredCount:0,sendingEnquiry:null,handleEnquireProperty:async p=>calls.push(p.id),observerTargetRef:{current:null},...overrides};
 const output={},code=ts.transpileModule(fs.readFileSync('src/features/landing-page/PropertiesSection.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('exports','require',code)(output,name=>{
  if(name==='react')return hooks;
  if(name==='@/lib/navigation')return{Link:({to,prefetch,children,...rest})=>React.createElement('a',{...rest,href:to,'data-prefetch':String(prefetch)},children)};
  if(name==='@/ui/button')return{Button:({size,children,...rest})=>React.createElement('button',rest,children)};
  if(name==='@/features/properties/PropertyDetailsDialog')return{__esModule:true,default:()=>React.createElement('button',null,'View Property')};
  if(name.startsWith('@/lib/'))return app.load(name);
  if(name.endsWith('.module.css'))return{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return require(name);
 });
 const tree=()=>output.PropertiesSection(props);
 const walk=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=walk(child,predicate);if(found)return found;}return null;};
 const render=()=>{slot=0;return renderToStaticMarkup(tree())};
 return{props,calls,render,find:predicate=>walk(tree(),predicate),card:()=>{slot=0;const node=walk(tree(),n=>n.type?.name==='PropertyCard');return node.type(node.props)},walk};
}
const property=(extra={})=>({id:'public-card',title:'Isolated property fixture',propertyType:'residential',listingType:'sell',sellingPrice:'7500000',price:10,images:[],city:'Pune',configuration:'2 BHK',carpetArea:'1180',carpetAreaUnit:'sq ft',...extra});
test('featured section has requested heading, eyebrow and real directory route with four properties retained',()=>{
 const h=setup({properties:Array.from({length:4},(_,i)=>property({id:String(i)}))}),html=h.render();assert.match(html,/>EXPLORE PROPERTIES</);assert.match(html,/>Featured Properties</);assert.match(html,/href="\/properties"/);assert.match(html,/View All Properties/);assert.equal((html.match(/<article /g)||[]).length,4);assert.doesNotMatch(html,/rating|stars|properties sold|trusted by/i);
});
test('sale price and asking monthly rent use the shared purpose-aware resolver rather than generic price',()=>{
 const sale=setup({properties:[property()]}).render();assert.match(sale,/75,00,000/);assert.match(sale,/Selling price/);assert.doesNotMatch(sale,/\/ month/);
 const rent=setup({properties:[property({listingType:'rent',expectedRent:'32000',monthlyRent:'20000',price:15})]}).render();assert.match(rent,/32,000/);assert.match(rent,/Expected monthly asking rent/);assert.match(rent,/\/ month/);assert.doesNotMatch(rent,/20,000/);
 const investment=setup({properties:[property({listingType:'pre_leased',investment:{monthlyRentalIncome:50000}})]}).render();assert.match(investment,/75,00,000/);assert.match(investment,/Pre-Leased/);assert.doesNotMatch(investment,/50,000/);
});
test('recorded configuration, city and area retain units; missing or invalid amounts do not invent values',()=>{
 const html=setup({properties:[property()]}).render();assert.match(html,/2 BHK/);assert.match(html,/Pune/);assert.match(html,/1,180 sq ft/);
 const metric=setup({properties:[property({carpetArea:'150',carpetAreaUnit:'sq m'})]}).render();assert.match(metric,/150 sq m/);assert.doesNotMatch(metric,/150 sq ft/);
 const missing=setup({properties:[property({sellingPrice:'',price:0,carpetArea:'',configuration:'',bedrooms:0,city:'',location:'',address:''})]}).render();assert.match(missing,/Price on request/);assert.doesNotMatch(missing,/sq ft|bedroom|MapPin/);
});
test('only actual supplied photographs are used; failed and missing photographs show an honest placeholder',()=>{
 const h=setup({properties:[property({images:['https://public.example.invalid/property.jpg']})]});assert.match(h.render(),/https:\/\/public.example.invalid\/property.jpg/);const card=h.card(),img=h.walk(card,n=>n.type==='img');img.props.onError();const failed=h.render();assert.match(failed,/Photograph not available/);assert.doesNotMatch(failed,/<img/);assert.match(h.render(),/Photograph not available/);
 const missing=setup({properties:[property()]}).render();assert.match(missing,/Photograph not available/);assert.doesNotMatch(missing,/unsplash|portfolio\/|stock|<img/);
});
test('card links use the existing detail route without background prefetch; enquiry and dialog actions remain separate',async()=>{
 const h=setup({properties:[property({id:'card / 1'})]}),html=h.render();assert.match(html,/href="\/property\/card%20%2F%201"/);assert.match(html,/data-prefetch="false"/);assert.match(html,/View Property/);const node=h.walk(h.card(),n=>n.props?.onClick);await node.props.onClick();assert.deepEqual(h.calls,['card / 1']);h.props.sendingEnquiry='card / 1';assert.match(h.render(),/disabled=""[^>]*>Sending\.\.\./);
});
test('loading, empty and filtered empty states are truthful and escape customer-entered search text',()=>{
 assert.match(setup({loading:true}).render(),/role="status"/);const empty=setup().render();assert.match(empty,/New properties will appear here/);assert.doesNotMatch(empty,/<article|<img/);
 const filtered=setup({isSearching:true,filteredCount:0,searchQuery:'<script>not markup</script>'}).render();assert.match(filtered,/No matches in the loaded properties/);assert.match(filtered,/in loaded records/);assert.doesNotMatch(filtered,/<script>/);
});
test('all loaded cards and existing observer/cursor controls survive the four-column presentation',()=>{
 const h=setup({properties:Array.from({length:12},(_,i)=>property({id:String(i)})),hasMore:true});assert.equal((h.render().match(/<article /g)||[]).length,12);h.find(n=>n.type==='button'&&n.props.onClick===h.props.loadMoreProperties).props.onClick();assert.deepEqual(h.calls,['load']);assert.equal(h.find(n=>n.props?.ref===h.props.observerTargetRef).props.ref,h.props.observerTargetRef);h.props.loadingMore=true;assert.match(h.render(),/Loading more properties/);assert.doesNotMatch(h.render(),/>Load more properties/);h.props.hasMore=false;h.props.loadingMore=false;assert.match(h.render(),/class="srOnly">End of loaded listings/);assert.equal(h.find(n=>n.props?.ref===h.props.observerTargetRef).props.className,'endMarker');
});
test('card markup contains no owner contact, tenant details, review audit or private evidence fields',()=>{
 const p=property({ownerEmail:'secret-owner@example.invalid',tenantName:'PRIVATE TENANT',moderationHistory:[{reason:'INTERNAL NOTE'}],preLeased:{existingTenant:{name:'HIDDEN PERSON'},evidence:'private-file-secret'}}),html=setup({properties:[p]}).render();for(const secret of ['secret-owner','PRIVATE TENANT','INTERNAL NOTE','HIDDEN PERSON','private-file-secret'])assert.ok(!html.includes(secret),secret);
});
test('public API continues returning only approved eligible listings and redacts private financial and identity fields',async()=>{
 const base={...stored.P,listingType:'sell',isActive:true,isSold:false,isRented:false,status:'active',moderationStatus:'approved',sellingPrice:'7500000',tenants:[],images:[]};const app=isolated({users,properties:{approved:base,pending:{...base,moderationStatus:'pending_review'},manage:{...base,listingType:'manage'},inactive:{...base,isActive:false},sold:{...base,isSold:true}}});const response=await app.load('@/lib/server/services/properties').listProperties(request('/properties'));assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.properties.map(p=>p.id),['approved']);const html=setup({properties:data.properties}).render();assert.match(html,/75,00,000/);assert.ok(!data.properties[0].ownerEmail);assert.ok(!data.properties[0].tenants);assert.equal(data.properties[0].moderationHistory,undefined);
});
test('responsive four/two/one grid and homepage composition preserve search and existing sections without new fetches',()=>{
 const css=fs.readFileSync('src/features/landing-page/PropertiesSection.module.css','utf8'),source=fs.readFileSync('src/features/landing-page/PropertiesSection.tsx','utf8'),page=fs.readFileSync('src/features/landing-page/LandingPage.tsx','utf8');assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/);assert.match(css,/repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/max-width:650px/);assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion:no-preference/);assert.doesNotMatch(source,/fetch\(|apiFetch|setInterval|setTimeout|useEffect/);assert.ok(page.indexOf('<HeroPropertySearch')<page.indexOf('<PropertiesSection'));assert.ok(page.indexOf('<PropertiesSection')<page.indexOf('<PropertyManagementSections'));assert.match(page,/loadMoreProperties=\{loadMoreProperties\}/);assert.match(page,/coverageIncomplete/);for(const component of ['QuickInquirySection','PortfolioCallToAction','SearchFilterSection'])assert.match(page,new RegExp('<'+component));
});

 test('single listing retains its grid track, duplicate locality is removed, and precision is preserved',()=>{
 const h=setup({properties:[property({location:' , Baner, Pune, ',city:'PUNE',sellingPrice:'7500000.50'})]});const html=h.render();assert.equal((html.match(/<article /g)||[]).length,1);assert.match(html,/Baner, Pune/);assert.doesNotMatch(html,/Pune, PUNE/);assert.match(html,/75,00,000\.5/);
 const css=fs.readFileSync('src/features/landing-page/PropertiesSection.module.css','utf8');assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);assert.doesNotMatch(css,/auto-fit|auto-fill|grid-column.*1.*-1/);assert.match(css,/border-bottom:1px solid #e5dccb/);assert.match(css,/\.actions.*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/\.endMarker.*height:1px/);
});
