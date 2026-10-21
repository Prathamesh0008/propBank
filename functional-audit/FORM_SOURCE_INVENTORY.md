# Source control and form inventory

Generated from TypeScript AST by `node scripts/audit-project.cjs`. This is source evidence, not a test PASS. Dynamic mapped fields and validation need the workflow table in FUNCTIONAL_AUDIT_2026.md.

## src/features/admin/AdminServiceRequestsTab.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| textarea | 1098 | {`remarks-${notification.id}`} |  |  |
| input | 1120 | (state or mapped field) | "file" | accept="image/*" |
| Checkbox | 1211 | {`complete-${notification.id}`} |  |  |

Handlers: div:24 onClick={() => window.open(url, '_blank')}; div:35 onClick={() => window.open(url, '_blank')}; img:865 onClick={() => window.open(notification.serviceImage, '_blank')}; img:1140 onClick={() => {                                             const url = remarkImages[`url-${notification.id}`] // notification.adminImage;                                             window.open(url, '_blank');                                           }}; a:1159 onClick={() => console.log("Direct link clicked for:", remarkImages[`url-${notification.id}`] // notification.adminImage)}; Button:1178 onClick={() => {                                         const el = document.getElementById(`remarks-${notification.id}`) as HTMLTextAreaElement;                                         handleSaveRemarks(notification.id, el.value, remarkImages[`url-${notification.id}`] // notification.adminImage);                                       }}; Button:1231 onClick={() => handleViewPropertyDetails(notification.propertyId)}

## src/features/admin/AdminSiteSettingsTab.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| input | 59 | (state or mapped field) | "text" |  |
| input | 79 | (state or mapped field) | "text" |  |
| input | 96 | (state or mapped field) | "text" |  |
| input | 113 | (state or mapped field) | "text" |  |
| Checkbox | 124 | "announcement-active" |  |  |
| input | 153 | (state or mapped field) | "file" | accept="image/*" |

Handlers: button:188 onClick={() => handleRemoveBannerImage(index, false)}; button:216 onClick={() => handleRemoveBannerImage(index, true)}; Button:244 onClick={handleUpdateSiteSettings}

## src/features/admin/OwnerVerification.tsx

Forms: line 10: {async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('');try{const response=await workflowRequest<{message:string}>('owner-verification',{propertyId,ownerUID:data.get('ownerUID'),evidenceDocumentId:data.get('evidenceDocumentId'),reviewNote:data.get('reviewNote')});setDone(true);setMessage(response.message);await cache.invalidateQueries();}catch(error){setMessage(error instanceof Error?error.message:'Verification failed');}finally{setBusy(false);}}}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 10 | "ownerUID" |  | required=true, maxLength={128} |
| Input | 10 | "evidenceDocumentId" |  | required=true |
| Input | 10 | "reviewNote" |  | required=true, maxLength={2000} |
| input | 10 | (state or mapped field) | "checkbox" | required=true |

Handlers: form:10 onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('');try{const response=await workflowRequest<{message:string}>('owner-verification',{propertyId,ownerUID:data.get('ownerUID'),evidenceDocumentId:data.get('evidenceDocumentId'),reviewNote:data.get('reviewNote')});setDone(true);setMessage(response.message);await cache.invalidateQueries();}catch(error){setMessage(error instanceof Error?error.message:'Verification failed');}finally{setBusy(false);}}}

## src/features/auth/GoogleAuth.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Select | 386 | (state or mapped field) |  |  |
| Input | 411 | "fullName" | "text" |  |
| Input | 431 | "phone" | "tel" | maxLength={10} |

Handlers: Button:336 onClick={() => void verifyAccount(user)}; Button:337 onClick={handleSignOut}; div:350 onClick={(e) => e.stopPropagation()}; Button:470 onClick={handlePhoneSubmit}; Button:505 onClick={handleSignIn}; Button:557 onClick={() => navigate("/")}

## src/features/footer/SiteFooter.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| input | 289 | "Newsletter email (subscriptions unavailable)" | "email" |  |

Handlers: button:491 onClick={scrollToTop}

## src/features/landing-page/GeneralInquiryForm.tsx

Forms: line 150: {handleSubmit}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 222 | "name" | "text" |  |
| Input | 235 | "email" | "email" |  |
| Input | 248 | "mobile" | "tel" |  |
| Checkbox | 260 | "requestVisit" |  |  |
| DatePicker | 275 | (state or mapped field) |  | min={new Date().toISOString().split('T')[0]} |
| Select | 284 | (state or mapped field) |  |  |

