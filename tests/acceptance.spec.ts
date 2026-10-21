import { test, expect, type Page } from '@playwright/test';

// Real Next.js screens call the native handlers through an isolated test adapter.
// Firebase session/claims, Firestore, R2 and Resend are fixtures, not live UAT.
import {signIn} from './fixtures/browser-session';

test.beforeEach(async({request,page})=>{page.setDefaultTimeout(15000);await request.get('http://127.0.0.1:18081/reset');});

test('guest browses limited property details and search without private owner data',async({page})=>{
  await page.route('**/api/**',async route=>{const req=route.request();const response=await page.request.fetch(`http://127.0.0.1:18081${new URL(req.url()).pathname}${new URL(req.url()).search}`,{method:req.method(),headers:req.headers(),maxRetries:2});await route.fulfill({response});});
  await page.goto('/property/P');await expect(page.getByRole('heading',{name:'Acceptance Home',exact:true})).toBeVisible();
  await expect(page.getByText('owner@test.invalid',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Your offer in rupees')).toHaveCount(0);
  await page.goto('/search?type=rent');await expect(page).toHaveURL(/\/search\?type=rent/);
  await expect(page.getByText('Acceptance Home',{exact:true}).first()).toBeVisible();
});
test('customer offer → admin proposal → owner counter → customer acceptance → admin completion',async({browser})=>{
  const context=await browser.newContext(),customer=await context.newPage();await signIn(customer,'customer');await customer.goto('/property/P');
  await customer.getByLabel('Your offer in rupees').fill('60000');await customer.getByRole('button',{name:'Submit offer',exact:true}).click();await expect(customer.getByText('Customer offer',{exact:true})).toBeVisible();
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:'Offers',exact:true}).click();
  await admin.getByLabel('Amount for Acceptance Home').fill('65000');await admin.getByRole('button',{name:'Send proposal to owner'}).click();await expect(admin.getByText('proposed',{exact:true})).toBeVisible();await expect(admin.getByRole('button',{name:'Accept amount'})).toHaveCount(0);
  const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/property/P');await owner.getByLabel('Amount for Acceptance Home').fill('67000');await owner.getByRole('button',{name:'Counter offer',exact:true}).click();await expect(owner.getByText('countered',{exact:true})).toBeVisible();
  await customer.reload();await customer.getByRole('button',{name:'Accept owner-approved amount'}).click();await expect(customer.getByText('accepted',{exact:true})).toBeVisible();
  await admin.reload();await admin.getByRole('tab',{name:'Offers',exact:true}).click();await admin.getByRole('button',{name:'Mark transaction complete'}).click();await expect(admin.getByText('completed',{exact:true})).toBeVisible();
  
  await Promise.all([context.unrouteAll({behavior:'wait'}),adminContext.unrouteAll({behavior:'wait'}),ownerContext.unrouteAll({behavior:'wait'})]);await Promise.all([context.close(),adminContext.close(),ownerContext.close()]);
});
test('owner dashboard includes owned and rented properties; admin Agents tab loads without stub error',async({browser})=>{
  const context=await browser.newContext(),page=await context.newPage();await signIn(page,'owner');await page.goto('/manage-property');await expect(page.getByRole('heading',{name:/^Acceptance Home Property ID: P , Existing Address$/})).toBeVisible();
  await page.getByRole('button',{name:'Tenant 1',exact:true}).click();await expect(page.getByRole('heading',{name:/^Owner rented home Property ID: R , Existing Address$/})).toBeVisible();
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:'Agents',exact:true}).click();await expect(admin.getByText('Individuals',{exact:true})).toBeVisible();await expect(admin.getByText('Failed to load data. Please try again.')).toHaveCount(0);
  await Promise.all([context.unrouteAll({behavior:'wait'}),adminContext.unrouteAll({behavior:'wait'})]);await Promise.all([context.close(),adminContext.close()]);
});
test('tenant sees assigned property and can submit an inspection through the existing screen',async({page})=>{
  await signIn(page,'tenant');await page.goto('/property/Q');await expect(page.getByText('Assigned Home',{exact:true}).first()).toBeVisible();
  await page.goto('/inspection-report/Q');await page.getByRole('combobox').first().click();await page.getByRole('option',{name:'1. On Possession'}).click();
  await page.getByPlaceholder('Enter the inspection report details as per the table format...').fill('Acceptance inspection: fixtures checked.');
  await page.getByRole('button',{name:/Submit Report/}).click();await expect(page.getByText(/submitted successfully/i).first()).toBeVisible();
});
test('owner creates and edits a property through existing forms, then archives and restores a rental',async({page})=>{
  await signIn(page,'owner');await page.goto('/add-property?type=residential');
  await page.getByPlaceholder('Enter property name here').fill('Browser Created Home');
  await page.getByRole('combobox',{name:'Configuration / (Structure)',exact:true}).click();await page.getByRole('option',{name:'2 BHK',exact:true}).click();
  await page.getByLabel('Listing Type',{exact:true}).click();await page.getByRole('option',{name:'For Sale',exact:true}).click();
  await page.getByPlaceholder('Where is your property located? (Enter full address)').fill('Isolated acceptance address');
  await page.getByPlaceholder('Enter selling price (e.g., 5000000)').fill('5000000');
  await page.getByLabel('Building name',{exact:true}).fill('Client Building');await page.getByLabel('Property type / Structure',{exact:true}).selectOption('Flat');await page.getByLabel('Carpet area unit',{exact:true}).selectOption('sq ft');
  const created=page.waitForResponse(response=>response.url().endsWith('/api/properties')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'SUBMIT',exact:true}).click();const result=await created;expect(result.status()).toBe(200);const body=await result.json();expect(body.success).toBe(true);expect(body.property.buildingName).toBe('Client Building');expect(body.property.structure).toBe('Flat');expect(body.property.carpetAreaUnit).toBe('sq ft');
  await page.goto(`/edit-property/${body.property.id}`);await page.getByPlaceholder('Enter property name here').fill('Browser Edited Home');await expect(page.getByLabel('Building name',{exact:true})).toHaveValue('Client Building');
  const edited=page.waitForResponse(response=>response.url().endsWith(`/api/properties/${body.property.id}`)&&response.request().method()==='PUT');
  await page.getByRole('button',{name:'Update Property',exact:true}).click();expect((await edited).status()).toBe(200);
  await page.goto('/manage-property');await page.locator('#status-P').click();
  await page.getByRole('button',{name:'Archived',exact:true}).click();await expect(page.getByRole('heading',{name:'Acceptance Home',exact:true})).toBeVisible();
  await page.getByRole('button').filter({has:page.locator('svg.lucide-ellipsis-vertical')}).first().click();await page.getByRole('menuitem',{name:'Unarchive Property'}).click();
  await page.goto('/manage-property');await expect(page.getByRole('heading',{name:/^Acceptance Home Property ID: P , Existing Address$/})).toBeVisible();
});

