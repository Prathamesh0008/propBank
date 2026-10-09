// Static request inventory. No environment values or credentials are read.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),src=path.join(root,'src');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const files=walk(src).filter(f=>/\.tsx?$/.test(f));
const parsed=new Map(files.map(f=>[f,ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true)]));
const relative=f=>path.relative(src,f).replaceAll('\\','/');
const reachable=new Set();
function resolveImport(from,name) {
 const base=name.startsWith('@/')?path.join(src,name.slice(2)):name.startsWith('.')?path.resolve(path.dirname(from),name):null;
 return base&&[base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(f=>parsed.has(f));
}
function visitFile(f) {
 if(reachable.has(f))return;reachable.add(f);
 function visit(n) {
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)) {
   const next=resolveImport(f,n.moduleSpecifier.text);if(next)visitFile(next);
  }
  if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0])) {const next=resolveImport(f,n.arguments[0].text);if(next)visitFile(next);}
  ts.forEachChild(n,visit);
 }visit(parsed.get(f));
}
files.filter(f=>/^app\//.test(relative(f))&&!relative(f).startsWith('app/api/')).forEach(visitFile);
function literal(n) {return n&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;}
const operations=[];
for(const [file,source]of parsed) {
 if(relative(file).startsWith('app/api/')||relative(file).startsWith('lib/server/')||relative(file)==='lib/api-client.ts')continue;
 function expression(n) {
  if(literal(n)!==null)return literal(n);
  if(ts.isTemplateExpression(n))return n.head.text+n.templateSpans.map(span=>{
   const value=span.expression.getText(source);
   if(['API_BASE_URL','baseUrl'].includes(value))return '/api'+span.literal.text;
   if(value==='endpoint')return ':agreementEndpoint'+span.literal.text;
   if(value==='searchParams.toString()')return 'q=:q&listingType=:listingType&projectCondition=:condition'+span.literal.text;
   return ':param'+span.literal.text;
  }).join('');
  if(ts.isIdentifier(n)&&n.text==='url') {
   if(relative(file)==='services/visitService.ts')return '/api/visits?userId=:uid&status=:status';
   if(relative(file).endsWith('TerminateAgreement.tsx'))return '/api/:agreementEndpoint';
  }
  throw new Error(`Unresolved API URL at ${relative(file)}: ${n.getText(source)}`);
 }
 function visit(n) {
  if(ts.isCallExpression(n)) {
   const callee=n.expression.getText(source),axios=/^axios\.(get|post|put|patch|delete|head|options)$/.exec(callee);
   if(['apiFetch','fetch'].includes(callee)||axios) {
    let method=axios?axios[1].toUpperCase():'GET';
    if(!axios&&n.arguments[1]&&ts.isObjectLiteralExpression(n.arguments[1]))for(const p of n.arguments[1].properties)if(ts.isPropertyAssignment(p)&&p.name.getText(source)==='method')method=literal(p.initializer)||'UNRESOLVED';
    const url=expression(n.arguments[0]);
    const urls=url.includes(':agreementEndpoint')?['/api/agreements/'+(relative(file).endsWith('RenewAgreement.tsx')?'renew':'terminate'),'/api/agreements/'+(relative(file).endsWith('RenewAgreement.tsx')?'request-renewal':'request-termination')]:[url];
    for(let endpoint of urls) {
     if(!endpoint.startsWith('/api'))throw new Error(`Nonlocal request needs review: ${endpoint}`);
     endpoint=endpoint.replace(/\/properties\/:param/g,'/properties/:id').replace(/\/users\/:param/g,'/users/:id').replace(/\/visits\/:param/g,'/visits/:id').replace(/\/documents\/property\/:param/g,'/documents/property/:propertyId').replace(/\/documents\/:param/g,'/documents/:id').replace(/\/inspection-reports\/property\/:param/g,'/inspection-reports/property/:propertyId').replace(/\/inspection-reports\/user\/:param/g,'/inspection-reports/user/:userId').replace(/\/service-requests\/:param/g,'/service-requests/:id').replace(/\/admin\/notifications\/:param/g,'/admin/notifications/:id');
     endpoint=endpoint.replace(/(userId|ownerUID|userUID)=:param/g,'$1=:uid').replace(/phone=:param/g,'phone=:phone').replace(/userEmail=:param/g,'userEmail=:email').replace(/listingType=:param/g,'listingType=:listingType').replace(/propertyId=:param/g,'propertyId=:propertyId');
     if(endpoint.includes(':param'))throw new Error(`Unnormalized endpoint ${endpoint}`);
     operations.push({method,endpoint,caller:relative(file)+':'+(source.getLineAndCharacterOfPosition(n.getStart()).line+1),reachable:reachable.has(file)});
    }
   }
  }
  ts.forEachChild(n,visit);
 }visit(source);
}
const routes=[];
for(const [file,source]of parsed) {
 if(!relative(file).startsWith('app/api/')||!file.endsWith('route.ts'))continue;
 const endpoint='/api/'+relative(file).slice(8,-9).replace(/\/$/,'');
 const methods={};
 for(const statement of source.statements) {
  if(ts.isVariableStatement(statement)&&statement.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))for(const d of statement.declarationList.declarations)if(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(d.name.getText(source)))methods[d.name.getText(source)]=d.initializer?.getText(source)||'';
  if(ts.isExportDeclaration(statement)&&statement.exportClause&&ts.isNamedExports(statement.exportClause))for(const e of statement.exportClause.elements)if(e.name.text==='OPTIONS')methods.OPTIONS='corsOptions';
 }
 const service=[...source.text.matchAll(/from ['"]@\/lib\/server\/services\/([^'"]+)/g)].map(m=>m[1]).join(', ');
 routes.push({endpoint:endpoint==='/api/'?'/api':endpoint,file:relative(file),methods,service});
}
function matchRoute(endpoint) {
 const pathname=endpoint.split('?')[0].replace(/\/$/,'');
 return routes.filter(r=>r.endpoint!=='/api/[...path]').sort((a,b)=>b.endpoint.length-a.endpoint.length).find(r=>{
  const regex='^'+r.endpoint.replace(/\[\.\.\.[^\]]+\]/g,'.+').replace(/\[[^\]]+\]/g,'[^/]+')+'$';return new RegExp(regex).test(pathname);
 });
}
const grouped=new Map();
for(const op of operations) {
 const key=op.method+' '+op.endpoint;
 if(!grouped.has(key))grouped.set(key,{...op,callers:[],reachable:false});
 const row=grouped.get(key);row.callers.push(op.caller);row.reachable||=op.reachable;
}
const newRoutes=['auth/login','services','service-requests','service-requests/[id]','reviews','inspection-reports','inspection-reports/property/[propertyId]','inspection-reports/user/[userId]','admin/site-settings'].map(v=>'/api/'+v);
const rows=[...grouped.values()].sort((a,b)=>a.endpoint.localeCompare(b.endpoint)||a.method.localeCompare(b.method)).map(row=>{
 const route=matchRoute(row.endpoint);const implemented=route?.methods[row.method]&&!route.methods[row.method].includes('unsupported');
 return {...row,route:route?.file||'(no route)',service:route?.service||'(none)',status:!row.reachable?'UNUSED':!route?'METHOD-MISSING':implemented?'NATIVE':'METHOD-MISSING',nativeImplemented:!!implemented,before:!row.reachable?'UNUSED':newRoutes.includes(route?.endpoint)?'PROXY-ONLY':implemented?'NATIVE':route?'METHOD-MISSING':'PROXY-ONLY'};
});
const uniqueActive=new Set(rows.filter(r=>r.reachable).map(r=>r.method+' '+r.endpoint.split('?')[0].replace(/\/$/,'')));
const output={callSites:operations.length,sourceOperations:rows.length,activeOperations:rows.filter(r=>r.reachable).length,uniqueActiveMethodPaths:uniqueActive.size,rows,routes};
const out=path.join(root,'migration-audit');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'api-inventory.json'),JSON.stringify(output,null,2)+'\n');
let markdown=`# Active API migration inventory\n\nGenerated by scripts/audit-active-api.cjs. Source-wide AST enumeration of fetch, apiFetch and axios; local variable URLs and both agreement branches resolved. TypeScript imports from app entries determine module reachability. Reachable-module helper methods are conservatively included even when a particular exported helper has no current caller. Query variants count separately; unique method/path count removes queries and trailing slashes. UNUSED means no app import path to the caller module, not necessarily no possible future use. All specific API routes are permanently native.\n\n${output.callSites} request expressions after expanding conditional agreement URLs; ${output.sourceOperations} normalized source operations; ${output.activeOperations} reachable-module operations; ${output.uniqueActiveMethodPaths} active method/path pairs.\n\n| METHOD | FRONTEND ENDPOINT | FRONTEND CALLER | NEXT.JS ROUTE | NATIVE SERVICE | STATUS | BEFORE |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
for(const r of rows)markdown+=`| ${r.method} | ${r.endpoint} | ${r.callers.join('<br>')} | ${r.route} | ${r.service} | ${r.status} | ${r.before} |\n`;
markdown+='\n## All Next.js route exports\n\nRejected methods are explicit 405 handlers and do not count as native operations.\n\n| Route | Implemented methods | Explicit 405 methods | Service |\n| --- | --- | --- | --- |\n';
for(const r of routes)markdown+=`| ${r.file} | ${Object.entries(r.methods).filter(([,v])=>!v.includes('unsupported')).map(([m])=>m).join(', ')} | ${Object.entries(r.methods).filter(([,v])=>v.includes('unsupported')).map(([m])=>m).join(', ')} | ${r.service||'HTTP helpers'} |\n`;
const used=new Set(rows.filter(r=>r.reachable).map(r=>r.method+' '+r.endpoint.split('?')[0].replace(/\/$/,'')));
markdown+='\n## Native business operations without active frontend callers\n\n| METHOD | ENDPOINT | STATUS |\n| --- | --- | --- |\n';
for(const r of routes)for(const [method,body]of Object.entries(r.methods)) {
 if(['HEAD','OPTIONS'].includes(method)||body.includes('unsupported'))continue;
 const endpoint=r.endpoint.replace(/\[(?:\.\.\.)?([^\]]+)\]/g,':$1');
 if(!used.has(method+' '+endpoint)&&!(r.endpoint==='/api/files/[...path]'&&used.has('DELETE /api/files/delete')))markdown+=`| ${method} | ${endpoint} | UNUSED |\n`;
}
fs.writeFileSync(path.join(out,'API_INVENTORY.md'),markdown);
// The prior Go dispatch table documents unchanged registrations and handlers.
// Compare method/path coverage, not its now-stale migration-status column.
const legacy=[];
for(const line of fs.readFileSync(path.join(root,'../BACKEND_STRANGLER_TABLE.md'),'utf8').split('\n')) {
 if(!/^\| (GET|POST|PUT|PATCH|DELETE)/.test(line))continue;
 const columns=line.split('|').map(v=>v.trim()),raw=columns[2].match(/`([^`]+)`/)?.[1];if(!raw)continue;
 const endpoint='/api'+raw.split('?')[0].replace(/\/$/,'');
 for(const method of columns[1].split(', ')) {
  if(used.has(method+' '+endpoint)||(endpoint==='/api/files/:path'&&used.has('DELETE /api/files/delete')))continue;
  const route=matchRoute(endpoint),implemented=route?.methods[method]&&!/unsupported/.test(route.methods[method]);
  legacy.push({method,endpoint,handler:columns[3],status:'UNUSED',implementation:implemented?'NATIVE':'REMOVED'});
 }
}
const uniqueLegacy=[...new Map(legacy.map(v=>[v.method+' '+v.endpoint,v])).values()];
uniqueLegacy.push({method:'ANY',endpoint:'/api',handler:'Go root health',status:'UNUSED',implementation:'REMOVED'}, {method:'ANY',endpoint:'/api/admin/trigger-reminders',handler:'ReminderScheduler.ForceCheck',status:'UNUSED',implementation:'REMOVED'});
fs.writeFileSync(path.join(out,'unused-legacy-go.json'),JSON.stringify(uniqueLegacy,null,2)+'\n');
fs.appendFileSync(path.join(out,'API_INVENTORY.md'),'\n## Unused legacy Go operations\n\nCount includes the root health and reminder dispatches as one ANY operation each.\n\n| METHOD | ENDPOINT | GO HANDLER | IMPLEMENTATION | STATUS |\n| --- | --- | --- | --- | --- |\n'+uniqueLegacy.map(r=>`| ${r.method} | ${r.endpoint} | ${r.handler} | ${r.implementation} | UNUSED |`).join('\n')+'\n');
console.log(JSON.stringify({callSites:output.callSites,sourceOperations:output.sourceOperations,activeOperations:output.activeOperations,uniqueActiveMethodPaths:output.uniqueActiveMethodPaths,status:rows.reduce((v,r)=>(v[r.status]=(v[r.status]||0)+1,v),{}),before:rows.reduce((v,r)=>(v[r.before]=(v[r.before]||0)+1,v),{})},null,2));
