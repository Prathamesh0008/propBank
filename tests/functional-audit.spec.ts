import {test,expect} from '@playwright/test';
import {signIn} from './fixtures/browser-session';

test.beforeEach(async({request,page})=>{page.setDefaultTimeout(15000);await request.get('http://127.0.0.1:18081/reset');});
async function guest(page:import('@playwright/test').Page){await page.route('**/api/**',async route=>{const req=route.request();const response=await page.request.fetch(`http://127.0.0.1:18081${new URL(req.url()).pathname}${new URL(req.url()).search}`,{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{data:req.postDataBuffer()!}:{})});await route.fulfill({response});});}

test('all public page destinations render without uncaught client errors',async({page})=>{
 await guest(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/','/about','/auth','/blog','/buy','/contact','/faq','/privacy','/properties','/rent','/search','/services','/support','/terms','/property/P']){
  const response=await page.goto(path);expect(response?.status(),path).toBe(200);await expect(page.locator('h1,h2').first()).toBeVisible();if(path!=='/auth')expect(new URL(page.url()).pathname,path).not.toBe('/auth');
 }
 expect(errors).toEqual([]);
});

test('search type and condition use latest selection and clear without crashing',async({page})=>{
 await guest(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/search?type=rent');await expect(page.getByText('Acceptance Home',{exact:true})).toBeVisible();
 const sale=page.waitForResponse(r=>r.url().includes('/api/properties/search')&&new URL(r.url()).searchParams.get('listingType')==='sell');
 await page.getByRole('combobox').first().click();await page.getByRole('option',{name:'Buy Properties',exact:true}).click();await sale;await expect(page).toHaveURL(/type=buy/);
 await page.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'New Project',exact:true}).click();await expect(page).toHaveURL(/projectCondition=New\+Project/);
 await page.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'All Conditions',exact:true}).click();await expect(page).not.toHaveURL(/projectCondition/);expect(errors).toEqual([]);
});

test('guest inquiry validates empty input, handles network failure, persists success and resets',async({page,request})=>{
 await guest(page);await page.goto('/contact');await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();await expect(page.getByText('Please select Buy, Rent or Sell',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Rent',exact:true}).last().click();await page.getByRole('button',{name:'Residential',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Audit Guest');await page.getByLabel('Email ID',{exact:true}).fill('guest@test.invalid');await page.getByLabel('Mobile No.',{exact:true}).fill('9999999999');
 await page.route('**/api/admin/notifications',route=>route.abort(),{times:1});await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();await expect(page.getByText('Failed to submit inquiry. Please try again.',{exact:true})).toBeVisible();await expect(page.getByLabel('Name',{exact:true})).toHaveValue('Audit Guest');
 await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();await expect(page.getByText('Inquiry Submitted!',{exact:true})).toBeVisible();await expect(page.getByLabel('Name',{exact:true})).toHaveValue('');
 const response=await request.get('http://127.0.0.1:18081/api/admin/notifications',{headers:{Authorization:'Bearer admin'}});expect((await response.json()).some((n:{userName:string})=>n.userName==='Audit Guest')).toBe(true);
});

test('equal original offer still requires customer confirmation in browser',async({browser})=>{
 const customerContext=await browser.newContext(),customer=await customerContext.newPage();await signIn(customer,'customer');await customer.goto('/property/P');await customer.getByLabel('Your offer in rupees').fill('60000');await customer.getByRole('button',{name:'Submit offer',exact:true}).click();await expect(customer.getByText('offered',{exact:true})).toBeVisible();
 const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/property/P');await owner.getByRole('button',{name:'Accept amount',exact:true}).click();await expect(owner.getByText('owner approved',{exact:true})).toBeVisible();await customer.reload();await customer.getByRole('button',{name:'Accept owner-approved amount',exact:true}).click();await expect(customer.getByText('accepted',{exact:true})).toBeVisible();
 await Promise.all([customerContext.unrouteAll({behavior:'wait'}),ownerContext.unrouteAll({behavior:'wait'})]);await Promise.all([customerContext.close(),ownerContext.close()]);
});

test('newsletter and unconfigured social links clearly expose unavailable state',async({page})=>{await guest(page);await page.goto('/');await expect(page.getByRole('button',{name:'Subscribe',exact:true})).toBeDisabled();for(const name of ['Facebook','Instagram','LinkedIn','X'])await expect(page.getByLabel(name,{exact:true})).toHaveAttribute('aria-disabled','true');});


test('admin site settings persist after refresh and reach public homepage',async({page,request})=>{
 await signIn(page,'admin');await page.goto('/admin');await page.getByRole('tab',{name:'Site Settings',exact:true}).click();await page.getByPlaceholder('Enter hero title...').fill('Audit persisted heading');await page.getByRole('button',{name:'Save Settings',exact:true}).click();await expect(page.getByText('Settings Updated',{exact:true})).toBeVisible();await page.reload();await page.getByRole('tab',{name:'Site Settings',exact:true}).click();await expect(page.getByPlaceholder('Enter hero title...')).toHaveValue('Audit persisted heading');const data=await(await request.get('http://127.0.0.1:18081/api/properties')).json();expect(data.heroTitle).toBe('Audit persisted heading');
});

test('visit date picker does not submit the form; scheduled visit persists after refresh',async({page})=>{
 await signIn(page,'owner');await page.goto('/visit-planner?propertyId=P');await page.getByRole('button',{name:'Schedule New Visit',exact:true}).click();await page.getByLabel('Visit Title *',{exact:true}).fill('Audit browser visit');await page.getByRole('button',{name:'Select date',exact:true}).click();await expect(page.getByText('Please fill in all required fields',{exact:true})).toHaveCount(0);
 await page.getByRole('gridcell').filter({visible:true}).last().click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Select time',exact:true}).click();await page.getByRole('button',{name:'3:00 PM',exact:true}).first().click();await page.getByRole('button',{name:'Schedule Visit',exact:true}).click();await expect(page.getByText('Visit Scheduled',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Audit browser visit',{exact:true})).toBeVisible();
});