test('assigned tenant uploads and attaches a document through the existing screen',async({page})=>{
  await signIn(page,'tenant');await page.goto('/attach-documents/Q');
  await page.getByRole('button',{name:'Add Document',exact:true}).click();
  await page.getByPlaceholder('Enter document name').fill('Acceptance Agreement');
  await page.getByRole('combobox').click();await page.getByRole('option',{name:'Agreement',exact:true}).click();
  await page.locator('input[type="file"]').setInputFiles({name:'acceptance.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nIsolated document fixture')});
  await expect(page.getByText('File selected',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Upload Document',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Acceptance Agreement',exact:true})).toBeVisible();
});

test('tenant requests agreement renewal and owner can view assigned tenant details',async({browser})=>{
  const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');
  tenant.on('dialog',dialog=>dialog.accept());await tenant.goto('/renew-agreement/Q');
  const renewal=tenant.waitForResponse(response=>response.url().endsWith('/api/agreements/request-renewal')&&response.request().method()==='POST');
  await tenant.getByRole('button',{name:'Submit renewal request',exact:true}).click();expect((await renewal).status()).toBe(200);
  await expect(tenant.getByText('Request submitted; pending owner approval.')).toBeVisible();
  const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/add-tenant/Q?mode=view');
  await expect(owner.getByText('Tenant Details',{exact:true}).first()).toBeVisible();
  await Promise.all([tenantContext.unrouteAll({behavior:'wait'}),ownerContext.unrouteAll({behavior:'wait'})]);await Promise.all([tenantContext.close(),ownerContext.close()]);
});


test('listing review UI keeps owner submissions private through changes and resubmission until admin approval',async({browser,request})=>{
 const created=await request.post('http://127.0.0.1:18081/api/properties',{headers:{Authorization:'Bearer owner'},data:{propertyTitle:'Phase2 Browser Home',propertyType:'residential',configuration:'2BHK',location:'Isolated review address',ownerUID:'owner',listingType:'sell',sellingPrice:'5000000'}});
 expect(created.status()).toBe(200);const id=(await created.json()).property.id;
 expect((await request.get(`http://127.0.0.1:18081/api/properties/${id}`)).status()).toBe(404);
 const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/manage-property');await expect(owner.getByText('Listing: pending review',{exact:true})).toBeVisible();
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:/All Properties/}).click();
 await admin.getByRole('heading',{name:'Phase2 Browser Home',exact:true}).locator('..').locator('..').getByRole('button',{name:'View Full Details',exact:true}).click();
 await expect(admin.getByRole('button',{name:'Request changes',exact:true})).toBeDisabled();await admin.getByLabel('Listing review reason').fill('Correct the property description');await admin.getByRole('button',{name:'Request changes',exact:true}).click();await expect(admin.getByText('Listing: changes requested',{exact:true})).toBeVisible();
 await owner.reload();await expect(owner.getByText('Review reason: Correct the property description',{exact:true})).toBeVisible();
 await owner.goto(`/edit-property/${id}`);await owner.getByPlaceholder('Enter property name here').fill('Phase2 Revised Home');const updated=owner.waitForResponse(r=>r.url().endsWith(`/api/properties/${id}`)&&r.request().method()==='PUT');await owner.getByRole('button',{name:'Update Property',exact:true}).click();expect((await updated).status()).toBe(200);await owner.goto('/manage-property');await expect(owner.getByText('Listing: pending review',{exact:true})).toBeVisible();
 expect((await request.get(`http://127.0.0.1:18081/api/properties/${id}`)).status()).toBe(404);
 await admin.reload();await admin.getByRole('tab',{name:/All Properties/}).click();await admin.getByRole('heading',{name:'Phase2 Revised Home',exact:true}).locator('..').locator('..').getByRole('button',{name:'View Full Details',exact:true}).click();await admin.getByRole('button',{name:'Approve listing',exact:true}).click();await expect(admin.getByText('Listing: approved',{exact:true})).toBeVisible();
 expect((await request.get(`http://127.0.0.1:18081/api/properties/${id}`)).status()).toBe(200);
 await Promise.all([ownerContext.unrouteAll({behavior:'wait'}),adminContext.unrouteAll({behavior:'wait'})]);await Promise.all([ownerContext.close(),adminContext.close()]);
});


