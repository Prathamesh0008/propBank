const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {isolated,users,request,route}=require('./fixtures/native-server.cjs');
const id=i=>'E'+String(i).padStart(3,'0');
function setup(count=125){
 const admin_notifications={},enquiry_assignments={},email_deliveries={};
 for(let i=0;i<count;i++){
  admin_notifications[id(i)]={type:'property_enquiry',propertyId:'P',title:'Enquiry '+i,...(i%2?{timestamp:new Date()}:{}),ownerEmail:'SECRET'};
  enquiry_assignments[id(i)]={brokerUID:i%2?'agent':'other',status:'new',version:1};
  const key=createHash('sha256').update(`enquiry:property:${id(i)}:admin`).digest('hex');
  email_deliveries[key]={eventType:'enquiry.property_created',recordId:id(i),status:'sent'};
 }
 return isolated({users:{...users,agent:{...users.other,uid:'agent',email:'agent@test.invalid',role:'agent'}},admin_notifications,enquiry_assignments,email_deliveries});
}
const page=async(app,uid,cursor='',limit=25)=>{
 const response=await route(app,'enquiries').GET(request(`/enquiries?cursor=${encodeURIComponent(cursor)}&limit=${limit}`,uid));
 assert.equal(response.status,200);return response.json();
};
test('admin enquiry cursor covers all records including missing timestamps without duplication',async()=>{
 const app=setup(),seen=[];let cursor='';
 do{const result=await page(app,'admin',cursor);seen.push(...result.enquiries.map(row=>row.id));assert.equal(result.order,'record_id');cursor=result.nextCursor;}while(cursor);
 assert.equal(seen.length,125);assert.equal(new Set(seen).size,125);assert.deepEqual(seen,Array.from({length:125},(_,i)=>id(i)));assert.equal(app.writes.length,0);
});
test('enquiry first page has bounded reads and deterministic delivery joins, not outbox scans or N+1',async()=>{
 const app=setup(500),result=await page(app,'admin');assert.equal(result.enquiries.length,25);assert.equal(result.hasMore,true);assert.ok(result.enquiries.every(row=>row.emailDeliveryStatus==='sent'));assert.ok(!JSON.stringify(result).includes('SECRET'));
 const queries=app.reads.filter(row=>!row.id);assert.equal(queries.length,3);assert.deepEqual(queries.map(row=>row.returnedDocuments),[26,25,25]);assert.ok(queries.slice(1).every(row=>row.filters.some(filter=>filter[0]==='__name__'&&filter[2]==='in')));
 const before=setup(500),db=before.load('@/lib/server/firestore').getDatabase();
 const old=await db.collection('admin_notifications').where('type','==','property_enquiry').get();
 const oldMail=await db.collection('email_deliveries').where('eventType','==','enquiry.property_created').get();
 await Promise.all(old.docs.map(doc=>db.collection('enquiry_assignments').doc(doc.id).get()));
 assert.equal(before.reads.length,502);assert.equal(old.docs.length+oldMail.docs.length+before.reads.filter(row=>row.id).length,1500);
 assert.equal(queries.reduce((sum,row)=>sum+row.returnedDocuments,0),76);
});
test('assigned-agent pagination stays scoped and reaches matches beyond the first page',async()=>{
 const app=setup(),seen=[];let cursor='';do{const result=await page(app,'agent',cursor,10);seen.push(...result.enquiries);cursor=result.nextCursor;}while(cursor);
 assert.equal(seen.length,62);assert.ok(seen.every(row=>row.brokerUID==='agent'));assert.equal(new Set(seen.map(row=>row.id)).size,62);assert.ok(!app.reads.some(row=>row.collection==='email_deliveries'));
});
test('orphaned assignment page continues instead of falsely claiming all records exhausted',async()=>{
 const app=setup(6);delete app.state.admin_notifications.E001;const first=await page(app,'agent','',1);assert.equal(first.enquiries.length,0);assert.equal(first.hasMore,true);assert.equal(first.nextCursor,'E001');const second=await page(app,'agent',first.nextCursor,1);assert.equal(second.enquiries[0].id,'E003');
});
test('enquiry cursor survives deletion of its anchor and newly inserted records do not duplicate earlier pages',async()=>{
 const app=setup(8),first=await page(app,'admin','',3);delete app.state.admin_notifications[first.nextCursor];app.state.admin_notifications.A={type:'property_enquiry'};const second=await page(app,'admin',first.nextCursor,3);assert.deepEqual(second.enquiries.map(row=>row.id),['E003','E004','E005']);
});
test('enquiry query limits and authorization cannot be widened by caller parameters',async()=>{
 const app=setup();for(const value of ['0','51','NaN','1.5',''])assert.equal((await route(app,'enquiries').GET(request('/enquiries?limit='+value,'admin'))).status,400);
 assert.equal((await route(app,'enquiries').GET(request('/enquiries?cursor=x%2Fy','admin'))).status,400);
 for(const uid of [undefined,'owner','tenant'])assert.equal((await route(app,'enquiries').GET(request('/enquiries',uid))).status,uid?403:401);
 const max=await page(app,'admin','',50);assert.equal(max.enquiries.length,50);assert.equal(max.hasMore,true);
});