Handlers: form:150 onSubmit={handleSubmit}; Button:155 onClick={() => handleInputChange("listingType", "buy")}; Button:164 onClick={() => handleInputChange("listingType", "rent")}; Button:173 onClick={() => handleInputChange("listingType", "sell")}; Button:189 onClick={() => handleInputChange("propertyType", "residential")}; Button:198 onClick={() => handleInputChange("propertyType", "commercial")}; Button:207 onClick={() => handleInputChange("propertyType", "industrial")}

## src/features/landing-page/SearchFilterSection.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Select | 100 | (state or mapped field) |  |  |
| Input | 111 | (state or mapped field) |  |  |
| Select | 246 | (state or mapped field) |  |  |
| Select | 282 | (state or mapped field) |  |  |

Handlers: Button:91 onClick={clearFilters}; Button:118 onClick={handleSearch}; Button:135 onClick={() => {                     setSelectedCategories([]);                   }}; Button:149 onClick={() => handleCategoryToggle("residential")}; Button:161 onClick={() => handleCategoryToggle("commercial")}; Button:173 onClick={() => handleCategoryToggle("industrial")}; Button:193 onClick={() => setSelectedProjectCondition("")}; Button:204 onClick={() => setSelectedProjectCondition("New Project")}; Button:215 onClick={() => setSelectedProjectCondition("Ready Project")}; Button:226 onClick={() => setSelectedProjectCondition("Preleased")}; Button:319 onClick={clearFilters}

## src/features/negotiations/NegotiationPanel.tsx

Forms: line 42: {event=>{event.preventDefault();void mutate();}}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 43 | "Your offer in rupees" | "number" | required=true, min="0.01" |
| Input | 66 | {`Amount for ${n.propertyTitle}`} | "number" | min="0.01" |
| Input | 75 | "Agent UID" |  |  |

Handlers: form:42 onSubmit={event=>{event.preventDefault();void mutate();}}; Button:67 onClick={()=>void mutate(n,'propose')}; Button:68 onClick={()=>void mutate(n,'accept')}; Button:69 onClick={()=>void mutate(n,'counter')}; Button:70 onClick={()=>void mutate(n,'reject')}; Button:71 onClick={()=>void mutate(n,'customer_accept')}; Button:72 onClick={()=>void mutate(n,'withdraw')}; Button:73 onClick={()=>void mutate(n,'complete')}; Button:75 onClick={()=>void mutate(n,'assign_broker')}

## src/features/properties/AddPropertyForm.tsx

Forms: line 824: {form.handleSubmit(onSubmit, (errors) => {
                console.error("Form validation errors:", errors);
                toast({
                  title: "Form Validation Failed",
                  description: "Please check the form for errors. See console for details.",
                  variant: "destructive",
                });
              })}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| FormField | 840 | "propertyTitle" |  |  |
