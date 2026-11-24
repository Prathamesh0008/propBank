const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
function planner(search='',records){
 const values=[],output={};let cursor=0,tree;
 const visit={id:'V',userId:'owner',title:'Previous viewing',description:'Previous notes',propertyId:'P',visitDate:'2099-06-15T10:00:00Z',status:'scheduled',isCompleted:false,managementVersion:2};
 const hooks={...React,useEffect:()=>{},useCallback:fn=>fn,useRef:value=>({current:value}),useState:initial=>{const i=cursor++;if(!(i in values))values[i]=i===0?(records||[visit]):i===3?false:initial;return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next}]}};
 const ui=new Proxy({},{get:(_,key)=>key==='__esModule'?true:key});
 const code=ts.transpileModule(fs.readFileSync('src/features/visit-planner/VisitPlanner.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('exports','require',code)(output,name=>name==='react'?hooks:name.startsWith('@/ui/')?ui:name==='@/lib/navigation'?{useLocation:()=>({search})}:name==='@/contexts/AuthContext'?{useAuth:()=>({user:{uid:'owner'},loading:false})}:name==='@tanstack/react-query'?{useQuery:()=>({data:{properties:[{id:'P',title:'Synthetic property'}]},isPending:false})}:name==='@/hooks/use-toast'?{useToast:()=>({toast:()=>{}})}:name==='@/services/visitService'?{visitService:{}}:name==='@/services/propertyService'?{propertyService:{}}:name==='@/lib/data-refresh'?{useDataRefresh:()=>{}}:name==='@/lib/date-format'?{formatDisplayDate:v=>v,formatDisplayTime:v=>v}:name==='@/lib/form-validation'?{indiaCalendarDate:()=> '2099-01-01',indiaDateTimeParts:()=>({date:'2099-06-15',time:'15:30'})}:name.endsWith('.css')?{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})}:require(name));
 const nodes=(node,predicate)=>{if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...React.Children.toArray(node.props?.children).flatMap(child=>nodes(child,predicate))]};
 const text=node=>typeof node==='string'||typeof node==='number'?String(node):node&&typeof node==='object'?React.Children.toArray(node.props?.children).map(text).join(''):'';
 const render=()=>{cursor=0;tree=output.default();return tree};render();return {render,text:()=>text(tree),tab:value=>nodes(tree,n=>n.type==='TabsTrigger'&&n.props.value===value)[0],switchTab:value=>{nodes(tree,n=>n.type==='Tabs')[0].props.onValueChange(value);render()},field:id=>nodes(tree,n=>n.props?.id===id)[0],button:label=>nodes(tree,n=>n.type==='Button'&&text(n).trim()===label)[0],select:()=>nodes(tree,n=>n.type==='select')[0],time:()=>nodes(tree,n=>n.type==='TimePicker')[0]};
}
test('Schedule New Visit clears an existing reschedule draft, property filter and edit identity',()=>{
 const p=planner('?propertyId=P');p.button('Reschedule').props.onClick();p.render();assert.equal(p.field('title').props.value,'Previous viewing');assert.equal(p.select().props.value,'P');p.field('propertySearch').props.onChange({target:{value:'Old property search'}});p.render();
 p.button('Schedule New Visit').props.onClick();p.render();for(const id of ['title','description','date','propertySearch'])assert.equal(p.field(id).props.value,'',id);assert.equal(p.time().props.value,'');assert.equal(p.select().props.value,'');assert.equal(p.select().props.disabled,false);assert.ok(p.button('Schedule Visit'));assert.equal(p.button('Update Visit'),undefined);
});
test('first-time property deep links keep their existing creation default',()=>{const p=planner('?propertyId=P');p.button('Schedule New Visit').props.onClick();p.render();assert.equal(p.select().props.value,'P');assert.equal(p.field('title').props.value,'');assert.equal(p.time().props.value,'')});

test('status tabs show actual counts, preserve terminal actions and explain empty cancelled results',()=>{
 const p=planner();assert.match(p.text(),/Active VisitsActive\(1\)/);assert.match(p.text(),/Linked property/);assert.ok(p.button('Visited'));assert.ok(p.button('Cancel'));p.switchTab('cancelled');assert.match(p.text(),/Cancelled visits will appear here/);assert.equal(p.button('Reschedule'),undefined);p.switchTab('visited');assert.match(p.text(),/mark them complete/);
});
test('general reminders render their notes without inventing a linked property',()=>{
 const p=planner('',[{id:'G',title:'General follow-up',description:'Call about options',visitDate:'2099-01-01',status:'scheduled'}]);assert.match(p.text(),/General Reminder/);assert.match(p.text(),/Call about options/);assert.doesNotMatch(p.text(),/Linked property/);
});
test('completed and cancelled visits remain read-only and appear only in their selected tab',()=>{
 const p=planner('',[{id:'D',title:'Finished viewing',visitDate:'2099-01-01',status:'completed',isCompleted:true},{id:'C',title:'Cancelled viewing',visitDate:'2099-01-02',status:'cancelled'}]);assert.match(p.text(),/No active visits scheduled/);p.switchTab('visited');assert.match(p.text(),/Finished viewing/);assert.doesNotMatch(p.text(),/Cancelled viewing/);assert.equal(p.button('Cancel'),undefined);p.switchTab('cancelled');assert.match(p.text(),/Cancelled viewing/);assert.equal(p.button('Visited'),undefined);
});
