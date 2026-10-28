const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');

const source=file=>fs.readFileSync(file,'utf8');

test('account and relationship UI describes verified email discovery and contact-only mobile numbers',()=>{
 const tenant=source('src/features/services/AddTenant.tsx');
 const account=source('src/features/account/MyAccount.tsx');
 const verification=source('src/features/admin/OwnerVerification.tsx');
 const combined=tenant+account+verification;
 assert.doesNotMatch(combined,/Firebase phone ownership verification|Mobile verification and tenant confirmation|Verified-phone account UID/);
 assert.match(tenant,/verified email/);
 assert.match(account,/contact information only/);
 assert.match(verification,/Verified-email candidate account UID/);
});

test('owner renewal review is read-only and approval does not submit editable terms',()=>{
 const workflow=source('src/features/services/AgreementWorkflow.tsx');
 assert.match(workflow,/readOnly=\{reviewingPendingRenewal\}/);
 assert.match(workflow,/disabled=\{reviewingPendingRenewal\}/);
 assert.match(workflow,/renew&&action==='request'/);
 assert.doesNotMatch(workflow,/renew\?\{terms:/);
});

test('review form has no user-selectable relationship role',()=>{
 const review=source('src/features/services/Review.tsx');
 assert.doesNotMatch(review,/id="reviewer-type"|setReviewerType\(event\.target\.value\)/);
 assert.match(review,/data\.property\.userRole === "tenant"/);
 assert.doesNotMatch(review,/reviewerType: reviewerType/);
});