| Input | 847 | (state or mapped field) |  |  |
| FormField | 854 | "configuration" |  |  |
| Select | 860 | (state or mapped field) |  |  |
| FormField | 879 | "listingType" |  |  |
| Select | 885 | (state or mapped field) |  |  |
| FormField | 904 | "rentalStatus" |  |  |
| Select | 910 | (state or mapped field) |  |  |
| FormField | 929 | "saleStatus" |  |  |
| Select | 935 | (state or mapped field) |  |  |
| FormField | 959 | "unitNumber" |  |  |
| Input | 966 | (state or mapped field) |  |  |
| FormField | 973 | "floor" |  |  |
| Input | 980 | (state or mapped field) |  |  |
| FormField | 987 | "location" |  |  |
| Input | 994 | (state or mapped field) |  |  |
| FormField | 1007 | "carpetArea" |  |  |
| Input | 1014 | (state or mapped field) | "number" |  |
| FormField | 1020 | "constructedArea" |  |  |
| Input | 1027 | (state or mapped field) | "number" |  |
| FormField | 1035 | "plotArea" |  |  |
| Input | 1042 | (state or mapped field) |  |  |
| FormField | 1062 | "buyerFirstName" |  |  |
| Input | 1069 | (state or mapped field) |  |  |
| FormField | 1078 | "buyerLastName" |  |  |
| Input | 1085 | (state or mapped field) |  |  |
| FormField | 1094 | "buyerPhone" |  |  |
| Input | 1101 | (state or mapped field) |  |  |
| FormField | 1122 | "tenantFirstName" |  |  |
| Input | 1129 | (state or mapped field) |  |  |
| FormField | 1138 | "tenantLastName" |  |  |
| Input | 1145 | (state or mapped field) |  |  |
| FormField | 1153 | "tenantEmail" |  |  |
| Input | 1160 | (state or mapped field) |  |  |
| FormField | 1169 | "mobileNumber" |  |  |
| Input | 1177 | (state or mapped field) |  |  |
| FormField | 1221 | "tenantEmergencyContact" |  |  |
| Input | 1226 | (state or mapped field) |  |  |
| FormField | 1243 | "tenantEmploymentStatus" |  |  |
| Select | 1249 | (state or mapped field) |  |  |
| FormField | 1268 | "tenantEmployer" |  |  |
| Input | 1273 | (state or mapped field) |  |  |
| FormField | 1283 | "tenantIsMarried" |  |  |
| Checkbox | 1289 | (state or mapped field) |  |  |
| FormField | 1311 | "tenantSpouse.firstName" |  |  |
| Input | 1316 | (state or mapped field) |  |  |
| FormField | 1323 | "tenantSpouse.lastName" |  |  |
| Input | 1328 | (state or mapped field) |  |  |
| FormField | 1335 | "tenantSpouse.email" |  |  |
| Input | 1340 | (state or mapped field) | "email" |  |
| FormField | 1347 | "tenantSpouse.phone" |  |  |
| Input | 1352 | (state or mapped field) |  |  |
| FormField | 1359 | "tenantSpouse.employmentStatus" |  |  |
| Select | 1365 | (state or mapped field) |  |  |
| FormField | 1385 | "tenantSpouse.employer" |  |  |
| Input | 1390 | (state or mapped field) |  |  |
| FormField | 1398 | "tenantSpouse.notes" |  |  |
| Textarea | 1403 | (state or mapped field) |  |  |
| FormField | 1420 | "paymentDueDate" |  |  |
| Input | 1427 | (state or mapped field) | "number" | min="1", max="31" |
| FormField | 1440 | "agreementPeriod" |  |  |
| Input | 1447 | (state or mapped field) | "number" | min="1" |
| FormField | 1454 | "agreementStartDate" |  |  |
| DatePicker | 1461 | (state or mapped field) |  |  |
| FormField | 1468 | "agreementEndDate" |  |  |
| DatePicker | 1475 | (state or mapped field) |  |  |
| FormField | 1501 | "monthlyRent" |  |  |
| Input | 1508 | (state or mapped field) | "number" |  |
| Input | 1540 | (state or mapped field) |  |  |
| Input | 1547 | (state or mapped field) | "number" |  |
| Input | 1570 | (state or mapped field) |  |  |
| FormField | 1577 | {`rentSchedule.${index}.fromDate`} |  |  |
| DatePicker | 1584 | (state or mapped field) |  |  |
| FormField | 1609 | {`rentSchedule.${index}.toDate`} |  |  |
| DatePicker | 1616 | (state or mapped field) |  |  |
| FormField | 1658 | "sellingPrice" |  |  |
| Input | 1665 | (state or mapped field) | "number" |  |
| FormField | 1696 | "securityDeposit" |  |  |
| Input | 1703 | (state or mapped field) |  |  |
| FormField | 1720 | "noticePeriod" |  |  |
| Select | 1726 | (state or mapped field) |  |  |
| FormField | 1748 | "lockInPeriod" |  |  |
| Input | 1755 | (state or mapped field) |  |  |
| FormField | 1771 | "unitCondition" |  |  |
| Select | 1777 | (state or mapped field) |  |  |
| FormField | 1795 | "furnishedChecklist" |  |  |
| FormField | 1823 | "maintenanceToBePaidBy" |  |  |
| Select | 1829 | (state or mapped field) |  |  |
| FormField | 1848 | "projectCondition" |  |  |
| Select | 1854 | (state or mapped field) |  |  |
| FormField | 1873 | "possessionDate" |  |  |
| DatePicker | 1880 | (state or mapped field) |  |  |
| FormField | 1893 | "images" |  |  |
| input | 1916 | (state or mapped field) | "file" | accept="image/*" |
| FormField | 1966 | "internalImages" |  |  |
| input | 1989 | (state or mapped field) | "file" | accept="image/*" |
| FormField | 2023 | "specificComments" |  |  |
| Textarea | 2030 | (state or mapped field) |  |  |