test('admin assigns a property enquiry, broker updates progress, reassignment revokes access, and unassignment persists',async({browser,request})=>{
 const submitted=await request.post('http://127.0.0.1:18081/api/admin/notifications',{headers:{Authorization:'Bearer customer'},data:{type:'property_enquiry',propertyId:'P',title:'Broker assignment browser test',message:'Please call about this home'}});expect(submitted.status()).toBe(201);const id=(await submitted.json()).notification.id;
 // Even an archived historical enquiry remains manageable in the inbox.
 expect((await request.put(`http://127.0.0.1:18081/api/admin/notifications/${id}/read`,{headers:{Authorization:'Bearer admin'},data:{}})).status()).toBe(200);
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:'Enquiries',exact:true}).click();
 const inbox=admin.getByRole('region',{name:'Property enquiry inbox',exact:true});await expect(inbox.getByText(/^Customer: Customer \/ customer@test\.invalid \//)).toBeVisible();
 await inbox.getByLabel('Assigned broker',{exact:true}).selectOption('broker');await inbox.getByLabel('Private enquiry notes').fill('PRIVATE BROWSER ASSIGNMENT');await inbox.getByRole('button',{name:'Save assignment',exact:true}).click();await expect(inbox.getByText('Assigned broker: Test Broker',{exact:true})).toBeVisible();
 const brokerContext=await browser.newContext(),broker=await brokerContext.newPage();await signIn(broker,'broker');await broker.goto('/manage-property');const assigned=broker.getByRole('region',{name:'Assigned property enquiries',exact:true});await expect(assigned.getByText('Assigned broker: Test Broker',{exact:true})).toBeVisible();await expect(assigned.getByRole('button',{name:'Save assignment',exact:true})).toHaveCount(0);
 await assigned.getByLabel('Enquiry status',{exact:true}).selectOption('contacted');await assigned.getByLabel('Private enquiry notes').fill('PRIVATE BROWSER CONTACT NOTE');await assigned.getByRole('button',{name:'Save progress',exact:true}).click();await assigned.getByText('Assignment and status history',{exact:true}).click();await expect(assigned.locator('li').filter({hasText:'PRIVATE BROWSER CONTACT NOTE'})).toBeVisible();
 await inbox.getByRole('button',{name:'Refresh enquiries',exact:true}).click();await expect(inbox.getByLabel('Enquiry status',{exact:true})).toHaveValue('contacted');await inbox.getByLabel('Assigned broker',{exact:true}).selectOption('broker2');await inbox.getByRole('button',{name:'Save assignment',exact:true}).click();await expect(inbox.getByText('Assigned broker: Second Broker',{exact:true})).toBeVisible();
 await assigned.getByRole('button',{name:'Refresh enquiries',exact:true}).click();await expect(assigned.getByText('No enquiries in your permitted scope.',{exact:true})).toBeVisible();
 const secondContext=await browser.newContext(),second=await secondContext.newPage();await signIn(second,'broker2');await second.goto('/manage-property');await expect(second.getByText('Assigned broker: Second Broker',{exact:true})).toBeVisible();
 await inbox.getByLabel('Assigned broker',{exact:true}).selectOption('');await inbox.getByRole('button',{name:'Save assignment',exact:true}).click();await expect(inbox.getByText('Assigned broker: Unassigned',{exact:true})).toBeVisible();await admin.reload();await admin.getByRole('tab',{name:'Enquiries',exact:true}).click();await expect(admin.getByText('Assigned broker: Unassigned',{exact:true})).toBeVisible();
 const ownerNotifications=await request.get('http://127.0.0.1:18081/api/admin/notifications?propertyId=P',{headers:{Authorization:'Bearer owner'}});expect(ownerNotifications.status()).toBe(200);expect(await ownerNotifications.text()).not.toContain('PRIVATE BROWSER');
 await Promise.all([adminContext.unrouteAll({behavior:'wait'}),brokerContext.unrouteAll({behavior:'wait'}),secondContext.unrouteAll({behavior:'wait'})]);await Promise.all([adminContext.close(),brokerContext.close(),secondContext.close()]);
});
