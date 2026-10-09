import { test, expect } from '@playwright/test';

const routes=['/upload','/upload/image','/upload/document','/upload/property-images','/upload/service-request-image','/files/ignored/path','/files/','/visits','/visits/fixture','/tenants','/tenants/fixture','/documents','/documents/property/','/documents/property/fixture','/documents/fixture','/agreements/renew','/agreements/terminate','/agreements/request-renewal','/agreements/request-termination','/admin/notifications','/admin/notifications/fixture','/admin/notifications/fixture/read','/admin/notifications/fixture/remarks'];
test('all 23 native routes override catch-all for OPTIONS and HEAD in the real Next server',async({request})=>{
 for(const path of routes){const options=await request.fetch('/api'+path,{method:'OPTIONS'});expect(options.status(),path).toBe(200);expect(options.headers()['x-reference'],path).toBeUndefined();expect(options.headers()['access-control-allow-headers']).toContain('Authorization');const head=await request.head('/api'+path);expect(head.status(),path).toBe(405);expect(head.headers()['x-reference'],path).toBeUndefined();}
});
test('native protected endpoints reject anonymous requests without accessing Firebase or R2',async({request})=>{
 for(const [method,path]of [['POST','/upload/image'],['POST','/visits'],['GET','/visits/fixture'],['POST','/tenants'],['GET','/tenants/fixture'],['POST','/documents'],['GET','/documents/property/fixture'],['GET','/documents/fixture'],['POST','/agreements/renew'],['POST','/agreements/request-renewal'],['GET','/admin/notifications'],['PUT','/admin/notifications/fixture/read'],['PUT','/admin/notifications/fixture/remarks'],['DELETE','/admin/notifications/fixture'],['DELETE','/files/ignored']]){const response=await request.fetch('/api'+path,{method,...(method==='GET'?{}:{data:{}})});expect(response.status(),path).toBe(401);expect(response.headers()['x-reference'],path).toBeUndefined();expect(await response.json()).toEqual({success:false,message:'Firebase ID token required'});}
});
test('Go collection-path validation and unsupported verbs remain native',async({request})=>{
 const missing=await request.get('/api/visits');expect(missing.status()).toBe(400);expect(await missing.text()).toBe('User ID required for visits\n');
 const slash=await request.get('/api/visits/');expect(slash.status()).toBe(400);expect(await slash.text()).toBe('Visit ID is required\n');
 const unsupported=await request.patch('/api/documents/fixture',{data:{}});expect(unsupported.status()).toBe(405);
 const malformed=await request.post('/api/admin/notifications',{data:'{',headers:{'Content-Type':'application/json'}});expect(malformed.status()).toBe(400);expect(await malformed.text()).toBe('Invalid request body\n');
 for(const [path,message]of [['/api/tenants/','Tenant ID is required\n'],['/api/documents/','Document ID is required\n']]){const response=await request.get(path);expect(response.status()).toBe(400);expect(await response.text()).toBe(message);}
 const property=await request.get('/api/documents/property/');expect(property.status()).toBe(400);expect(await property.json()).toEqual({success:false,message:'Property ID is required'});
});