Handlers: Button:791 onClick={() => navigate(`/select-property-type?role=${selectedRole}`)}; form:824 onSubmit={form.handleSubmit(onSubmit, (errors) => {                 console.error("Form validation errors:", errors);                 toast({                   title: "Form Validation Failed",                   description: "Please check the form for errors. See console for details.",                   variant: "destructive",                 });               })}; Button:1524 onClick={() => appendRentSchedule({ year: `${rentScheduleFields.length + 1}${getOrdinalSuffix(rentScheduleFields.length + 1)} Year`, months: "11", amount: "", fromDate: "", toDate: "" })}; Button:1630 onClick={() => removeRentSchedule(index)}; Button:1801 onClick={() => setShowFurnishedModal(true)}; Button:1906 onClick={() => fileInputRef.current?.click()}; Button:1936 onClick={() => removeImage(0)}; Button:1979 onClick={() => internalFileInputRef.current?.click()}; Button:2004 onClick={() => removeInternalImage(index)}; Button:2045 onClick={() => navigate("/manage-property")}

## src/features/properties/ClientPropertyFields.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| FormField | 10 | {key as Path<T>} |  |  |
| select | 10 | {label} |  |  |
| Input | 10 | (state or mapped field) |  |  |

Handlers: 

## src/features/properties/EditProperty.tsx

Forms: line 648: {form.handleSubmit(onSubmit)}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| FormField | 650 | {name} |  |  |
| Input | 650 | (state or mapped field) |  |  |
| FormField | 658 | "propertyTitle" |  |  |
| Input | 665 | (state or mapped field) |  |  |
| FormField | 676 | "configuration" |  |  |
| Select | 682 | (state or mapped field) |  |  |
| FormField | 701 | "listingType" |  |  |
| Select | 707 | (state or mapped field) |  |  |
| FormField | 725 | "saleStatus" |  |  |
| Select | 731 | (state or mapped field) |  |  |
| FormField | 760 | "buyerFirstName" |  |  |
| Input | 767 | (state or mapped field) |  |  |
| FormField | 776 | "buyerLastName" |  |  |
| Input | 783 | (state or mapped field) |  |  |
| FormField | 792 | "buyerPhone" |  |  |
| Input | 799 | (state or mapped field) |  |  |
| FormField | 820 | "monthlyRent" |  |  |
| Input | 827 | (state or mapped field) | "number" |  |
| FormField | 839 | "securityDeposit" |  |  |
| Input | 846 | (state or mapped field) | "number" |  |
| FormField | 858 | "paymentDueDate" |  |  |
| Select | 864 | (state or mapped field) |  |  |
| FormField | 883 | "agreementStartDate" |  |  |
| DatePicker | 890 | (state or mapped field) |  |  |
| FormField | 901 | "agreementEndDate" |  |  |
| DatePicker | 908 | (state or mapped field) |  |  |
| FormField | 919 | "noticePeriod" |  |  |
| Select | 925 | (state or mapped field) |  |  |
| FormField | 948 | "lockInPeriod" |  |  |
| Input | 955 | (state or mapped field) | "number" |  |
| FormField | 970 | "sellingPrice" |  |  |
| Input | 977 | (state or mapped field) | "number" |  |
| FormField | 997 | "unitCondition" |  |  |
| Select | 1003 | (state or mapped field) |  |  |
| FormField | 1021 | "furnishedChecklist" |  |  |
| FormField | 1050 | "maintenanceToBePaidBy" |  |  |
| Select | 1056 | (state or mapped field) |  |  |
| input | 1083 | (state or mapped field) | "file" | accept="image/*" |
| FormField | 1144 | "specificComments" |  |  |
| Textarea | 1151 | (state or mapped field) |  |  |

Handlers: Button:587 onClick={() => navigate("/manage-property")}; Button:605 onClick={() => navigate("/manage-property")}; form:648 onSubmit={form.handleSubmit(onSubmit)}; Button:1027 onClick={() => setShowFurnishedModal(true)}; Button:1091 onClick={() => fileInputRef.current?.click()}; Button:1121 onClick={() => removeImage(index)}; Button:1181 onClick={() => navigate("/manage-property")}

## src/features/properties/FurnishedChecklistModal.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Checkbox | 389 | {item.id} |  |  |
| Input | 405 | {`qty-${item.id}`} | "number" | min="1" |
| Input | 447 | (state or mapped field) |  |  |

Handlers: Input:405 onClick={(e) => e.stopPropagation()}; Button:417 onClick={() => removeCustomItem(item.id)}; Button:469 onClick={() => removeCustomItemInput(index)}; Button:480 onClick={addCustomItemInput}; Button:513 onClick={onClose}; Button:516 onClick={handleSave}

