import 'server-only';
import { templates } from './group2-email-templates';
import { formatTemplate, queueEmail } from './property-effects';
import { queueUserEvent } from './transactional-email';
import { stringValue as s, type RecordData } from './contracts';

export function formatIST(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(date);
  const p = (key: string) => parts.find((part) => part.type === key)?.value || '';
  return `${p('weekday')}, ${p('month')} ${p('day')}, ${p('year')} at ${p('hour')}:${p('minute')} ${p('dayPeriod')} IST`;
}

export function visitMail(user: RecordData, visit: RecordData) {
  const uid = s(user.uid);
  if (!uid) return;
  queueUserEvent({ eventType: 'visit.scheduled', eventId: s(visit.id), templateId: 'visit-scheduled', subject: `Visit scheduled: ${s(visit.title)}`, recipientUIDs: [uid], propertyId: s(visit.propertyId), bodyHtml: `<p>Your visit for <strong>${s(visit.title)}</strong> is scheduled for ${formatIST(new Date(s(visit.visitDate) || String(visit.visitDate)))}.</p>`, bodyText: `Your visit for ${s(visit.title)} is scheduled for ${formatIST(new Date(s(visit.visitDate) || String(visit.visitDate)))}.` });
}

export function tenantMail(property: RecordData, tenant: RecordData) {
  const propertyId = s(property.id);
  const recipientUIDs = [s(tenant.userUID), s(property.ownerUID)].filter(Boolean);
  if (!recipientUIDs.length) return;
  queueUserEvent({ eventType: 'tenancy.tenant_assigned', eventId: `${propertyId}:${s(tenant.id) || s(tenant.userUID)}`, templateId: 'tenant-assigned', subject: `Tenant assigned: ${s(property.title)}`, recipientUIDs, propertyId, bodyHtml: `<p>A tenant relationship has been added for <strong>${s(property.title)}</strong>. Sign in to review the current rental details.</p>`, bodyText: `A tenant relationship has been added for ${s(property.title)}. Sign in to review the current rental details.` });
}

export function inquiryMail(req: RecordData) {
  const listing = req.inquiryType === 'buy' ? 'Buying' : req.inquiryType === 'sell' ? 'Selling' : 'Renting';
  const visit = req.requestVisit ? `Requested on ${s(req.visitDate)} at ${s(req.visitTime)}` : 'Not requested';
  queueEmail({ to: process.env.ADMIN_EMAIL || 'connectpropbank@gmail.com', subject: `New Quick Inquiry: ${s(req.userName)}`, html: formatTemplate(templates.GeneralInquiry[0], [s(req.userName), s(req.userEmail), s(req.userPhone), listing, s(req.propertyType), visit, s(req.message), s(req.userEmail)]) });
}

export function ownerTerminationMail(property: RecordData, owner: RecordData, tenant: RecordData, notice: boolean, terminationDate: string) {
  const recipientUIDs = [s(owner.uid) || s(property.ownerUID), s(tenant.userUID) || s(tenant.uid)].filter(Boolean);
  if (!recipientUIDs.length) return;
  queueUserEvent({ eventType: notice ? 'agreement.termination_notice' : 'agreement.terminated', eventId: `${s(property.id)}:${terminationDate}`, templateId: notice ? 'agreement-termination-notice' : 'agreement-terminated', subject: `${notice ? 'Agreement termination notice' : 'Agreement terminated'}: ${s(property.title)}`, recipientUIDs, propertyId: s(property.id), bodyHtml: `<p>The rental agreement for <strong>${s(property.title)}</strong> ${notice ? `is scheduled to end on ${terminationDate}` : `ended on ${terminationDate}`}.</p>`, bodyText: `The rental agreement for ${s(property.title)} ${notice ? `is scheduled to end on ${terminationDate}` : `ended on ${terminationDate}`}.` });
}

export async function tenantRequestMail(property: RecordData, owner: RecordData, tenant: RecordData, renew: boolean, noticePeriod: string) {
  const recipientUIDs = [s(owner.uid) || s(property.ownerUID), s(tenant.userUID) || s(tenant.uid)].filter(Boolean);
  if (!recipientUIDs.length) return;
  queueUserEvent({ eventType: renew ? 'agreement.renewal_requested' : 'agreement.termination_requested', eventId: `${s(property.id)}:${renew ? 'renew' : 'terminate'}:${s(property.updatedAt) || noticePeriod}`, templateId: renew ? 'agreement-renewal-requested' : 'agreement-termination-requested', subject: `${renew ? 'Agreement renewal request' : 'Agreement termination request'}: ${s(property.title)}`, recipientUIDs, propertyId: s(property.id), bodyHtml: `<p>A ${renew ? 'renewal' : 'termination'} request was submitted for <strong>${s(property.title)}</strong>. Sign in to review it.</p>`, bodyText: `A ${renew ? 'renewal' : 'termination'} request was submitted for ${s(property.title)}. Sign in to review it.` });
}
