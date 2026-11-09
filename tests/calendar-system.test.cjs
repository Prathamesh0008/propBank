const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function loader(react=React,headless=false){const cache=new Map();return function load(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.tsx')?'.tsx':'.ts';if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const scoped=name=>{if(name==='react')return react;if(name.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};if(headless&&name==='./calendar')return {Calendar:'Calendar'};if(headless&&name==='./popover')return {Popover:'Popover',PopoverContent:'PopoverContent',PopoverTrigger:'PopoverTrigger'};if(name.startsWith('@/'))return load(path.resolve('src',name.slice(2)));if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name));return require(name);};new Function('require','exports',code)(scoped,out);return out;};}
const dates=loader()('src/lib/calendar-date.ts');
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);return tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function harness(props={},component='DatePicker'){
 let index=0,effects=[],slots=[],currentProps=props,tree;
 const input={message:'',focusCount:0,setCustomValidity(value){this.message=value;},focus(){this.focusCount++;},form:{addEventListener(){},removeEventListener(){}}};
 const react={...React,forwardRef:fn=>(props)=>fn(props,props.ref),useState(initial){const i=index++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},useRef(value){const i=index++;if(!slots[i])slots[i]={current:value};return slots[i];},useId(){return 'calendar-'+index++;},useEffect(fn,deps){const i=index++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j])))effects.push(fn);slots[i]={deps};}};
 const ui=loader(react,true)(component==='DateTimePicker'?'src/ui/date-time-picker.tsx':'src/ui/date-picker.tsx');
 const render=(next=currentProps)=>{currentProps=next;index=0;effects=[];tree=ui[component](currentProps);for(const n of nodes(tree))if(n.type==='input'&&n.props.type==='text')n.props.ref?.(input);for(const effect of effects)effect();return tree;};
 return {render,input,find:type=>nodes(tree).find(n=>n.type===type),all:()=>nodes(tree)};
}
test('date-only parsing rejects overflow, accepts leap years and round-trips month ends',()=>{
 for(const value of ['2024-02-29','2000-02-29','2026-01-31','2026-04-30','0099-12-31'])assert.equal(dates.calendarValue(dates.parseCalendarDate(value)),value);
 for(const value of ['2025-02-29','1900-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','9-1-2026','2026-01-01T00:00:00Z'])assert.equal(dates.parseCalendarDate(value),undefined);
 assert.equal(dates.displayCalendarDate('2024-02-29'),'29-02-2024');assert.equal(dates.parseCalendarDisplay('29-02-2024'),'2024-02-29');assert.equal(dates.parseCalendarDisplay('31-02-2024'),'');
});
test('timezone defaults to India and civil dates survive UTC and American timezones',()=>{
 const now=new Date('2026-11-08T20:00:00Z');assert.equal(dates.calendarToday(undefined,now),'2026-11-09');assert.equal(dates.calendarToday('America/Los_Angeles',now),'2026-11-08');
 const original=process.env.TZ;try{for(const zone of ['UTC','Asia/Kolkata','America/Los_Angeles','Pacific/Auckland']){process.env.TZ=zone;assert.equal(dates.calendarValue(dates.parseCalendarDate('2024-03-10')),'2024-03-10');assert.equal(dates.displayCalendarDate('2024-11-03'),'03-11-2024');}}finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
test('minimum/maximum and disabled-date constraints are inclusive and ranges ordered',()=>{
 assert.equal(dates.calendarAllowed('2024-02-29','2024-02-29','2024-03-01'),true);assert.equal(dates.calendarAllowed('2024-02-28','2024-02-29'),false);assert.equal(dates.calendarAllowed('2024-03-02',undefined,'2024-03-01'),false);assert.equal(dates.calendarAllowed('2024-02-29',undefined,undefined,d=>d.getDate()===29),false);assert.equal(dates.validCalendarRange('2024-02-29','2024-03-01'),true);assert.equal(dates.validCalendarRange('2024-03-01','2024-02-29'),false);
});
test('shared fields display Indian dates but submit canonical named values, including month selection',()=>{
 const ui=loader()('src/ui/date-picker.tsx');const html=renderToStaticMarkup(React.createElement(ui.DatePicker,{name:'leaseStart',value:'2024-02-29',required:true,'aria-label':'Lease start'}));assert.match(html,/value="29-02-2024"/);assert.match(html,/type="hidden" name="leaseStart" value="2024-02-29"/);assert.doesNotMatch(html,/type="date"/);
 const month=renderToStaticMarkup(React.createElement(ui.CalendarInput,{type:'month',name:'rentMonth',defaultValue:'2026-11'}));assert.match(month,/value="11-2026"/);assert.match(month,/name="rentMonth" value="2026-11"/);
 const calendar=renderToStaticMarkup(React.createElement(loader()('src/ui/calendar.tsx').Calendar,{mode:'single',month:new Date(2024,1,1)}));assert.match(calendar,/Calendar month/);assert.match(calendar,/Calendar year/);assert.match(calendar,/Previous month/);assert.match(calendar,/29/);
});
test('manual invalid/out-of-range values block submission and never emit corrupt dates',()=>{
 const changes=[],h=harness({defaultValue:'2024-02-28',min:'2024-02-01',max:'2024-02-29',onChange:v=>changes.push(v)});h.render();h.find('input').props.onChange({target:{value:'31-02-2024'}});assert.ok(h.input.message);assert.deepEqual(changes,[]);h.render();h.find('input').props.onChange({target:{value:'01-03-2024'}});assert.ok(h.input.message);h.render();h.find('input').props.onChange({target:{value:'29-02-2024'}});assert.equal(h.input.message,'');assert.deepEqual(changes,['2024-02-29']);h.render();assert.equal(h.find('input').props.value,'29-02-2024');
});
test('keyboard opens calendar, selection closes it, Escape closes, and focus returns',()=>{
 const changes=[],h=harness({value:'2024-02-28',onChange:v=>changes.push(v)});h.render();h.find('input').props.onKeyDown({key:'ArrowDown',preventDefault(){}});h.render();assert.equal(h.find('Popover').props.open,true);h.find('Calendar').props.onSelect(new Date(2024,1,29));h.render();assert.equal(h.find('Popover').props.open,false);assert.deepEqual(changes,['2024-02-29']);h.find('PopoverContent').props.onCloseAutoFocus({preventDefault(){}});assert.equal(h.input.focusCount,1);h.find('input').props.onKeyDown({key:'Escape'});h.render();assert.equal(h.find('Popover').props.open,false);
});
test('clear respects required fields and native handler bridge emits canonical values',()=>{
 const h=harness({value:'2024-02-29',required:true});h.render();assert.ok(!h.all().some(n=>n.type==='button'&&n.props.children==='Clear'));
 const changes=[],bridge=harness({type:'date',name:'dateFrom',onChange:e=>changes.push([e.target.name,e.target.value])},'CalendarInput');const tree=bridge.render();tree.props.onChange('2024-02-29');assert.deepEqual(changes,[['dateFrom','2024-02-29']]);
 const optional=harness({defaultValue:'2024-02-29'});optional.render();optional.all().find(n=>n.type==='button'&&n.props.children==='Clear').props.onClick();optional.render();assert.equal(optional.find('input').props.value,'');
});
test('range endpoints constrain each other without widening external limits',()=>{
 const h=harness({value:{from:'2024-02-20',to:'2024-03-20'},min:'2024-02-01',max:'2024-03-01',fromName:'from',toName:'to'},'DateRangePicker');const tree=h.render(),fields=nodes(tree).filter(n=>typeof n.type==='function');assert.equal(fields[0].props.max,'2024-03-01');assert.equal(fields[1].props.min,'2024-02-20');assert.equal(fields[0].props.name,'from');assert.equal(fields[1].props.name,'to');
});
test('all native Input dates/months use the shared adapter; scheduling and derived dates retain domain rules',()=>{
 const input=fs.readFileSync('src/ui/input.tsx','utf8');assert.match(input,/type==="date"\|\|type==="month"/);assert.match(input,/CalendarInput/);assert.match(fs.readFileSync('src/features/admin/AdminVisits.tsx','utf8'),/DateRangePicker/);assert.match(fs.readFileSync('src/features/admin/AdminEmailDeliveries.tsx','utf8'),/<DatePicker/);assert.match(fs.readFileSync('src/features/visit-planner/VisitPlanner.tsx','utf8'),/min=\{indiaCalendarDate\(\)\}/);assert.match(fs.readFileSync('src/components/NextAgreementFields.tsx','utf8'),/readOnly aria-readonly/);
});

test('date/time composition keeps civil dates and existing HH:mm scheduling values separate',()=>{
 const changes=[],h=harness({defaultValue:{date:'2024-02-28',time:'14:30'},onChange:value=>changes.push(value)},'DateTimePicker');let tree=h.render(),fields=nodes(tree).filter(n=>typeof n.type==='function');fields[0].props.onChange('2024-02-29');tree=h.render();fields=nodes(tree).filter(n=>typeof n.type==='function');assert.equal(fields[1].props.value,'14:30');fields[1].props.onChange('16:00');assert.deepEqual(changes,[{date:'2024-02-29',time:'14:30'},{date:'2024-02-29',time:'16:00'}]);
});