test('admin verifies owner using same-property evidence and preserves tenant access',async({page,request})=>{
 const created=await request.post('http://127.0.0.1:18081/api/properties',{headers:{Authorization:'Bearer tenant'},data:{createdAs:'tenant',propertyTitle:'Audit Ownership Rental',propertyType:'residential',location:'Isolated test address',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2027-01-01',reportedOwner:{personName:'Owner',phone:'123'}}});expect(created.status()).toBe(200);const id=(await created.json()).property.id;
 const document=await request.post('http://127.0.0.1:18081/api/documents',{headers:{Authorization:'Bearer tenant'},data:{propertyId:id,documentName:'Ownership evidence',documentType:'Certificate',fileUrl:'data:application/pdf;base64,JVBERi0xLjQK'}});expect(document.status()).toBe(201);const doc=(await document.json()).document.id;
 await signIn(page,'admin');await page.goto('/admin');await page.getByRole('tab',{name:'All Properties',exact:true}).click();const card=page.locator('div.rounded-lg').filter({has:page.getByRole('heading',{name:'Audit Ownership Rental',exact:true})}).last();await card.getByRole('button',{name:'View Full Details',exact:true}).click();await page.getByLabel('Existing owner Firebase UID').fill('owner');await page.getByLabel('Reviewed property document ID').fill(doc);await page.getByLabel('Verification review note').fill('Isolated ownership evidence reviewed');await page.getByLabel('I independently verified ownership evidence and the intended account.').check();await page.getByRole('button',{name:'Verify and link owner',exact:true}).click();await expect(page.getByText('Owner verified and linked. Tenant relationships preserved.',{exact:true})).toBeVisible();
 const result=await(await request.get(`http://127.0.0.1:18081/api/properties/${id}`,{headers:{Authorization:'Bearer tenant'}})).json();expect(result.property.ownerUID).toBe('owner');expect(result.property.tenants[0].userUID).toBe('tenant');expect(result.property.ownershipVerification).toBe('verified');
});

test('assigned broker proposes terms but cannot accept on the owner behalf',async({page,request})=>{
 expect((await request.patch('http://127.0.0.1:18081/api/users/customer',{headers:{Authorization:'Bearer admin'},data:{role:'agent'}})).status()).toBe(200);
 const offer=await request.post('http://127.0.0.1:18081/api/negotiations',{headers:{Authorization:'Bearer other'},data:{propertyId:'P',amount:60000}});expect(offer.status()).toBe(201);const n=(await offer.json()).negotiation;
 expect((await request.patch(`http://127.0.0.1:18081/api/negotiations/${n.id}`,{headers:{Authorization:'Bearer admin'},data:{action:'assign_broker',brokerUID:'customer',version:n.version}})).status()).toBe(200);
 await signIn(page,'customer');await page.goto('/property/P');await page.getByLabel('Amount for Acceptance Home').fill('65000');await page.getByRole('button',{name:'Send proposal to owner',exact:true}).click();await expect(page.getByText('proposed',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Accept amount',exact:true})).toHaveCount(0);expect((await request.patch(`http://127.0.0.1:18081/api/negotiations/${n.id}`,{headers:{Authorization:'Bearer customer'},data:{action:'accept',version:3}})).status()).toBe(403);
});


test('empty review keeps the user on the form and writes no review',async({page,request})=>{
 await signIn(page,'tenant');await page.goto('/review/Q');await page.getByRole('button',{name:'Submit Review',exact:true}).click();await expect(page.getByText('Please provide at least one review response.',{exact:true})).toBeVisible();await expect(page).toHaveURL(/review\/Q/);const result=await(await request.get('http://127.0.0.1:18081/api/reviews?propertyId=Q',{headers:{Authorization:'Bearer tenant'}})).json();expect(result.reviews||[]).toHaveLength(0);
});


test('admin rejects and explicitly reopens owner verification while tenant sees the reason and remains private',async({browser,request})=>{
 const created=await request.post('http://127.0.0.1:18081/api/properties',{headers:{Authorization:'Bearer tenant'},data:{createdAs:'tenant',propertyTitle:'Phase2C Verification Home',propertyType:'residential',location:'Isolated verification address',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2027-01-01',reportedOwner:{personName:'Reported Owner',phone:'123'}}});expect(created.status()).toBe(200);const id=(await created.json()).property.id;
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:'All Properties',exact:true}).click();await admin.getByRole('heading',{name:'Phase2C Verification Home',exact:true}).locator('..').locator('..').getByRole('button',{name:'View Full Details',exact:true}).click();
 const decisions=admin.getByRole('region',{name:'Owner verification decisions',exact:true});await decisions.getByLabel('Rejection reason',{exact:true}).fill('Evidence does not identify the supplied owner');await decisions.getByRole('button',{name:'Reject owner verification',exact:true}).click();await expect(decisions.getByText('Owner verification: rejected',{exact:true})).toBeVisible();
 const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto(`/manage-property/${id}`);await expect(tenant.getByText('Verification rejection reason: Evidence does not identify the supplied owner',{exact:true})).toBeVisible();expect((await request.get(`http://127.0.0.1:18081/api/properties/${id}`)).status()).toBe(404);
 await decisions.getByLabel('Reconsideration note (optional)',{exact:true}).fill('New evidence will be reviewed');await decisions.getByRole('button',{name:'Reopen owner verification for review',exact:true}).click();await expect(decisions.getByText('Owner verification: pending',{exact:true})).toBeVisible();await decisions.getByText('Owner verification history',{exact:true}).click();await expect(decisions.locator('li').filter({hasText:'New evidence will be reviewed'})).toBeVisible();
 const record=await(await request.get(`http://127.0.0.1:18081/api/properties/${id}`,{headers:{Authorization:'Bearer tenant'}})).json();expect(record.property.ownerUID).toBe('');expect(record.property.tenants[0].userUID).toBe('tenant');expect(record.property.ownershipVerification).toBe('pending');
 await Promise.all([adminContext.unrouteAll({behavior:'wait'}),tenantContext.unrouteAll({behavior:'wait'})]);await Promise.all([adminContext.close(),tenantContext.close()]);
});

test('admin Visits section filters and cancels a request while requester retains planner visibility',async({browser,request})=>{
 const created=await request.post('http://127.0.0.1:18081/api/visits',{headers:{Authorization:'Bearer tenant'},data:{title:'Phase2C Managed Visit',propertyId:'P',visitDate:'2030-01-01T20:00:00Z',reminderType:'none'}});expect(created.status()).toBe(201);const id=(await created.json()).visit.id;
 expect((await request.post('http://127.0.0.1:18081/api/visits',{headers:{Authorization:'Bearer customer'},data:{title:'Unrelated visit',visitDate:'2030-01-03T10:00:00Z',reminderType:'none'}})).status()).toBe(201);
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:'Visits',exact:true}).click();const visits=admin.getByRole('region',{name:'Admin visits',exact:true});await expect(visits.getByRole('heading',{name:'Phase2C Managed Visit',exact:true})).toBeVisible();
 await visits.getByLabel('Filter visit status',{exact:true}).selectOption('scheduled');await visits.getByLabel('Visit from date',{exact:true}).fill('2030-01-02');await visits.getByLabel('Visit to date',{exact:true}).fill('2030-01-02');await visits.getByLabel('Filter visit property',{exact:true}).fill('P');await visits.getByRole('button',{name:'Filter visits',exact:true}).click();await expect(visits.getByRole('heading',{name:'Unrelated visit',exact:true})).toHaveCount(0);await expect(visits.getByText('Requester: Tenant / tenant@test.invalid / 456',{exact:true})).toBeVisible();
 await visits.getByLabel('Visit status',{exact:true}).selectOption('cancelled');await visits.getByRole('button',{name:'Save visit status',exact:true}).click();await expect(visits.getByText('No visits match these filters.',{exact:true})).toBeVisible();await visits.getByLabel('Filter visit status',{exact:true}).selectOption('cancelled');await visits.getByRole('button',{name:'Filter visits',exact:true}).click();await expect(visits.getByText('Status: cancelled',{exact:true})).toBeVisible();await visits.getByText('Administrative visit history',{exact:true}).click();await expect(visits.locator('li').filter({hasText:'admin'})).toBeVisible();
 const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto('/visit-planner');await tenant.getByRole('tab',{name:/Cancelled/}).click();await expect(tenant.getByText('Phase2C Managed Visit',{exact:true})).toBeVisible();
 expect((await request.get('http://127.0.0.1:18081/api/admin/visits',{headers:{Authorization:'Bearer tenant'}})).status()).toBe(403);const own=await(await request.get(`http://127.0.0.1:18081/api/visits/${id}`,{headers:{Authorization:'Bearer tenant'}})).json();expect(own.visit.status).toBe('cancelled');
 await Promise.all([adminContext.unrouteAll({behavior:'wait'}),tenantContext.unrouteAll({behavior:'wait'})]);await Promise.all([adminContext.close(),tenantContext.close()]);
});
