const test=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,defaults}=require('./fixtures/native-server.cjs');

function property(overrides={}){return {...defaults,id:'P',title:'Month End Home',isActive:true,status:'active',rentalStatus:'rented',agreementStatus:'active',ownerUID:'owner',timezone:'Asia/Kolkata',paymentDueDate:31,monthlyRent:'30000',tenancyRevision:4,agreementEndDate:'2026-03-31',tenants:[{id:'T',userUID:'tenant',email:'tenant@test.invalid',isActive:true,paymentDueDate:31,monthlyRent:'30000',leaseEndDate:'2026-03-31'}],...overrides};}
function appWith(value=property()){const app=isolated({users:structuredClone(users),properties:{P:value}});app.env.FROM_EMAIL='staging@test.invalid';app.env.CRON_SECRET='x'.repeat(40);app.env.APP_URL='https://staging.propbank.test';return app;}
const load=app=>app.load('@/lib/server/services/reminders');

test('rent reminders cover 7 days, 1 day, and due date for owner and tenant',()=>{
  for(const [date,offset] of [['2026-02-21T06:00:00Z',7],['2026-02-27T06:00:00Z',1],['2026-02-28T06:00:00Z',0]]){const events=load(appWith()).propertyReminderEvents(property(),new Date(date)).filter(event=>event.kind==='rent_due');assert.equal(events.length,2);assert.deepEqual([...events.map(event=>event.recipientRole)].sort(),['owner','tenant']);assert.ok(events.every(event=>event.offset===offset&&event.dueDate==='2026-02-28'&&event.period==='2026-02'));}
});

test('agreement reminders cover 30, 15, and 7 days for current owner and tenant',()=>{
  for(const [date,offset] of [['2026-03-01T06:00:00Z',30],['2026-03-16T06:00:00Z',15],['2026-03-24T06:00:00Z',7]]){const events=load(appWith()).propertyReminderEvents(property(),new Date(date)).filter(event=>event.kind==='agreement_expiry');assert.equal(events.length,2);assert.deepEqual([...events.map(event=>event.recipientRole)].sort(),['owner','tenant']);assert.ok(events.every(event=>event.offset===offset&&event.dueDate==='2026-03-31'));}
});

test('paid rent, inactive tenancy, termination, and renewed dates suppress obsolete reminders',()=>{
  const service=load(appWith()),rentDate=new Date('2026-02-21T06:00:00Z'),agreementDate=new Date('2026-03-01T06:00:00Z');
  assert.equal(service.propertyReminderEvents(property({rentLedger:{'2026-02':{status:'paid'}}}),rentDate).filter(event=>event.kind==='rent_due').length,0);
  assert.equal(service.propertyReminderEvents(property({tenants:[{...property().tenants[0],isActive:false}]}),rentDate).length,0);
  assert.equal(service.propertyReminderEvents(property({agreementStatus:'terminated'}),agreementDate).length,0);
  assert.equal(service.propertyReminderEvents(property({agreementEndDate:'2026-04-30',tenants:[{...property().tenants[0],leaseEndDate:'2026-04-30'}]}),agreementDate).filter(event=>event.kind==='agreement_expiry').length,0);
});

test('concurrent cron work creates one delivery per recipient and does not duplicate sends',async()=>{
  const app=appWith(property({agreementEndDate:'2027-03-31',tenants:[{...property().tenants[0],leaseEndDate:'2027-03-31'}]})),service=load(app),now=new Date('2026-02-21T06:00:00Z');
  await Promise.all([service.runPropertyReminders(now),service.runPropertyReminders(now)]);
  assert.equal(app.emails.length,2);assert.equal(Object.keys(app.state.email_deliveries).length,2);assert.deepEqual(app.emails.map(mail=>mail.to[0]).sort(),['owner@test.invalid','tenant@test.invalid']);assert.ok(Object.values(app.state.email_deliveries).every(row=>row.status==='sent'&&row.rentPeriod==='2026-02'&&row.reminderOffset===7));
});

