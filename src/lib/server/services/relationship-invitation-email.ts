import 'server-only';
import { createHash } from 'node:crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { normalizeEmailAddress } from '@/lib/email-address';
import { currentConnectionState } from '@/lib/relationship-link-state';
import { COLLECTIONS, getDatabase } from '../firestore';
import { stringValue as s, type RecordData } from './contracts';
import { emailDeliveryId, writeEmailOutbox, type TransactionalEmailEvent } from './transactional-email';
import {DEFAULT_EMAIL_SENDER} from './resend';

export type InvitationIntent = {claimId: string; email: unknown};
type Kind = 'owner' | 'tenant';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));
const variants = {
  owner: {
    subject: 'Property Ownership Verification Request | PropBank',
    heading: 'Review an ownership request', cta: 'Review Ownership Request',
    paragraphs: [
      'A tenant has submitted property information and identified you as the owner.',
      'To review this request, please sign in or create your account and complete the required ownership verification.',
      'No property ownership access has been granted.',
    ],
  },
  tenant: {
    subject: "You've Been Invited to Confirm a Tenancy | PropBank",
    heading: 'Review a rental connection', cta: 'Review Tenancy Invitation',
    paragraphs: [
      'A property owner has submitted tenancy information and invited you to review a rental property connection.',
      'Sign in or create your account to review the invitation and confirm whether the tenancy belongs to you.',
      'You will not be linked to the property until the required identity verification and confirmation steps are completed.',
    ],
  },
} as const;

function publicOrigin(): string | null {
  try {
    const url = new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '');
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol) || process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null;
    // Never propagate configured path/query/fragment or any invitation identifier.
    return url.origin;
  } catch {return null;}
}

/** Only a fixed variant and trusted deployment configuration enter this layout. */
export function invitationEmailTemplate(kind: Kind) {
  const origin = publicOrigin();
  if (!origin) return null;
  const variant = variants[kind], href = `${origin}/manage-property#pending-connections`, support = `${origin}/support`;
  const supportEmail = normalizeEmailAddress(process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || DEFAULT_EMAIL_SENDER);
  const ignore = 'If you do not recognize this invitation, please ignore it or report it to our support team.';
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body style="margin:0;padding:0;background:#f5f2e9;color:#242b28;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f2e9"><tr><td align="center" style="padding:28px 16px"><!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fffdf8"><tr><td bgcolor="#183c32" style="padding:24px 28px;border-bottom:3px solid #a28b64;color:#f8f6f0;font-size:20px;font-weight:bold;letter-spacing:-.5px">PropBank</td></tr><tr><td style="padding:30px 28px"><h1 style="margin:0 0 25px;font-size:25px;line-height:1.25;font-weight:500;color:#183c32">${escape(variant.heading)}</h1><p style="margin:0 0 18px;font-size:15px;line-height:1.75">Hello,</p>${variant.paragraphs.map(text => `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#465149">${escape(text)}</p>`).join('')}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:25px 0"><tr><td bgcolor="#183c32" style="padding:14px 20px"><a href="${escape(href)}" style="display:inline-block;font-size:14px;line-height:1.5;font-weight:bold;color:#f8f6f0;text-decoration:none">${escape(variant.cta)}</a></td></tr></table><p style="margin:0;font-size:13px;line-height:1.8;color:#60695f">${escape(ignore)}</p></td></tr><tr><td style="padding:20px 28px;border-top:1px solid #ded8ca;font-size:12px;line-height:1.8;color:#60695f"><a href="${escape(support)}" style="color:#6d5737;text-decoration:underline">Report an unsolicited invitation or contact support</a>${supportEmail ? `<br><a href="mailto:${escape(encodeURIComponent(supportEmail).replace('%40', '@'))}" style="color:#6d5737;text-decoration:none">${escape(supportEmail)}</a>` : ''}<br>This invitation does not verify an identity or authorize property access.</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return {subject: variant.subject, html, text: `Hello,\n\n${variant.paragraphs.join('\n\n')}\n\n${variant.cta}: ${href}\n\n${ignore}\n\nReport an unsolicited invitation or contact support: ${support}${supportEmail ? `\n${supportEmail}` : ''}\n\nThis invitation does not verify an identity or authorize property access.`};
}

