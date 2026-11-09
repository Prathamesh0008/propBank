const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');

function saveHandler(scope){
 const file='src/features/properties/FurnishedChecklistModal.tsx';
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let expression;function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='handleSave')expression=node.initializer.getText(source);ts.forEachChild(node,walk);}walk(source);assert.ok(expression);
 const compiled=ts.transpile(`const handler = ${expression};`,{target:ts.ScriptTarget.ES2022});
 return new Function(...Object.keys(scope),compiled+'; return handler;')(...Object.values(scope));
}
for(const pending of [[],['  Custom lamp  ',' ','Desk']])test(`save emits one complete snapshot outside React updater replay (${pending.length} draft rows)`,()=>{
 const item={id:'bed',name:'Bed',checked:true,quantity:3,category:'bedroom'};
 const original=[item],drafts=[...pending],queued=[],calls=[];let state,customState,phase='event';
 const save=saveHandler({checklist:original,customItems:drafts,setChecklist:next=>{if(typeof next==='function')queued.push(next);else state=next;},setCustomItems:next=>{customState=next;},onSave:value=>{assert.equal(phase,'event','Parent updates must not occur during render');calls.push(['save',value]);},onClose:()=>calls.push(['close']),setTimeout:fn=>fn()});
 save();phase='render';for(const updater of queued){updater(state||original);updater(state||original);}
 assert.equal(calls.length,2);assert.equal(calls[0][0],'save');assert.equal(calls[1][0],'close');assert.equal(calls[0][1],state);assert.deepEqual(state[0],item);assert.equal(state.length,1+pending.filter(value=>value.trim()).length);assert.deepEqual(customState,['']);assert.deepEqual(original,[item]);assert.deepEqual(drafts,pending);
 for(const custom of state.slice(1)){assert.equal(custom.checked,false);assert.equal(custom.quantity,1);assert.equal(custom.category,'other');assert.equal(custom.name,custom.name.trim());}
 assert.equal(new Set(state.map(value=>value.id)).size,state.length);
});