test('failed reminder delivery remains safely retryable with the frozen recipient',async()=>{
  const app=appWith(property({agreementEndDate:'2027-03-31',tenants:[{...property().tenants[0],leaseEndDate:'2027-03-31'}]})),service=load(app);app.env.TEST_MAIL_FAIL='1';await service.runPropertyReminders(new Date('2026-02-21T06:00:00Z'));
  const [id,row]=Object.entries(app.state.email_deliveries)[0];assert.equal(row.status,'failed');delete app.env.TEST_MAIL_FAIL;
  const emailService=app.load('@/lib/server/services/transactional-email');const response=await emailService.retryEmailDelivery(new Request('http://test/api/admin/email-deliveries/'+id+'/retry',{method:'POST',headers:{authorization:'Bearer admin','content-type':'application/json'},body:'{}'}),id);assert.equal(response.status,200);await app.flush();assert.equal(app.state.email_deliveries[id].status,'sent');assert.equal(app.emails.at(-1).to[0],row.recipientEmail);
});

test('changed rental terms make an old failed reminder ineligible for retry',async()=>{
  const app=appWith(property({agreementEndDate:'2027-03-31',tenants:[{...property().tenants[0],leaseEndDate:'2027-03-31'}]})),service=load(app);app.env.TEST_MAIL_FAIL='1';await service.runPropertyReminders(new Date('2026-02-21T06:00:00Z'));
  const [id]=Object.entries(app.state.email_deliveries)[0];app.state.properties.P.tenants[0].monthlyRent='32000';delete app.env.TEST_MAIL_FAIL;
  const emailService=app.load('@/lib/server/services/transactional-email');await assert.rejects(()=>emailService.retryEmailDelivery(new Request('http://test',{method:'POST',headers:{authorization:'Bearer admin','content-type':'application/json'},body:'{}'}),id),error=>error.status===409&&/obsolete/.test(error.message));
});

test('delivery continuation resumes inside a property after the twenty-message budget',async()=>{
  const properties={};for(let index=0;index<10;index++){const id=`P${String(index).padStart(3,'0')}`;properties[id]=property({id,title:id,agreementEndDate:index===9?'2026-03-23':'2027-03-31',tenants:[{...property().tenants[0],id:`T${index}`,leaseEndDate:index===9?'2026-03-23':'2027-03-31'}]});}
  const app=isolated({users:structuredClone(users),properties});app.env.FROM_EMAIL='staging@test.invalid';app.env.CRON_SECRET='x'.repeat(40);app.env.APP_URL='https://staging.propbank.test';const service=load(app),now=new Date('2026-02-21T06:00:00Z');
  const first=await service.runPropertyReminders(now);assert.equal(first.sent,20);assert.equal(first.limited,true);assert.ok(first.nextCursor);
  const second=await service.runPropertyReminders(now,first.nextCursor);assert.equal(second.sent,2);assert.equal(second.nextCursor,null);assert.equal(app.emails.length,22);assert.equal(Object.keys(app.state.email_deliveries).length,22);
});

test('property pagination crosses 250 documents and terminates on an exact boundary',async()=>{
  const properties={};for(let index=0;index<251;index++){const id=`P${String(index).padStart(3,'0')}`;properties[id]=property({id,title:id,paymentDueDate:index===250?31:15,agreementEndDate:'2027-03-31',tenants:[{...property().tenants[0],id:`T${index}`,paymentDueDate:index===250?31:15,leaseEndDate:'2027-03-31'}]});}
  const app=isolated({users:structuredClone(users),properties});app.env.FROM_EMAIL='staging@test.invalid';app.env.CRON_SECRET='x'.repeat(40);const service=load(app),now=new Date('2026-02-21T06:00:00Z');
  const first=await service.runPropertyReminders(now);assert.equal(first.scanned,250);assert.equal(first.sent,0);assert.ok(first.nextCursor);
  const second=await service.runPropertyReminders(now,first.nextCursor);assert.equal(second.scanned,1);assert.equal(second.sent,2);assert.equal(second.nextCursor,null);
  const exactApp=isolated({users:structuredClone(users),properties:Object.fromEntries(Object.entries(properties).slice(0,250))});exactApp.env.FROM_EMAIL='staging@test.invalid';exactApp.env.CRON_SECRET='x'.repeat(40);const exactService=load(exactApp),boundary=await exactService.runPropertyReminders(now);const terminal=await exactService.runPropertyReminders(now,boundary.nextCursor);assert.equal(terminal.scanned,0);assert.equal(terminal.nextCursor,null);
  await assert.rejects(()=>service.runPropertyReminders(now,first.nextCursor.slice(0,-1)+'x'),error=>error.status===400);
});
