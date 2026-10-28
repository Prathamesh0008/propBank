const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const {isolated,users,request,route}=require('./fixtures/native-server.cjs');

const source=()=>fs.readFileSync('src/features/properties/AddPropertyForm.tsx','utf8');
const base=(category,structure)=>({propertyTitle:`${category} pricing`,propertyType:category,propertyCategory:category,structure,configuration:category==='residential'?'2 BHK':'',location:'Pune',ownerUID:'owner'});

test('owner pricing appears once beside property purpose with amount-in-words helpers',()=>{
 const text=source(),purpose=text.indexOf('name="listingType"'),pricing=text.indexOf('Keep asking prices beside the listing purpose'),units=text.indexOf('{/* Unit Details */}');
 assert.ok(purpose>=0&&pricing>purpose&&units>pricing);
 for(const label of ['Expected Monthly Rent','Expected Security Deposit','Expected Selling Price','Finalized Monthly Rent','Finalized Security Deposit'])assert.match(text,new RegExp(label));
 assert.equal((text.match(/name="sellingPrice"/g)||[]).length,1);
 assert.equal((text.match(/name="securityDeposit"/g)||[]).length,1);
 assert.match(text,/For Sale and Rent/);
 assert.match(text,/\['rent','sell','sell_rent'\]\.includes\(listingType\|\|''\)/);
 assert.match(text,/private-management properties remain private/);
 assert.ok((text.match(/<AmountInWords amount=\{field\.value\}\/\>/g)||[]).length>=3);
});

test('sale, rental and private-management prices retain their distinct stored mappings',async()=>{
 const cases=[
  {...base('residential','Apartment'),listingType:'sell',sellingPrice:'8500000'},
  {...base('commercial','Office'),listingType:'rent',rentalStatus:'available',expectedRent:'55000',securityDeposit:'165000'},
  {...base('commercial','Showroom'),listingType:'sell_rent',rentalStatus:'available',expectedRent:'65000',securityDeposit:'195000',sellingPrice:'12500000'},
  {...base('industrial','Warehouse'),listingType:'manage'},
 ];
  for(const payload of cases){const app=isolated({users}),response=await route(app,'properties').POST(request('/properties','owner','POST',payload));assert.equal(response.status,200,await response.clone().text());const saved=Object.values(app.state.properties)[0];assert.equal(saved.listingType,payload.listingType);if(payload.sellingPrice)assert.equal(saved.sellingPrice,payload.sellingPrice);if(payload.expectedRent){assert.equal(saved.expectedRent,payload.expectedRent);assert.equal(saved.securityDeposit,payload.securityDeposit);}if(payload.listingType==='manage'){assert.equal(saved.sellingPrice,'');assert.equal(saved.expectedRent,undefined);}}
});

test('occupied rental keeps finalized rent separate from asking rent',async()=>{
 const app=isolated({users}),payload={...base('residential','Apartment'),listingType:'rent',rentalStatus:'rented',monthlyRent:'42000',expectedRent:'',securityDeposit:'84000',paymentDueDate:'5',agreementPeriod:'11',agreementStartDate:'2026-01-01',agreementEndDate:'2026-11-30',noticePeriod:'2',lockInPeriod:'6',tenantFirstName:'Test',tenantLastName:'Tenant',tenantEmail:'tenant@test.invalid',mobileNumber:'9876543210'};
 const response=await route(app,'properties').POST(request('/properties','owner','POST',payload));assert.equal(response.status,200,await response.clone().text());const saved=Object.values(app.state.properties)[0];assert.equal(saved.monthlyRent,'42000');assert.equal(saved.expectedRent,'');assert.equal(saved.securityDeposit,'84000');assert.equal(saved.agreementEndDate,'2026-11-30');
});
