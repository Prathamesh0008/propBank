const fs=require('node:fs');const path=require('node:path');
const routes=[
 ['upload','uploads',{POST:'multipartUpload(request)'}],
 ['upload/image','uploads',{POST:"base64Upload(request, 'image')"}],
 ['upload/document','uploads',{POST:'multipartUpload(request, true)'}],
 ['upload/property-images','uploads',{POST:"base64Upload(request, 'property-images')"}],
 ['upload/service-request-image','uploads',{POST:"base64Upload(request, 'service-request-image')"}],
 ['files/[...path]','uploads',{DELETE:'deleteFile(request)'}],
 ['files','uploads',{DELETE:'deleteFile(request)'}],
 ['visits','visits',{GET:'listVisits(request)',POST:'createVisit(request)'}],
 ['visits/[id]','visits',{GET:'getVisit(request, id)',PUT:'updateVisit(request, id)',DELETE:'deleteVisit(request, id)'}],
 ['tenants','tenants',{GET:'listTenants(request)',POST:'createTenants(request)'}],
 ['tenants/[id]','tenants',{GET:'getTenant(request, id)',PUT:'updateTenant(request, id)',DELETE:'deleteTenant(request, id)'}],
 ['documents','documents',{POST:'createDocument(request)'}],
 ['documents/property/[propertyId]','documents',{GET:'listDocuments(request, propertyId)'}],
 ['documents/property','documents',{GET:"listDocuments(request, '')"}],
 ['documents/[id]','documents',{GET:'getDocument(request, id)',DELETE:'deleteDocument(request, id)'}],
 ['agreements/renew','agreements',{POST:'ownerAgreement(request, true)'}],
 ['agreements/terminate','agreements',{POST:'ownerAgreement(request, false)'}],
 ['agreements/request-renewal','agreements',{POST:'tenantAgreement(request, true)'}],
 ['agreements/request-termination','agreements',{POST:'tenantAgreement(request, false)'}],
 ['admin/notifications','notifications',{GET:'listNotifications(request)',POST:'postNotification(request)'}],
 ['admin/notifications/[id]','notifications',{DELETE:'deleteNotification(request, id)'}],
 ['admin/notifications/[id]/read','notifications',{PUT:'readNotification(request, id)'}],
 ['admin/notifications/[id]/remarks','notifications',{PUT:'remarksNotification(request, id)'}],
];
for(const [name,service,methods] of routes){
 const functions=[...new Set(Object.values(methods).map(v=>v.split('(')[0]))];
 const param=name.includes('[id]')?'id':name.includes('[propertyId]')?'propertyId':null;
 let code=`import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';\nimport { nativeGroup2 } from '@/lib/server/native-group2';\nimport { ${functions.join(', ')} } from '@/lib/server/services/${service}';\n\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\nexport const OPTIONS = nativeGroup2(corsOptions);\n`;
 for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD']){
  if(!methods[method]){code+=`export const ${method} = nativeGroup2(unsupported);\n`;continue;}
  const declaration=param?`, context: { params: Promise<{ ${param}: string }> }`:'';
  const body=param?`{ const { ${param} } = await context.params; return ${methods[method]}; }`:methods[method];
  const error=service==='visits'?`Failed to ${method==='GET'?'retrieve':method==='POST'?'create':method==='PUT'?'update':'delete'} visit${!param&&method==='GET'?'s':''}`:service==='tenants'?`Failed to ${method==='GET'?'retrieve':method==='POST'?'add':method==='PUT'?'update':'delete'} tenant${!param?'s':''}`:service==='documents'?`Failed to ${method==='POST'?'create':'delete'} document`:service==='notifications'?method==='POST'?'Failed to create notification':method==='DELETE'?'Failed to delete notification':name.endsWith('/read')?'Failed to update notification status':'Failed to update admin remarks':'Failed to update property';
  code+=`export const ${method} = nativeGroup2(handle(async (request: Request${declaration}) => ${body}, '${error}', ${service==='visits'||service==='documents'}));\n`;
 }
 const file=path.join('src/app/api',name,'route.ts');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,code);
}
console.log(`Created ${routes.length} Group 2 route files; catch-all proxy retained.`);
