import {renderTransactionalEmail} from '@/lib/email-design';
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
export function invitationEmailTemplate(kind: Kind, adminIntake=false, registered=false) {
  const origin = publicOrigin();
  if (!origin) return null;
  const baseVariant=variants[kind];
  const variant=adminIntake?{...baseVariant,paragraphs:[
    kind==='owner'?'PropBank Admin submitted a property and nominated you as the prospective owner.':'PropBank Admin submitted a tenancy invitation for your review.',
    registered?'Sign in with the verified account that received this invitation, then review and accept or reject the relationship.':'Create an account or sign in, verify the same email address that received this invitation, then review and accept or reject the relationship.',
    'No ownership or tenancy access is granted by this email. Tenant access requires both owner and tenant acceptance.'
  ]}:baseVariant;
  const href = `${origin}/manage-property#pending-connections`, support = `${origin}/support`;
  const supportEmail = normalizeEmailAddress(process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || DEFAULT_EMAIL_SENDER);
  const ignore = 'If you do not recognize this invitation, please ignore it or report it to our support team.';
  return {subject:variant.subject,...renderTransactionalEmail(variant.heading,variant.paragraphs.map(text=>`<p>${escape(text)}</p>`).join('')+`<p>Report an unsolicited invitation or contact support${supportEmail?`: ${escape(supportEmail)}`:''}.</p>`,variant.paragraphs.join('\n\n')+`\n\nReport an unsolicited invitation or contact support${supportEmail?`: ${supportEmail}`:''}.`,{label:variant.cta,path:'/manage-property#pending-connections'},{preheader:variant.paragraphs[0],nextStep:ignore+' This invitation does not verify an identity or authorize property access.'})};
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
    if (kind === 'tenant' && !claim.adminIntake && (!claim.ownerUID || claim.authorizedByUID !== claim.ownerUID || actor !== claim.ownerUID)) continue;
    if (!actor) continue;
    const content = invitationEmailTemplate(kind,claim.adminIntake===true,!!claim.candidateUID), idempotencyKey = `relationship-invitation-v1-${hash(`${kind}:${s(claim.id)}`)}`;
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
      actors.set(actor, profile.exists && profile.data()?.isActive !== false && (!claim.adminIntake||profile.data()?.role==='admin'&&claim.adminAuthorizedByUID===actor));
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