/** Stage only explicit new-intake intents; callers never invoke this on discovery. */
export async function stageInvitationEmails(tx: Transaction, freshClaims: RecordData[], intents: InvitationIntent[]) {
  const ready: TransactionalEmailEvent[] = [], suppressed: Array<{event: TransactionalEmailEvent; reason: string}> = [];
  const controls = new Map<string, {ref: DocumentReference; count: number; changed: boolean; expiresAt: Date}>();
  const actors = new Map<string, boolean>(), now = new Date(), hour = Math.floor(now.getTime() / 3600000), day = Math.floor(now.getTime() / 86400000);
  for (const claim of freshClaims) {
    const intent = intents.find(item => item.claimId === claim.id), email = normalizeEmailAddress(intent?.email);
    if (!email || !intent || ['linked','expired','rejected'].includes(currentConnectionState(claim))) continue;
    const kind = claim.relationship;
    if (kind !== 'owner' && kind !== 'tenant') continue;
    const actor = s(claim.invitationAuthorizedByUID || claim.createdByUID);
    if (kind === 'tenant' && (!claim.ownerUID || claim.authorizedByUID !== claim.ownerUID || actor !== claim.ownerUID)) continue;
    if (!actor) continue;
    const content = invitationEmailTemplate(kind), idempotencyKey = `relationship-invitation-v1-${hash(`${kind}:${s(claim.id)}`)}`;
    const event: TransactionalEmailEvent = {
      eventType: `relationship.${kind}_invitation`, eventId: s(claim.id),
      recipientRole: `reported_${kind}_invitation`, recipientEmail: email,
      propertyId: s(claim.propertyId), recordId: s(claim.id), invitationClaimId: s(claim.id),
      templateId: `relationship-${kind}-invitation`, templateVersion: 1, idempotencyKey,
      subject: variants[kind].subject, html: content?.html || '', text: content?.text || '',
    };
    const ref = getDatabase().collection(COLLECTIONS.emailDeliveries || 'email_deliveries').doc(emailDeliveryId(event));
    if ((await tx.get(ref)).exists) continue;
    if (!actors.has(actor)) {
      const profile = await tx.get(getDatabase().collection(COLLECTIONS.users).doc(actor));
      actors.set(actor, profile.exists && profile.data()?.isActive !== false);
    }
    if (!actors.get(actor)) {suppressed.push({event, reason: 'Sender is not active'}); continue;}
    if (!content) {suppressed.push({event, reason: 'Invitation application URL requires configuration'}); continue;}
    const windows = [
      {key: `sender-hour:${actor}:${hour}`, limit: 10, expiresAt: new Date((hour + 2) * 3600000)},
      {key: `sender-day:${actor}:${day}`, limit: 30, expiresAt: new Date((day + 2) * 86400000)},
      {key: `recipient-day:${email}:${day}`, limit: 3, expiresAt: new Date((day + 2) * 86400000)},
    ];
    const quotas = [];
    for (const window of windows) {
      const key = hash(window.key);
      if (!controls.has(key)) {
        const controlRef = getDatabase().collection('email_invitation_limits').doc(key), snapshot = await tx.get(controlRef);
        controls.set(key, {ref: controlRef, count: Number(snapshot.data()?.count || 0), changed: false, expiresAt: window.expiresAt});
      }
      quotas.push({control: controls.get(key)!, limit: window.limit});
    }
    if (quotas.some(quota => quota.control.count >= quota.limit)) {suppressed.push({event, reason: 'Invitation rate limit reached'}); continue;}
    for (const {control} of quotas) {control.count++; control.changed = true;}
    ready.push(event);
  }
  return {events: ready, write: () => {
    for (const control of controls.values()) if (control.changed) tx.set(control.ref, {count: control.count, expiresAt: control.expiresAt});
    writeEmailOutbox(tx, ready);
    for (const {event, reason} of suppressed) {
      const id = emailDeliveryId(event);
      tx.create(getDatabase().collection(COLLECTIONS.emailDeliveries || 'email_deliveries').doc(id), {...event, id, status: 'suppressed', retryCount: 0, errorSummary: reason, createdAt: now, updatedAt: now});
    }
  }};
}