## src/features/properties/ManageProperty.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Select | 691 | (state or mapped field) |  |  |
| Select | 706 | (state or mapped field) |  |  |

Handlers: Button:637 onClick={() => navigate("/archived-properties")}; button:657 onClick={() => setActiveView('owned')}; button:671 onClick={() => setActiveView('tenant')}; Button:753 onClick={clearAllFilters}; Button:775 onClick={() => navigate("/auth")}; DropdownMenuItem:863 onClick={()=>navigate(`/manage-property/${property.id}`)}; DropdownMenuItem:864 onClick={() => handleView(property.id)}; DropdownMenuItem:868 onClick={() => handleEdit(property.id)}; DropdownMenuItem:877 onClick={() => handleAddTenant(property.id, hasValidTenants)}; DropdownMenuItem:892 onClick={() => handleRequestServices(property.id)}; DropdownMenuItem:896 onClick={() => navigate(`/inspection-report/${property.id}`)}; DropdownMenuItem:900 onClick={() => navigate(`/attach-documents/${property.id}?type=tds_report`)}; DropdownMenuItem:903 onClick={() => navigate(`/review/${property.id}`)}; DropdownMenuItem:907 onClick={() => navigate(`/legal-services/${property.id}`)}; DropdownMenuItem:911 onClick={() => navigate(`/other-services/${property.id}`)}; DropdownMenuItem:916 onClick={() => navigate(`/attach-documents/${property.id}`)}; DropdownMenuItem:920 onClick={() => navigate(`/renew-agreement/${property.id}`)}; DropdownMenuItem:924 onClick={() => navigate(`/terminate-agreement/${property.id}`)}; DropdownMenuItem:934 onClick={() => handleArchive(property.id)}; button:1029 onClick={() => {                                               const currentState = wantToSellToggles[property.id] // false;                                               const newValue = !currentState;                                                if (newValue) {                                                 const confirmed = window.confirm(                                                   `Are you sure you want to mark "${property.title}" as "Want to Sell"?\n\nThis will notify the admin with your property and contact details.`                                                 );                                                 if (confirmed) {                                                   setWantToSellToggles(prev => ({ ...prev, [property.id]: true }));                                                   handleToggleWantToSell(property.id, property.title, true);                                                 }                                               } else {                                                 const confirmed = window.confirm(                                                   `Are you sure you want to cancel the sell request for "${property.title}"?\n\nThe admin will be notified of this cancellation.`                                                 );                                                 if (confirmed) {                                                   setWantToSellToggles(prev => ({ ...prev, [property.id]: false }));                                                   handleToggleWantToSell(property.id, property.title, false);                                                 }                                               }                                             }}; DropdownMenuItem:1143 onClick={()=>navigate(`/manage-property/${property.id}`)}; DropdownMenuItem:1144 onClick={() => handleView(property.id)}; DropdownMenuItem:1149 onClick={() => handleRequestServices(property.id)}; DropdownMenuItem:1153 onClick={() => navigate(`/inspection-report/${property.id}`)}; DropdownMenuItem:1157 onClick={() => navigate(`/attach-documents/${property.id}?type=tds_report`)}; DropdownMenuItem:1160 onClick={() => navigate(`/review/${property.id}`)}; DropdownMenuItem:1164 onClick={() => navigate(`/other-services/${property.id}`)}; DropdownMenuItem:1169 onClick={() => navigate(`/renew-agreement/${property.id}`)}; DropdownMenuItem:1173 onClick={() => navigate(`/terminate-agreement/${property.id}`)}; Button:1227 onClick={clearAllFilters}; Button:1236 onClick={clearAllFilters}

## src/features/properties/PropertyDetails.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Select | 1332 | (state or mapped field) |  |  |
| DatePicker | 1351 | (state or mapped field) |  | min={(() => {
                      const today = new Date();
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      const day = String(today.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    })()} |

Handlers: Button:471 onClick={() => navigate("/")}; Button:529 onClick={handleRequestTermination}; Button:542 onClick={() => navigate(-1)}; img:1093 onClick={() => window.open(request.serviceImage, '_blank')}; img:1127 onClick={() => window.open(request.adminImage, '_blank')}; Button:1140 onClick={() => {                                   if (request.type === 'agreement_termination') navigate(`/terminate-agreement/${propertyId}`);                                   if (request.type === 'agreement_renewal') navigate(`/renew-agreement/${propertyId}`);                                 }}; Button:1378 onClick={() => setIsTerminationDialogOpen(false)}; Button:1379 onClick={submitTerminationRequest}

## src/features/properties/PropertyHub.tsx

Forms: line 43: {e=>save(e,'rent_ledger')}; line 53: {e=>save(e,'internal_note')}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 43 | "month" | "month" | required=true |
| Input | 43 | "expectedRent" | "number" | required=true, min="0" |
| Input | 43 | "dueDate" | "date" | required=true |
| select | 43 | "status" |  |  |
| select | 43 | "receiptId" |  |  |
| Input | 43 | "notes" |  | maxLength={1000} |
| Input | 53 | "note" |  | required=true, maxLength={2000} |

Handlers: Button:19 onClick={()=>query.refetch()}; form:43 onSubmit={e=>save(e,'rent_ledger')}; Button:50 onClick={async()=>{setBusy(true);try{await workflowRequest(`visits/${v.id}`,{status},'PUT');await query.refetch();}catch(error){setFailure(error instanceof Error?error.message:'Could not update visit');}finally{setBusy(false);}}}; form:53 onSubmit={e=>save(e,'internal_note')}

## src/features/properties/TenantPropertyForm.tsx

Forms: line 21: {submit}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| select | 23 | "Property category" |  |  |
| select | 24 | "Property type" |  | required=true |
| Input | 25 | (state or mapped field) | {key.startsWith('agreement')&&key.endsWith('Date')?'date':key==='paymentDueDate'?'number':'text'} | required={!!required}, min={key==='paymentDueDate'?1:undefined}, max={key==='paymentDueDate'?31:undefined} |
| select | 26 | (state or mapped field) |  |  |
| select | 27 | (state or mapped field) |  |  |
| select | 28 | (state or mapped field) |  |  |
| Input | 29 | (state or mapped field) | {key.includes('Date')?'date':'number'} | required=true, min={key.includes('Date')?undefined:1} |
| Input | 30 | (state or mapped field) | {key==='email'?'email':key.includes('Phone')||key==='phone'?'tel':'text'} | required={key==='phone'}, maxLength={500} |
| Input | 31 | (state or mapped field) |  |  |
| Input | 32 | (state or mapped field) | "file" | accept="image/png,image/jpeg,image/webp" |
| textarea | 33 | (state or mapped field) |  |  |

Handlers: Button:21 onClick={()=>navigate('/select-property-type')}; form:21 onSubmit={submit}; Button:29 onClick={()=>setRentSchedule(rows=>[...rows,{year:`${rows.length+1} year`,months:'12',amount:'',fromDate:'',toDate:''}])}; Button:29 onClick={()=>setRentSchedule(rows=>rows.slice(0,-1))}; Button:29 onClick={()=>setShowChecklist(true)}

## src/features/search/CommercialPropertySearchForm.tsx

Forms: line 71: {form.handleSubmit(onSubmit)}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| FormField | 72 | "location" |  |  |
| Input | 79 | (state or mapped field) |  |  |
| FormField | 87 | "budgetMin" |  |  |
| Input | 94 | (state or mapped field) |  |  |
| FormField | 101 | "budgetMax" |  |  |
| Input | 108 | (state or mapped field) |  |  |
| FormField | 116 | "configuration" |  |  |
| Select | 122 | (state or mapped field) |  |  |
| FormField | 141 | "purpose" |  |  |
| Select | 147 | (state or mapped field) |  |  |
| FormField | 166 | "remarks" |  |  |
| Textarea | 173 | (state or mapped field) |  |  |

Handlers: Button:57 onClick={onBack}; form:71 onSubmit={form.handleSubmit(onSubmit)}

## src/features/search/PropertySearchForm.tsx

Forms: line 68: {form.handleSubmit(onSubmit)}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| FormField | 69 | "location" |  |  |
| Input | 76 | (state or mapped field) |  |  |
| FormField | 84 | "budgetMin" |  |  |
| Input | 91 | (state or mapped field) |  |  |
| FormField | 98 | "budgetMax" |  |  |
| Input | 105 | (state or mapped field) |  |  |
| FormField | 113 | "configuration" |  |  |
| Select | 119 | (state or mapped field) |  |  |
| FormField | 138 | "projectCondition" |  |  |
| Select | 144 | (state or mapped field) |  |  |
| FormField | 162 | "remarks" |  |  |
| Textarea | 169 | (state or mapped field) |  |  |

Handlers: Button:54 onClick={onBack}; form:68 onSubmit={form.handleSubmit(onSubmit)}

## src/features/search/SearchBar.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Select | 34 | (state or mapped field) |  |  |
| Input | 44 | (state or mapped field) |  |  |

Handlers: Button:52 onClick={handleSearch}

## src/features/search/SearchResults.tsx

Forms: line 277: {handleSearch}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Select | 281 | (state or mapped field) |  |  |
| Input | 294 | (state or mapped field) |  |  |
| Select | 304 | (state or mapped field) |  |  |

Handlers: form:277 onSubmit={handleSearch}; Button:402 onClick={() => { setSearchQuery(''); void performSearch({query: ''}); }}; Button:532 onClick={() => handleEnquireProperty(property)}

## src/features/services/AddTenant.tsx

Forms: button-driven controls

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 851 | {`firstName - ${tenant.id} `} |  |  |
| Input | 860 | {`lastName - ${tenant.id} `} |  |  |
| Input | 869 | {`email - ${tenant.id} `} | "email" |  |
| Input | 880 | {`phone - ${tenant.id} `} |  |  |
| Input | 923 | {`emergencyContact - ${tenant.id} `} |  |  |
| Checkbox | 932 | {`isMarried - ${tenant.id} `} |  |  |
| Input | 956 | {`spouseFirstName - ${tenant.id} `} |  |  |
| Input | 965 | {`spouseLastName - ${tenant.id} `} |  |  |
| Input | 974 | {`spouseEmail - ${tenant.id} `} | "email" |  |
| Input | 984 | {`spousePhone - ${tenant.id} `} |  |  |
| Select | 993 | (state or mapped field) |  |  |
| Input | 1012 | {`spouseEmployer - ${tenant.id} `} |  |  |
| Textarea | 1021 | {`spouseNotes - ${tenant.id} `} |  |  |
| DatePicker | 1041 | (state or mapped field) |  |  |
| DatePicker | 1048 | (state or mapped field) |  |  |
| Input | 1055 | {`monthlyRent - ${tenant.id} `} |  |  |
| Input | 1064 | {`securityDeposit - ${tenant.id} `} |  |  |
| Input | 1091 | (state or mapped field) |  |  |
| Input | 1099 | (state or mapped field) | "number" |  |
| Input | 1109 | (state or mapped field) |  |  |
| DatePicker | 1119 | (state or mapped field) |  |  |
| DatePicker | 1129 | (state or mapped field) |  |  |
| Input | 1156 | {`paymentDueDate - ${tenant.id} `} | "number" | min="1", max="31" |
| Select | 1168 | (state or mapped field) |  |  |
| Input | 1186 | {`lockInPeriod - ${tenant.id} `} | "number" |  |
| Textarea | 1206 | {`previousAddress - ${tenant.id} `} |  |  |
| Select | 1217 | (state or mapped field) |  |  |
| Input | 1233 | {`employer - ${tenant.id} `} |  |  |
| Textarea | 1241 | {`notes - ${tenant.id} `} |  |  |

Handlers: Button:589 onClick={() => navigate("/manage-property")}; Button:813 onClick={addTenant}; Button:832 onClick={() => removeTenant(tenant.id)}; Button:1075 onClick={() => addRentScheduleYear(tenant.id)}; Button:1139 onClick={() => removeRentScheduleYear(tenant.id, index)}; Button:1252 onClick={handleSubmit}

## src/features/services/AgreementWorkflow.tsx

Forms: line 44: {e=>{e.preventDefault();void submit('request');}}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 45 | {key} | {key.includes('Date')?'date':'text'} |  |
| select | 45 | "maintenance-payer" |  |  |
| Input | 45 | "notice-period" |  |  |
| Input | 45 | "notice-start" | "date" | required=true |
| Input | 45 | "termination-date" | "date" | required=true, min={start} |

Handlers: form:44 onSubmit={e=>{e.preventDefault();void submit('request');}}; Button:48 onClick={()=>void submit('approve')}; Button:48 onClick={()=>void submit('request')}; Button:48 onClick={()=>void submit('reject')}; Button:49 onClick={()=>void submit('terminate')}

## src/features/services/AttachDocuments.tsx

Forms: line 472: {handleSubmit}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 475 | "documentName" |  | required=true |
| Select | 486 | (state or mapped field) |  |  |
| Input | 500 | {key} | {key==="receiptDate"?"date":"text"} |  |
| Input | 523 | "file" | "file" | accept="image/*,application/pdf" |
| Textarea | 544 | "description" |  |  |

Handlers: Button:374 onClick={() => navigate(-1)}; Button:395 onClick={() => setShowAddForm(true)}; Button:408 onClick={() => setShowAddForm(true)}; Button:427 onClick={async()=>{try{const comment=window.prompt("Report review comment");if(comment===null)return;const response=await apiFetch(`${API_BASE_URL}/documents/${doc.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status,comment})});if(!response.ok)throw new Error("Could not update report");setDocuments(current=>current.map(item=>item.id===doc.id?{...item,status,adminComment:comment}:item));}catch(error){setLoadError(error instanceof Error?error.message:"Update failed");}}}; Button:436 onClick={() => setViewingDocument(doc)}; Button:444 onClick={() => handleDelete(doc.id)}; form:472 onSubmit={handleSubmit}; Button:507 onClick={() => {                         setFileUrl("");                         if (fileInputRef.current) {                           fileInputRef.current.value = '';                         }                       }}; Button:571 onClick={() => {                     setShowAddForm(false);                     setDocumentName("");                     setDocumentType("");                     setFileUrl("");                     setDescription("");                     if (fileInputRef.current) {                       fileInputRef.current.value = '';                     }                   }}

## src/features/services/InspectionReport.tsx

Forms: line 400: {handleSubmit}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| input | 316 | {field} | "file" | accept="image/*" |
| input | 354 | {field} | "file" | accept="image/*,application/pdf" |
| Select | 403 | (state or mapped field) |  |  |
| Textarea | 430 | "keysDetails" |  |  |
| Textarea | 479 | "keysDetails" |  |  |
| Textarea | 514 | "report" |  |  |

Handlers: Button:303 onClick={() => removeMultiFile(field, index)}; Button:343 onClick={() => removeFile(field)}; Button:380 onClick={() => navigate(-1)}; form:400 onSubmit={handleSubmit}; Button:542 onClick={() => navigate(-1)}

## src/features/services/Review.tsx

Forms: line 209: {handleSubmit}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Textarea | 228 | (state or mapped field) |  |  |
| Textarea | 238 | (state or mapped field) |  |  |
| Textarea | 248 | (state or mapped field) |  |  |
| Textarea | 258 | (state or mapped field) |  |  |
| Textarea | 268 | (state or mapped field) |  |  |
| Textarea | 278 | (state or mapped field) |  |  |
| Textarea | 300 | (state or mapped field) |  |  |
| Textarea | 310 | (state or mapped field) |  |  |
| Textarea | 320 | (state or mapped field) |  |  |
| Textarea | 330 | (state or mapped field) |  |  |
| Textarea | 340 | (state or mapped field) |  |  |
| Textarea | 350 | (state or mapped field) |  |  |

Handlers: Button:189 onClick={() => navigate(-1)}; form:209 onSubmit={handleSubmit}; Button:381 onClick={() => navigate(-1)}

## src/features/services/ServiceRequestWorkflow.tsx

Forms: line 40: {e=>void update(e,request.id)}; line 67: {e=>void submit(e)}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| select | 41 | "status" |  |  |
| select | 42 | "archive" |  |  |
| Textarea | 43 | "resolutionReport" |  |  |
| Textarea | 44 | "adminNotes" |  |  |
| input | 45 | "adminImage" | "hidden" |  |
| Input | 45 | "attachment" | "file" | accept="image/png,image/jpeg,image/webp" |
| select | 67 | "request-category" |  | required=true |
| Input | 67 | "request-image" | "file" | accept="image/png,image/jpeg,image/webp" |
| Textarea | 67 | "request-comment" |  | required=true |

Handlers: form:40 onSubmit={e=>void update(e,request.id)}; form:67 onSubmit={e=>void submit(e)}

## src/features/visit-planner/VisitPlanner.tsx

Forms: line 346: {handleSubmit}

| Control | Line | Field / ID | Type | Required / limits |
| --- | --- | --- | --- | --- |
| Input | 349 | "title" |  | required=true |
| DatePicker | 355 | (state or mapped field) |  | min={new Date().toISOString().split('T')[0]} |
| TimePicker | 360 | (state or mapped field) |  | required=true |
| Select | 364 | (state or mapped field) |  |  |
| Textarea | 381 | "description" |  |  |

Handlers: Button:315 onClick={() => deleteVisit(visit.id)}; Button:330 onClick={() => setIsAddingVisit(true)}; form:346 onSubmit={handleSubmit}; Button:397 onClick={() => setIsAddingVisit(false)}

