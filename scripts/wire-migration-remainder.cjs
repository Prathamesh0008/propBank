const fs=require('node:fs'),path=require('node:path');
const routes={
 'auth/login':{POST:['login','Failed to generate token',true]},
 'services':{GET:['listServices','Failed to fetch services',true]},
 'service-requests':{GET:['listServiceRequests','Failed to fetch service requests',true],POST:['createServiceRequest','Failed to create service request',true]},
 'service-requests/[id]':{PUT:['updateServiceRequest','Failed to update service request',true,'(await context.params).id']},
 'reviews':{POST:['createReportOrReview','Failed to create review',false,"'review'"]},
 'inspection-reports':{POST:['createReportOrReview','Failed to create inspection report',false,"'report'"]},
 'inspection-reports/property/[propertyId]':{GET:['listReports','Failed to fetch inspection reports',false,"'propertyId', (await context.params).propertyId"]},
 'inspection-reports/user/[userId]':{GET:['listReports','Failed to fetch inspection reports',false,"'userId', (await context.params).userId"]},
 'admin/site-settings':{GET:['siteSettings','Failed to get site settings'],PUT:['siteSettings','Failed to update site settings'],PATCH:['siteSettings','Failed to update site settings']},
};
for(const [route,methods]of Object.entries(routes)) {
 const param=/\[(\w+)\]/.exec(route)?.[1];
 let code=`import { handle, OPTIONS, unsupported } from '@/lib/server/http';\nimport { ${[...new Set(Object.values(methods).map(v=>v[0]))].join(', ')} } from '@/lib/server/services/migration-remainder';\nexport { OPTIONS };\nexport const runtime = 'nodejs';\nexport const dynamic = 'force-dynamic';\n`;
 for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD']) {
  const spec=methods[method];if(!spec){code+=`export const ${method} = unsupported;\n`;continue;}
  const [fn,message,json,extra]=spec;
  code+=`export const ${method} = handle(async (request: Request${param?`, context: { params: Promise<{ ${param}: string }> }`:''}) => ${fn}(${fn==='listServices'?'':'request'}${extra?`, ${extra}`:''}), '${message}', ${!!json});\n`;
 }
 const file=path.resolve(__dirname,'../src/app/api',route,'route.ts');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,code);
}
