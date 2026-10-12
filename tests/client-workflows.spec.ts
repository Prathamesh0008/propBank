import {test,expect} from '@playwright/test';
import {signIn} from './fixtures/browser-session';
test.beforeEach(async({request,page})=>{page.setDefaultTimeout(20000);await request.get('http://127.0.0.1:18081/reset');});

test('Property 360 combines real history, owner rent tracking and member-visible paid state',async({browser})=>{
 const context=await browser.newContext(),owner=await context.newPage();await signIn(owner,'owner');await owner.goto('/manage-property/Q');await expect(owner.getByRole('heading',{name:'Property 360: Assigned Home',exact:true})).toBeVisible();await expect(owner.getByRole('heading',{name:'Move-in progress',exact:true})).toBeVisible();await owner.getByLabel('Rent notes',{exact:true}).fill('Payment recorded by owner');await owner.getByLabel('Recorded payment status',{exact:true}).selectOption('paid');await owner.getByRole('button',{name:'Save rent tracking',exact:true}).click();await expect(owner.getByText('Tracking saved.',{exact:true})).toBeVisible();await expect(owner.getByText(/\d{4}-\d{2} · Paid/)).toBeVisible();
 const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto('/manage-property/Q');await expect(tenant.getByText(/\d{4}-\d{2} · Paid/)).toBeVisible();await expect(tenant.getByRole('button',{name:'Save rent tracking',exact:true})).toHaveCount(0);await expect(tenant.getByText('Payment recorded by owner',{exact:true})).toBeVisible();await Promise.all([context.unrouteAll({behavior:'wait'}),tenantContext.unrouteAll({behavior:'wait'})]);await Promise.all([context.close(),tenantContext.close()]);
});

test('internal property notes stay admin-only while portfolio metrics use current records',async({browser})=>{
 const context=await browser.newContext(),admin=await context.newPage();await signIn(admin,'admin');await admin.goto('/admin');await expect(admin.getByRole('heading',{name:'Portfolio operations',exact:true})).toBeVisible();await admin.goto('/manage-property/Q');await admin.getByLabel('Internal note',{exact:true}).fill('Private operational instruction');await admin.getByRole('button',{name:'Save internal note',exact:true}).click();await expect(admin.getByText(/Private operational instruction/)).toBeVisible();
 const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/manage-property/Q');await expect(owner.getByText(/Private operational instruction/)).toHaveCount(0);await expect(owner.getByRole('heading',{name:'Internal admin notes',exact:true})).toHaveCount(0);await Promise.all([context.unrouteAll({behavior:'wait'}),ownerContext.unrouteAll({behavior:'wait'})]);await Promise.all([context.close(),ownerContext.close()]);
});

test('Add Property offers owner and tenant paths without making global roles exclusive',async({page})=>{
 await signIn(page,'owner');await page.goto('/manage-property');await page.getByRole('button',{name:'Add Property',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'As an Owner',exact:true})).toBeVisible();await expect(page.getByRole('menuitem',{name:'As a Tenant',exact:true})).toBeVisible();
 await page.getByRole('menuitem',{name:'As an Owner',exact:true}).click();await page.getByRole('heading',{name:'Residential',exact:true}).click();await expect(page).toHaveURL(/as=owner/);await expect(page.getByPlaceholder('Enter property name here')).toBeVisible();
 await page.goto('/manage-property');await page.getByRole('button',{name:'Add Property',exact:true}).click();await page.getByRole('menuitem',{name:'As a Tenant',exact:true}).click();await page.getByRole('heading',{name:'Residential',exact:true}).click();await expect(page).toHaveURL(/as=tenant/);await expect(page.getByRole('heading',{name:'Add Property As a Tenant',exact:false})).toBeVisible();
});

