// Read-only source inventory. Environment files and credentials are excluded.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name).replaceAll('\\','/')]);
const files=walk('src'),inventory={pages:[],api:[],forms:[],modules:[]};
for(const file of files.filter(f=>/\.tsx?$/.test(f))){
 const text=fs.readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),exports=[],controls=[],forms=[],handlers=[];
 const line=n=>source.getLineAndCharacterOfPosition(n.getStart()).line+1;
 function visit(n){
  if(ts.isFunctionDeclaration(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))exports.push(n.name?.text||'default');
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
   const tag=n.tagName.getText(source),attributes=Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(source),a.initializer?.getText(source)||'true']));
   if(tag==='form')forms.push({line:line(n),...attributes});
   if(['input','Input','textarea','Textarea','select','Select','Checkbox','DatePicker','TimePicker','FormField'].includes(tag))controls.push({tag,line:line(n),...attributes});
   for(const key of ['onSubmit','onClick'])if(attributes[key])handlers.push({tag,line:line(n),event:key,handler:attributes[key]});
  }
  ts.forEachChild(n,visit);
 }visit(source);
 const calls=[...text.matchAll(/(?:apiFetch|axios\.(?:get|post|put|patch|delete)|workflowRequest|fetch)\s*(?:<[^;]+?>)?\(/g)].map(m=>({line:text.slice(0,m.index).split('\n').length,expression:text.slice(m.index,m.index+220).split('\n').slice(0,3).join(' ')}));
 inventory.modules.push({file,exports,bytes:Buffer.byteLength(text)});
 if(file.endsWith('/page.tsx')){const route='/'+file.slice(8,-9).split('/').filter(p=>!p.startsWith('(')).join('/');inventory.pages.push({route:route.replace(/\/$/,'')||'/',file,imports:[...text.matchAll(/from ["']([^"']+)/g)].map(m=>m[1]),redirect:text.match(/redirect\("([^"]+)"\)/)?.[1]||'',access:file.includes('(protected)')?'Firebase user':file.includes('/admin/')?'Persisted admin role':file.includes('/sell/')?'Redirect to protected intake':'Public'});}
 if(file.endsWith('/route.ts'))inventory.api.push({file,exports:text.match(/export (?:const|\{)[^;]+/g)});
 if((controls.length||forms.length)&&!file.startsWith('src/ui/'))inventory.forms.push({file,forms,controls,handlers,calls});
}
fs.writeFileSync('functional-audit/source-inventory.json',JSON.stringify(inventory,null,2)+'\n');
let md='# Source control and form inventory\n\nGenerated from TypeScript AST by `node scripts/audit-project.cjs`. This is source evidence, not a test PASS. Dynamic mapped fields and validation need the workflow table in FUNCTIONAL_AUDIT_2026.md.\n\n';
for(const f of inventory.forms){md+=`## ${f.file}\n\nForms: ${f.forms.map(v=>`line ${v.line}: ${v.onSubmit||'(none)'}`).join('; ')||'button-driven controls'}\n\n| Control | Line | Field / ID | Type | Required / limits |\n| --- | --- | --- | --- | --- |\n`;for(const c of f.controls)md+=`| ${c.tag} | ${c.line} | ${c.name||c.id||c['aria-label']||'(state or mapped field)'} | ${c.type||''} | ${['required','min','max','minLength','maxLength','accept'].filter(k=>c[k]).map(k=>k+'='+c[k]).join(', ')} |\n`;md+='\nHandlers: '+f.handlers.map(h=>`${h.tag}:${h.line} ${h.event}=${h.handler.replaceAll('|','/').replaceAll('\n',' ')}`).join('; ')+'\n\n';}
fs.writeFileSync('functional-audit/FORM_SOURCE_INVENTORY.md',md);
console.log(JSON.stringify({modules:inventory.modules.length,pages:inventory.pages.length,apiRoutes:inventory.api.length,controlModules:inventory.forms.length,formElements:inventory.forms.reduce((n,f)=>n+f.forms.length,0)},null,2));
