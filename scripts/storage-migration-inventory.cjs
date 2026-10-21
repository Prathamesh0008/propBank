// Read-only Firestore inventory. No storage downloads, bucket listing, writes, migrations,
// emails or scheduler calls. The local manifest contains record IDs and URL hashes only.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const run=process.argv.includes('--live-readonly');
if(!run){console.log('Dry instructions only. Use --live-readonly to scan configured Firestore without writes.');process.exit(0);}
require('@next/env').loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const {initializeApp,cert,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');
const fields={properties:['images','internalImages'],documents:['fileUrl'],inspection_reports:['possessionLetterFile','handoverLetterFile','electricityBillMeterImage','electricityBillReceipt','apartmentConditionImage','apartmentConditionImages','mglBillMeterImage','mglBillReceipt','internetImage','internetReceipt'],service_requests:['image','adminImage'],admin_notifications:['serviceImage','adminImage'],siteSettings:['bannerImages']};
const hash=value=>createHash('sha256').update(value).digest('hex');
const published=p=>p.createdAs!=='tenant'&&p.isActive===true&&p.status!=='inactive'&&['rent','sell'].includes(p.listingType)&&p.rentalStatus!=='rented'&&!p.isSold&&!p.isRented;
async function main(){
 const raw=(process.env.FIREBASE_DATA_CREDENTIALS||process.env.FIREBASE_CREDENTIALS||'').trim();if(!raw)throw new Error('Explicit data credentials required');
 const credentials=JSON.parse(raw.startsWith('{')?raw:fs.readFileSync(path.resolve(raw),'utf8'));
 const projectId=process.env.FIREBASE_DATA_PROJECT_ID||process.env.FIREBASE_PROJECT_ID||'propbank-944fc';if(credentials.project_id!==projectId)throw new Error('Credential project mismatch');
 const app=initializeApp({projectId,credential:cert(credentials)},'storage-inventory-readonly'),db=getFirestore(app);
 const rows=[],summary={mode:'read-only',collections:{},historicalReferences:0,privateReferences:0,publicReferences:0,managedReferences:0,byProvider:{},truncated:false};
 try{for(const [collection,names]of Object.entries(fields)){
  let cursor='',scanned=0,finished=false;
  for(let page=0;page<10;page++){
   let query=db.collection(collection).select(...names,'createdAs','isActive','status','listingType','rentalStatus','isSold','isRented').orderBy('__name__').limit(100);if(cursor)query=query.startAfter(cursor);
   const snapshot=await query.get();scanned+=snapshot.docs.length;
   for(const doc of snapshot.docs){const data=doc.data();for(const field of names){const list=Array.isArray(data[field])?data[field]:[data[field]];for(const [index,url]of list.entries()){
    if(typeof url!=='string'||!url)continue;if(/^\/api\/media\/[a-f0-9-]{36}(?:#file\.pdf)?$/.test(url)){summary.managedReferences++;continue;}
    if(!/^https?:\/\//.test(url)&&!url.startsWith('data:'))continue;
    const publicFile=collection==='siteSettings'&&field==='bannerImages'||collection==='properties'&&field==='images'&&index===0&&published(data);
    let provider='external';if(url.startsWith('data:'))provider='embedded';else{const host=new URL(url).hostname;if(['storage.googleapis.com','firebasestorage.googleapis.com'].includes(host))provider='gcs';else if(process.env.CLOUDFLARE_R2_PUBLIC_URL&&url.startsWith(process.env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/,'')+'/')||host.endsWith('.r2.dev'))provider='r2';}
    rows.push({collection,recordId:doc.id,field,index:Array.isArray(data[field])?index:null,classification:publicFile?'public':'private',provider,urlHash:hash(url)});
    summary.historicalReferences++;summary[publicFile?'publicReferences':'privateReferences']++;summary.byProvider[provider]=(summary.byProvider[provider]||0)+1;
   }}}
   if(snapshot.docs.length<100){finished=true;break;}cursor=snapshot.docs.at(-1).id;
  }
  summary.collections[collection]={scanned,complete:finished};if(!finished)summary.truncated=true;
 }
 summary.uniqueHistoricalUrls=new Set(rows.map(row=>row.urlHash)).size;
 summary.uniquePrivateUrls=new Set(rows.filter(row=>row.classification==='private').map(row=>row.urlHash)).size;
 fs.mkdirSync('phase-1-security',{recursive:true});
 fs.writeFileSync('phase-1-security/private-inventory.local.json',JSON.stringify({createdAt:new Date().toISOString(),rows},null,2)+'\n');
 fs.writeFileSync('phase-1-security/historical-inventory-summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
 }finally{await deleteApp(app);}
}
main().catch(()=>{console.error('Read-only inventory BLOCKED: check credentials, query access and connectivity. No writes were attempted.');process.exitCode=1;});