test('same owner account records a tenant property, sees it under Tenant and admin sees supplied owner details',async({browser})=>{
 const ownerContext=await browser.newContext(),page=await ownerContext.newPage();await signIn(page,'owner');await page.goto('/select-property-type');await page.getByRole('button',{name:'As a Tenant',exact:true}).click();await page.getByRole('heading',{name:'Residential',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Add Property as a Tenant',exact:true})).toBeVisible();
 for(const [label,value] of [['Property title','Tenant Recorded Home'],['Location / address','Recorded rental address'],['Configuration / Structure','2 BHK'],['Monthly finalized rent','28000'],['Payment due day (1–31)','5'],['Agreement period (months)','12'],['Agreement start date','2026-01-01'],['Agreement end date','2027-01-01'],['Owner person name','Reported Owner'],['Owner contact number','9999999999'],['Owner working profile','Engineer']])await page.getByLabel(label,{exact:false}).fill(value);
 await page.getByLabel('Property type',{exact:true}).selectOption('Flat');await page.getByRole('button',{name:'Submit Tenant Property',exact:true}).click();await expect(page).toHaveURL(/manage-property\?tab=tenant/);await expect(page.getByRole('heading',{name:/^Tenant Recorded Home/})).toBeVisible();
 await page.getByRole('button',{name:/^Owned /}).click();await expect(page.getByRole('heading',{name:/^Acceptance Home/})).toBeVisible();await expect(page.getByRole('heading',{name:/^Tenant Recorded Home/})).toHaveCount(0);
 const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByRole('tab',{name:'All Properties',exact:true}).click();const card=admin.locator('div.rounded-lg').filter({has:admin.getByRole('heading',{name:'Tenant Recorded Home',exact:true})}).last();await card.getByRole('button',{name:'View Full Details',exact:true}).click();await expect(admin.getByText('Tenant-submitted property · Owner verification pending',{exact:true})).toBeVisible();await expect(admin.getByText('Reported Owner',{exact:true})).toBeVisible();await expect(admin.getByText('Engineer',{exact:true})).toBeVisible();
 await page.unrouteAll({behavior:'wait'});await admin.unrouteAll({behavior:'wait'});await Promise.all([ownerContext.unrouteAll({behavior:'wait'}),adminContext.unrouteAll({behavior:'wait'})]);await Promise.all([ownerContext.close(),adminContext.close()]);
});

test('owner assigns a platform tenant and the same tenant account sees the property',async({browser})=>{
 const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/add-tenant/P');await owner.getByPlaceholder('Enter first name',{exact:true}).fill('Tenant');await owner.getByPlaceholder('Enter last name',{exact:true}).fill('User');await owner.getByPlaceholder('tenant@example.com').fill('tenant@test.invalid');await owner.getByPlaceholder('+9193 XXXXXX',{exact:true}).first().fill('456');await owner.getByRole('button',{name:'Add Tenant',exact:true}).click();await expect(owner.getByText('1 tenant(s) added successfully',{exact:true})).toBeVisible();
 const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto('/manage-property');await tenant.getByRole('button',{name:'Tenant 2',exact:true}).click();await expect(tenant.getByRole('heading',{name:/^Acceptance Home Property ID: P/})).toBeVisible();await Promise.all([ownerContext.unrouteAll({behavior:'wait'}),tenantContext.unrouteAll({behavior:'wait'})]);await Promise.all([ownerContext.close(),tenantContext.close()]);
});
test('tenant review identity and review history are connected',async({page})=>{
 await signIn(page,'tenant');await page.goto('/review/Q');await page.getByPlaceholder("How understanding was the owner during your stay?").fill('Understood the concern');await page.getByRole('button',{name:'Submit Review',exact:true}).click();await expect(page).toHaveURL(/manage-property/);await page.goto('/review/Q');await expect(page.getByText('Understood the concern',{exact:true})).toBeVisible();
});
test('legal and related requests reuse canonical request history',async({page})=>{
 await signIn(page,'owner');for(const [path,service,message] of [['legal-services','rent-agreement-registration','Register existing rental agreement'],['other-services','pre-rental','Painting and carpenter work before move-in']]){await page.goto(`/${path}/Q`);await page.getByLabel('Service category').selectOption(service);await page.getByLabel('Comment / details').fill(message);await page.getByRole('button',{name:'Submit request',exact:true}).click();await expect(page.getByText(message,{exact:true})).toBeVisible();}
});
test('payment receipt metadata and authorized document deletion work',async({page})=>{
 await signIn(page,'owner');await page.goto('/attach-documents/Q?type=payment_receipt');await page.getByRole('button',{name:'Add Document',exact:true}).click();await page.getByPlaceholder('Enter document name').fill('Supplied rent receipt');await page.getByLabel('Reported amount').fill('30000');await page.getByLabel('Receipt date').fill('2026-10-01');await page.locator('input[type="file"]').setInputFiles({name:'rent.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSupplied rent receipt')});await expect(page.getByText('File uploaded',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Upload Document',exact:true}).click();await expect(page.getByRole('heading',{name:'Supplied rent receipt',exact:true})).toBeVisible();page.on('dialog',dialog=>dialog.accept());await page.getByLabel('Delete Supplied rent receipt').click();await expect(page.getByRole('heading',{name:'Supplied rent receipt',exact:true})).toHaveCount(0);
});
test('admin can assign agent access without changing property relationship roles',async({page})=>{
 await signIn(page,'admin');await page.goto('/admin');await page.getByRole('tab',{name:'Agents',exact:true}).click();page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Assign agent role: Customer',exact:true}).click();await expect(page.getByRole('button',{name:'Remove agent role: Customer',exact:true})).toBeVisible();
});
test('logging out clears private property projections from the client cache',async({page})=>{
 await signIn(page,'owner');await page.goto('/property/P');await expect(page.getByText('owner@test.invalid',{exact:true}).last()).toBeVisible();await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('menuitem',{name:'Log out',exact:true}).click();await expect(page.getByText('owner@test.invalid',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Your offer in rupees')).toHaveCount(0);
});

test('renewal proposal preserves current rent until owner approves changed terms and history',async({browser})=>{
  const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto('/renew-agreement/Q');
  await expect(tenant.getByLabel('Monthly finalized rent')).toHaveValue('30000');await tenant.getByLabel('Monthly finalized rent').fill('35000');await tenant.getByLabel('Agreement start date').fill('2027-01-02');await tenant.getByLabel('Agreement end date').fill('2028-01-02');
  await tenant.getByRole('button',{name:'Submit renewal request'}).click();await expect(tenant.getByText('Request submitted; pending owner approval.')).toBeVisible();await expect(tenant.getByRole('button',{name:'Approve renewal'})).toHaveCount(0);
  const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/renew-agreement/Q');await expect(owner.getByText('Current rent: ₹30000',{exact:false})).toBeVisible();await owner.getByRole('button',{name:'Approve renewal'}).click();await expect(owner.getByText('Renewal approved. Agreed terms updated.')).toBeVisible();await expect(owner.getByText('Current rent: ₹35000',{exact:false})).toBeVisible();await expect(owner.getByText('renewed ·',{exact:false}).last()).toBeVisible();
  await Promise.all([tenantContext.unrouteAll({behavior:'wait'}),ownerContext.unrouteAll({behavior:'wait'})]);await Promise.all([tenantContext.close(),ownerContext.close()]);
});
test('termination request can be rejected and owner notice retains history before final termination',async({browser})=>{
  const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto('/terminate-agreement/Q');await tenant.getByLabel('Termination date',{exact:true}).fill('2027-01-01');await tenant.getByRole('button',{name:'Request termination'}).click();await expect(tenant.getByText('Request submitted; pending owner approval.')).toBeVisible();await expect(tenant.getByRole('button',{name:'Finalize termination'})).toHaveCount(0);
  const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/terminate-agreement/Q');await owner.getByRole('button',{name:'Reject request'}).click();await expect(owner.getByText('Request rejected.',{exact:true})).toBeVisible();await owner.getByLabel('Termination date',{exact:true}).fill('2027-01-01');await owner.getByRole('button',{name:'Serve notice'}).click();await expect(owner.getByText('Notice recorded. Final termination requires an owner decision.')).toBeVisible();owner.on('dialog',dialog=>dialog.accept());await owner.getByRole('button',{name:'Finalize termination'}).click();await expect(owner.getByText('Agreement terminated; history retained.')).toBeVisible();await expect(owner.getByText('terminated ·',{exact:false}).last()).toBeVisible();
  await Promise.all([tenantContext.unrouteAll({behavior:'wait'}),ownerContext.unrouteAll({behavior:'wait'})]);await Promise.all([tenantContext.close(),ownerContext.close()]);
});
test('maintenance request reaches admin resolution and archive, and tenant can read the response',async({browser})=>{
  const tenantContext=await browser.newContext(),tenant=await tenantContext.newPage();await signIn(tenant,'tenant');await tenant.goto('/request-services/Q');await tenant.getByLabel('Service category').selectOption('plumbing');await tenant.getByLabel('Comment / details').fill('Pipe leaks under kitchen sink');await tenant.getByRole('button',{name:'Submit request',exact:true}).click();await expect(tenant.getByText('Pipe leaks under kitchen sink',{exact:true})).toBeVisible();
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/admin');await admin.getByLabel('Solution report').fill('Replaced damaged pipe');await admin.getByLabel('Admin comment',{exact:true}).fill('Resolved on site');await admin.getByLabel('Status',{exact:true}).selectOption('resolved');await admin.getByLabel('Request archive',{exact:true}).selectOption('yes');await admin.getByRole('button',{name:'Save resolution and status'}).click();await expect(admin.getByText('Status: resolved · Archived',{exact:true})).toBeVisible();await tenant.reload();await expect(tenant.getByText('Admin response: Replaced damaged pipe Resolved on site')).toBeVisible();
  await Promise.all([tenantContext.unrouteAll({behavior:'wait'}),adminContext.unrouteAll({behavior:'wait'})]);await Promise.all([tenantContext.close(),adminContext.close()]);
});
test('TDS supplied metadata is saved and admin verifies report without tax computation',async({browser})=>{
  const ownerContext=await browser.newContext(),owner=await ownerContext.newPage();await signIn(owner,'owner');await owner.goto('/attach-documents/Q?type=tds_report');await owner.getByRole('button',{name:'Add Document',exact:true}).click();await owner.getByPlaceholder('Enter document name').fill('TDS supplied receipt');await owner.getByLabel('Financial year').fill('2026-27');await owner.getByLabel('Period',{exact:true}).fill('Q2');await owner.getByLabel('Reported amount').fill('2500');await owner.locator('input[type="file"]').setInputFiles({name:'tds.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSupplied TDS receipt')});await expect(owner.getByText('File uploaded',{exact:true})).toBeVisible();await owner.getByRole('button',{name:'Upload Document',exact:true}).click();await expect(owner.getByRole('heading',{name:'TDS supplied receipt',exact:true})).toBeVisible();await expect(owner.getByText(/Reported amount: ₹2500/)).toBeVisible();
  const adminContext=await browser.newContext(),admin=await adminContext.newPage();await signIn(admin,'admin');await admin.goto('/attach-documents/Q?type=tds_report');admin.on('dialog',dialog=>dialog.accept('Supplied document checked'));await admin.getByRole('button',{name:'verified',exact:true}).click();await expect(admin.getByText(/Status: verified/)).toBeVisible();await owner.reload();await expect(owner.getByText('Admin response: Supplied document checked')).toBeVisible();
  await Promise.all([ownerContext.unrouteAll({behavior:'wait'}),adminContext.unrouteAll({behavior:'wait'})]);await Promise.all([ownerContext.close(),adminContext.close()]);
});
for(const width of [1440,768,390])test(`client flows fit ${width}px without horizontal page overflow`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await signIn(page,'owner');
  for(const path of ['/manage-property','/manage-property/Q','/add-property?as=tenant&type=residential','/add-property?type=residential','/edit-property/P','/renew-agreement/Q','/terminate-agreement/Q','/request-services/Q','/legal-services/Q','/other-services/Q','/review/Q','/inspection-report/Q','/attach-documents/Q']){
    await page.goto(path);await expect(page.locator('main,form,h1').first()).toBeVisible();await page.waitForTimeout(250);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);expect(overflow,`${path} overflows at ${width}px`).toBe(false);
  }
  await page.getByRole('button',{name:'Add Document',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();const dialog=await page.getByRole('dialog').boundingBox();expect(dialog!.width).toBeLessThanOrEqual(width);await page.screenshot({path:testInfo.outputPath(`documents-${width}.png`),fullPage:true});
});

test('owner can edit a rented property and changed terms remain consistent with its active tenant',async({page})=>{
  await signIn(page,'owner');await page.goto('/edit-property/Q');
  await page.getByLabel('Property category',{exact:true}).selectOption('residential');
  await page.getByRole('combobox',{name:'Configuration / (Structure)'}).click();await page.getByRole('option',{name:'2 BHK',exact:true}).click();
  await page.getByLabel(/Monthly Rent/).fill('34000');
  const response=page.waitForResponse(r=>r.url().includes('/api/properties/Q')&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'Update Property',exact:true}).click();expect((await response).status()).toBe(200);
  await page.reload();await expect(page.getByLabel(/Monthly Rent/)).toHaveValue('34000');
  await page.goto('/renew-agreement/Q');await expect(page.getByLabel('Monthly finalized rent')).toHaveValue('34000');
});

for(const width of [1440,768,390])test(`long property names and admin tabs fit ${width}px`,async({page,request},testInfo)=>{
  await request.get('http://127.0.0.1:18081/long-property');await page.setViewportSize({width,height:900});await signIn(page,'admin');await page.goto('/admin');
  for(const name of ['Properties','Agents','Offers']){
    await page.getByRole('tab',{name:name==='Properties'?/^(All )?Properties$/:name,exact:true}).click();await page.waitForTimeout(300);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),`${name} overflows at ${width}px`).toBe(false);
  }
  await page.screenshot({path:testInfo.outputPath(`admin-${width}.png`),fullPage:true});
});
