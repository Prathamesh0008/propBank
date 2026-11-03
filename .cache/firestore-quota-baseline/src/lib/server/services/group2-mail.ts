import 'server-only';
import { templates } from './group2-email-templates';
import { templates as propertyTemplates } from './property-email-templates';
import { formatTemplate, queueEmail, sendEmail, bestEffort,escapeHtml,trustedTemplateHtml } from './property-effects';
import {persistUserEvent} from './transactional-email';
import { stringValue as s, type RecordData } from './contracts';

export function formatIST(date:Date) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'long',month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(date);
  const p=(key:string)=>parts.find(part=>part.type===key)?.value||'';
  return `${p('weekday')}, ${p('month')} ${p('day')}, ${p('year')} at ${p('hour')}:${p('minute')} ${p('dayPeriod')} IST`;
}
export function visitMail(user:RecordData,visit:RecordData) {
  queueEmail({to:s(user.email),subject:`✅ Visit Scheduled: ${s(visit.title)}`,html:formatTemplate(templates.VisitConfirmation[0],[s(user.name),s(visit.title),formatIST(new Date(s(visit.visitDate)||String(visit.visitDate))),String(visit.reminderTime),s(visit.reminderType),s(visit.description)])});
}
export function tenantMail(property:RecordData,tenant:RecordData) {
  const details=[s(property.title),s(property.address),s(property.propertyType),s(tenant.monthlyRent),s(tenant.leaseStartDate),s(tenant.leaseEndDate)];
  queueEmail({to:s(tenant.email),subject:"🏠 Welcome! You've been added as a Tenant - Propbank",html:formatTemplate(propertyTemplates.TenantAdded,['Welcome to Your New Home!',`${s(tenant.firstName)} ${s(tenant.lastName)}`,'You have been added as a tenant to the following property.',...details])});
  queueEmail({to:s(property.ownerEmail),subject:'🏠 Tenant Added to Your Property - Propbank',html:formatTemplate(propertyTemplates.TenantAdded,['Tenant Added to Your Property',s(property.ownerName),'A new tenant has been added to your property.',...details])});
}
export function inquiryMail(req:RecordData) {
  const listing=req.inquiryType==='buy'?'Buying':req.inquiryType==='sell'?'Selling':'Renting';
  const visit=req.requestVisit?`Requested on ${s(req.visitDate)} at ${s(req.visitTime)}`:'Not requested';
  const subject=`📩 New Quick Inquiry: ${s(req.userName)}`;
  return persistUserEvent({eventType:'enquiry.general_created',eventId:`${s(req.id)}:created`,recipients:[{role:'admin',email:process.env.ADMIN_EMAIL}],recordId:s(req.id),templateId:'general-enquiry',subject,title:'New general enquiry',bodyHtml:formatTemplate(templates.GeneralInquiry[0],[s(req.userName),s(req.userEmail),s(req.userPhone),listing,s(req.propertyType),visit,s(req.message),s(req.userEmail)]),bodyText:`New ${listing.toLowerCase()} enquiry from ${s(req.userName)}. Review it in the administrator portal.`,action:{label:'Open enquiry inbox',path:'/admin?tab=notifications'}});
}
export function ownerTerminationMail(property:RecordData,owner:RecordData,tenant:RecordData,notice:boolean,terminationDate:string) {
  for(const isTenant of [true,false]) {
    const recipient=isTenant?tenant:owner;
    const details=[s(property.title),s(property.location),s(property.unitNumber),s(property.floor),s(property.propertyType),s(property.configuration),s(property.carpetArea),s(property.monthlyRent)];
    const statement=isTenant?`We have received a notice to terminate the lease agreement for ${s(property.title)}. The agreement will be terminated on ${terminationDate}.`:`You have successfully served a termination notice for ${s(property.title)}. The agreement is scheduled to end on ${terminationDate}.`;
    const html=notice?formatTemplate(templates.AgreementNotice[0],[isTenant?'Termination Notice':'Notice Initiated',s(recipient.name),trustedTemplateHtml(escapeHtml(statement).replace(escapeHtml(s(property.title)),`<strong>${escapeHtml(s(property.title))}</strong>`).replace(escapeHtml(terminationDate),`<strong>${escapeHtml(terminationDate)}</strong>`)),...details,terminationDate,'Owner']):formatTemplate(templates.AgreementTermination[0],[isTenant?'Agreement Termination Notice':'Agreement Terminated',s(recipient.name),isTenant?'The property owner has terminated your rental agreement. Please review the details below.':'The rental agreement has been successfully terminated.',terminationDate,'Agreement terminated by property owner','Owner',...details,s(property.agreementStartDate),s(property.agreementEndDate)]);
    queueEmail({to:s(recipient.email),subject:notice?(isTenant?'📅 Agreement Termination Notice Served - Propbank':'✅ Notice Period Initiated - Propbank'):(isTenant?'⚠️ Agreement Termination Notice - Propbank':'✅ Agreement Terminated Successfully - Propbank'),html});
  }
}
export async function tenantRequestMail(property:RecordData,owner:RecordData,tenant:RecordData,renew:boolean,noticePeriod:string) {
  const notice=noticePeriod||'Immediate';
  const source=renew?templates.RenewalRequest:templates.TerminationRequest;
  const mails=[{to:s(owner.email),subject:renew?`🔄 Renewal Request: ${s(property.title)}`:`📢 Termination Request: ${s(property.title)} - ${notice}`,html:formatTemplate(source[0],renew?[s(owner.name),s(tenant.name),s(property.title),s(property.id)]:[s(owner.name),s(tenant.name),s(property.title),notice,s(property.id)])},{to:s(tenant.email),subject:renew?'Renewal Request Received - Propbank':'Termination Request Received - Propbank',html:formatTemplate(source[1],renew?[s(tenant.name),s(property.title),s(owner.name)]:[s(tenant.name),s(property.title),notice,s(owner.name)])}];
  for(const mail of mails) {if(renew)await bestEffort(()=>sendEmail(mail));else queueEmail(mail);}
}
