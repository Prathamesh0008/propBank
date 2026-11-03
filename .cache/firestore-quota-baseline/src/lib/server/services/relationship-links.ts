import 'server-only';
import { stageInvitationEmails, type InvitationIntent } from './relationship-invitation-email';
import { createHash } from 'node:crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import type { AuthenticatedUser } from '../auth';
import { requireUser, AccessError } from '../auth';
import { getFirebaseAdminAuth } from '../firebase-admin';
import { COLLECTIONS, getDatabase } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { CONNECTION_STATES, CONNECTION_TTL_MS, connectionExpiry, currentConnectionState } from '@/lib/relationship-link-state';
import { indianMobile } from '@/lib/indian-phone';
import { normalizeEmailAddress } from '@/lib/email-address';
import { isRecord, stringValue as s, type RecordData } from './contracts';
import { readObject } from './domain-contracts';
import { bestEffort } from './property-effects';
import { persistUserEvent, dispatchEmailOutbox, type TransactionalEmailEvent } from './transactional-email';

export const LINK_COLLECTION = 'relationship_links';
const links = () => getDatabase().collection(LINK_COLLECTION);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const linkID = (kind: string, propertyId: string, tenantId = '', phone = '', email = '') => hash(JSON.stringify([kind, propertyId, tenantId, email ? '' : phone, ...(email ? [email] : [])]));
type ConnectionIdentity = {email: string | null; phone: string | null};
/** Current Admin UserRecord, never an editable profile or token email. */
export async function connectionIdentity(user: AuthenticatedUser): Promise<ConnectionIdentity> {
  try {
    const account = await getFirebaseAdminAuth().getUser(user.uid);
    if (account.disabled || !account.emailVerified) return {email: null, phone: null};
    const phone = indianMobile(user.token.phone_number);
    return {email: normalizeEmailAddress(account.email), phone: phone && indianMobile(account.phoneNumber) === phone ? phone : null};
  } catch (error) {
    if ((error as {code?: string}).code === 'auth/user-not-found') return {email: null, phone: null};
    throw error;
  }
}
const matches = (claim: RecordData, identity: ConnectionIdentity) => claim.recipientEmailNormalized
  ? !!identity.email && identity.email === claim.recipientEmailNormalized
  : !!identity.phone && identity.phone === claim.contactE164;
/** Reused by admin review and delayed owner approval; email claims never fall back to phone. */
export function connectionAccountMatches(claim: RecordData, account: {disabled?: boolean; emailVerified: boolean; email?: string; phoneNumber?: string}) {
  return !account.disabled && account.emailVerified && matches(claim, {email: normalizeEmailAddress(account.email), phone: indianMobile(account.phoneNumber)});
}
const entries = (value: unknown): RecordData[] => Array.isArray(value) ? value.filter(isRecord) : [];
const terminal = (claim: RecordData) => ['linked', 'rejected', 'expired'].includes(currentConnectionState(claim));

function statePatch(claim: RecordData) {
  const status = currentConnectionState(claim), now = new Date();
  return {status, version: Number(claim.version || 0) + 1, updatedAt: now,
    ...(status === 'expired' ? {expiredAt: now} : {})};
}

/** Canonicalize older states and persist expiry only for an authorized viewer. */
async function refreshState(ref: DocumentReference, user: AuthenticatedUser, identity: ConnectionIdentity, admin = false, initial?: RecordData): Promise<RecordData | null> {
  // Stable reads are already scoped by UID and require no write transaction.
  // Property authorization for owner projections is rechecked below as well.
  if (initial && currentConnectionState(initial) === initial.status && (
    admin && user.role === 'admin' || initial.candidateUID === user.uid && matches(initial, identity) || initial.ownerUID === user.uid
  )) return initial;
  return getDatabase().runTransaction(async tx => {
    const snapshot = await tx.get(ref), claim = snapshot.data();
    const profile = (await tx.get(getDatabase().collection(COLLECTIONS.users).doc(user.uid))).data();
    if (!claim || !profile || profile.isActive === false) return null;
    const asAdmin = admin && profile.role === 'admin';
    const asCandidate = claim.candidateUID === user.uid && matches(claim, await connectionIdentity(user));
    let asOwner = false;
    if (claim.ownerUID === user.uid) {
      const property = (await tx.get(getDatabase().collection(COLLECTIONS.properties).doc(s(claim.propertyId)))).data();
      asOwner = property?.ownerUID === user.uid;
    }
    if (!asAdmin && !asCandidate && !asOwner) return null;
    if (currentConnectionState(claim) !== claim.status) {
      const patch = statePatch(claim); tx.update(ref, patch); return {...claim, ...patch};
    }
    return claim;
  });
}

export function validContact(value: unknown): string {
  const number = indianMobile(value);
  if (!number) throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number or +91 mobile number');
  return number;
}

/** A profile phone field is deliberately never consulted here. */
export async function verifiedMobile(user: AuthenticatedUser): Promise<string | null> {
  const tokenPhone = indianMobile(user.token.phone_number);
  if (!tokenPhone) return null;
  const account = await getFirebaseAdminAuth().getUser(user.uid);
  if (account.disabled || !account.emailVerified || indianMobile(account.phoneNumber) !== tokenPhone) return null;
  return tokenPhone;
}

async function recipientFor(phone: string): Promise<string> {
  try {
    const account = await getFirebaseAdminAuth().getUserByPhoneNumber(phone);
    if (account.disabled || !account.emailVerified || indianMobile(account.phoneNumber) !== phone) return '';
    const profile = await getDatabase().collection(COLLECTIONS.users).doc(account.uid).get();
    return profile.exists && profile.data()?.isActive !== false ? account.uid : '';
  } catch (error) {
    if ((error as {code?: string}).code === 'auth/user-not-found') return '';
    console.error('Relationship recipient pre-discovery unavailable; claim remains unbound');
    return '';
  }
}

export async function prepareLink(kind: 'owner' | 'tenant', propertyId: string, phone: string, actorUID: string, ownerUID: string, tenantId = '', recipientEmail?: unknown) {
  const contactE164 = validContact(phone), email = normalizeEmailAddress(recipientEmail);
  let candidateUID = '';
  if (email) {
    try {
      const account = await getFirebaseAdminAuth().getUserByEmail(email);
      if (!account.disabled && account.emailVerified && normalizeEmailAddress(account.email) === email) {
        const profile = await getDatabase().collection(COLLECTIONS.users).doc(account.uid).get();
        if (profile.exists && profile.data()?.isActive !== false) candidateUID = account.uid;
      }
    } catch (error) {
      if ((error as {code?: string}).code !== 'auth/user-not-found') console.error('Relationship recipient pre-discovery unavailable; claim remains unbound');
      // This optional lookup only pre-binds a candidate. Self-scoped discovery
      // and every confirmation still require current verified Firebase identity.
    }
  } else candidateUID = await recipientFor(contactE164);
  return {
    id: linkID(kind, propertyId, tenantId, contactE164, email || ''), propertyId, relationship: kind, tenantId,
    ...(email ? {recipientEmailNormalized: email, identityMethod: 'email'} : {}),
    contactE164, candidateUID, status: 'verification_required', ownerUID,
    authorizedByUID: kind === 'tenant' && actorUID === ownerUID ? actorUID : '',
    authorizedCandidateUID: kind === 'tenant' && actorUID === ownerUID ? candidateUID : '',
    createdByUID: actorUID, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + CONNECTION_TTL_MS), version: 0,
  };
}

/** Read before other transaction writes. The returned writer cannot overwrite a claim. */
export async function stageLinks(tx: Transaction, candidates: RecordData[], intents: InvitationIntent[] = []) {
  const fresh: RecordData[] = [];
  for (const claim of candidates) {
    if (!(await tx.get(links().doc(s(claim.id)))).exists) fresh.push(claim);
  }
  const mail = await stageInvitationEmails(tx, fresh, intents);
  return Object.assign(() => { for (const claim of fresh) tx.create(links().doc(s(claim.id)), claim); mail.write(); }, {events: mail.events});
}

export async function throttleRelationshipAction(uid: string, action: string, limit: number) {
  const minute = Math.floor(Date.now() / 60000);
  const ref = getDatabase().collection('relationship_link_limits').doc(hash(`${uid}:${action}:${minute}`));
  await getDatabase().runTransaction(async tx => {
    const current = await tx.get(ref), count = Number(current.data()?.count || 0);
    if (count >= limit) throw new ApiError(429, 'Too many relationship requests. Please wait a minute.');
    tx.set(ref, {count: count + 1, expiresAt: new Date((minute + 2) * 60000)});
  });
}

function eligible(claim: RecordData, property: RecordData, tenant?: RecordData): boolean {
  if (property.isActive === false || property.status === 'inactive') return false;
  if (claim.relationship === 'owner') return property.createdAs === 'tenant' && !property.ownerUID &&
    ['pending', 'rejected'].includes(s(property.ownershipVerification)) &&
    (claim.recipientEmailNormalized
      ? normalizeEmailAddress(isRecord(property.reportedOwner) ? property.reportedOwner.email : '') === claim.recipientEmailNormalized
      : indianMobile(isRecord(property.reportedOwner) ? property.reportedOwner.phone : '') === claim.contactE164);
  return !!property.ownerUID && property.ownerUID === claim.ownerUID && !!tenant && tenant.isActive === true &&
    tenant.linkConfirmationRequired === true && !tenant.userUID && (claim.recipientEmailNormalized
      ? normalizeEmailAddress(tenant.email) === claim.recipientEmailNormalized : indianMobile(tenant.phone) === claim.contactE164);
}

/** Self-scoped discovery. A match identifies a candidate, never grants property access. */
export async function discoverFor(user: AuthenticatedUser) {
  const identity = await connectionIdentity(user);
  if (!identity.email && !identity.phone) return {verified: false, discovered: 0, truncated: false};
  const pages = await Promise.all([
    ...(identity.email ? [links().where('recipientEmailNormalized', '==', identity.email).where('status', '==', 'verification_required').limit(101).get()] : []),
    ...(identity.phone ? [links().where('contactE164', '==', identity.phone).where('status', '==', 'verification_required').limit(101).get()] : []),
  ]);
  // Compatibility for invitations persisted before recipient email was stored on
  // claims. Only this user's verified address is queried; no global migration or mail.
  const legacyMail = identity.email ? await getDatabase().collection(COLLECTIONS.emailDeliveries || 'email_deliveries').where('recipientEmail', '==', identity.email).limit(101).get() : null;
  const candidates = new Map<string, {ref: DocumentReference; mail?: RecordData}>();
  for (const page of pages) for (const doc of page.docs) candidates.set(doc.id, {ref: doc.ref});
  for (const mail of legacyMail?.docs || []) {
    const value = mail.data();
    if (['relationship.owner_invitation', 'relationship.tenant_invitation'].includes(s(value.eventType)) && /^[a-f0-9]{64}$/.test(s(value.invitationClaimId))) {
      const id = s(value.invitationClaimId);
      if (!candidates.has(id)) candidates.set(id, {ref: links().doc(id), mail: value});
    }
  }
  let discovered = 0;
  for (const {ref, mail} of [...candidates.values()].slice(0, 100)) {
    const updated = await getDatabase().runTransaction(async tx => {
      const snapshot = await tx.get(ref), stored = snapshot.data();
      if (!stored || stored.candidateUID && stored.candidateUID !== user.uid || stored.createdByUID === user.uid || stored.ownerUID === user.uid) return false;
      const current = await connectionIdentity(user);
      const profile = (await tx.get(getDatabase().collection(COLLECTIONS.users).doc(user.uid))).data();
      if (!profile || profile.isActive === false) return false;
      const adoptEmail = !stored.recipientEmailNormalized && mail && mail.propertyId === stored.propertyId && mail.eventType === `relationship.${s(stored.relationship)}_invitation` && normalizeEmailAddress(mail.recipientEmail) === current.email;
      const claim = adoptEmail ? {...stored, recipientEmailNormalized: current.email, identityMethod: 'email'} : stored;
      if (!matches(claim, current)) return false;
      if (currentConnectionState(claim) === 'expired') {tx.update(ref, statePatch(claim)); return false;}
      if (terminal(claim) || !adoptEmail && claim.status !== 'verification_required') return false;
      const property = (await tx.get(getDatabase().collection(COLLECTIONS.properties).doc(s(claim.propertyId)))).data();
      const tenant = claim.tenantId ? (await tx.get(getDatabase().collection(COLLECTIONS.tenants).doc(s(claim.tenantId)))).data() : undefined;
      if (!property || !eligible(claim, property, tenant)) return false;
      const now = new Date();
      tx.update(ref, {candidateUID: user.uid, status: claim.status === 'verification_required' ? claim.relationship === 'tenant' ? 'pending_tenant_acceptance' : 'pending_owner_authorization' : currentConnectionState(claim),
        ...(adoptEmail ? {recipientEmailNormalized: current.email, identityMethod: 'email', identityUpgradedAt: now} : {}),
        ...(claim.recipientEmailNormalized ? {emailVerifiedAt: now} : {phoneVerifiedAt: now}),
        version: Number(claim.version || 0) + 1, updatedAt: now});
      return true;
    });
    if (updated) discovered++;
  }
  return {verified: true, discovered, truncated: candidates.size > 100 || pages.some(page => page.docs.length > 100) || (legacyMail?.docs.length || 0) > 100};
}

function safeClaim(id: string, claim: RecordData) {
  const expires = connectionExpiry(claim);
  return {id, reference: id.slice(0, 8), relationship: claim.relationship,
    status: currentConnectionState(claim), version: Number(claim.version || 0),
    ...(Number.isFinite(expires) ? {expiresAt: new Date(expires).toISOString()} : {}),
    ...(claim.status === 'linked' ? {propertyId: claim.propertyId} : {})};
}

export async function listRelationshipLinks(request: Request) {
  const user = await requireUser(request);
  await throttleRelationshipAction(user.uid, 'read', 30);
  const identity = await connectionIdentity(user);
  const propertyId = new URL(request.url).searchParams.get('propertyId');
  if (propertyId) {
    if (user.role !== 'admin') throw new AccessError(403, 'Administrator access required');
    const rows = await links().where('propertyId', '==', propertyId).limit(100).get();
    const result = [];
    for (const doc of rows.docs) {
      const claim = await refreshState(doc.ref, user, identity, true, doc.data());
      if (claim) result.push({...safeClaim(doc.id, claim), candidateUID: claim.candidateUID || ''});
    }
    return jsonResponse({success: true, links: result});
  }
  // Read legacy states without a startup migration; actual transitions persist
  // only canonical states. History cannot crowd pending rows out of the query.
  const states = [...CONNECTION_STATES, 'awaiting_owner_request', 'awaiting_owner_approval', 'awaiting_confirmation', 'awaiting_admin_verification'];
  const [candidatePages, invitationPages] = await Promise.all([
    Promise.all(states.map(status => links().where('candidateUID', '==', user.uid).where('status', '==', status).limit(100).get())),
    Promise.all(states.map(status => links().where('ownerUID', '==', user.uid).where('status', '==', status).limit(100).get())),
  ]);
  const claims = [], approvals = [], sentInvitations = [], connections = [];
  const seen = new Set<string>();
  for (const doc of candidatePages.flatMap(page => page.docs)) {
    if (seen.has(doc.id)) continue;
    const claim = await refreshState(doc.ref, user, identity, false, doc.data());
    if (!claim || claim.candidateUID !== user.uid || !matches(claim, identity) || claim.createdByUID === user.uid) continue;
    const row = {...safeClaim(doc.id, claim), viewer: 'candidate' as const};
    seen.add(doc.id); claims.push(row); connections.push(row);
  }
  for (const doc of invitationPages.flatMap(page => page.docs)) {
    if (seen.has(doc.id)) continue;
    const claim = await refreshState(doc.ref, user, identity, false, doc.data());
    if (!claim || claim.ownerUID !== user.uid || claim.relationship !== 'tenant') continue;
    const property = (await getDatabase().collection(COLLECTIONS.properties).doc(s(claim.propertyId)).get()).data();
    if (!property || property.ownerUID !== user.uid) continue;
    const state = currentConnectionState(claim);
    // The owner already has property authorization. No candidate UID, email,
    // name or contact is disclosed while this connection awaits approval.
    const row = {...safeClaim(doc.id, claim), propertyId: claim.propertyId,
      propertyLabel: [s(property.title), s(property.unitNumber)].filter(Boolean).join(' / '), viewer: 'owner' as const,
      canAuthorizeInvitation: !terminal(claim) && (claim.authorizedByUID !== user.uid || (claim.invitationAuthorizedByUID || claim.createdByUID) !== user.uid)};
    seen.add(doc.id); connections.push(row);
    if (state === 'pending_owner_authorization') approvals.push(row);
    else if (!terminal(claim)) sentInvitations.push(row);
  }
  return jsonResponse({success: true, emailVerified: !!identity.email, phoneVerified: !!identity.phone, phoneVerificationAvailable: false,
    connections, links: claims, approvals, sentInvitations,
    truncated: [...candidatePages, ...invitationPages].some(page => page.docs.length >= 100)});
}

export async function actOnRelationshipLink(request: Request) {
  const user = await requireUser(request);
  let body: RecordData;
  try {body = await readObject(request, 4096);} catch {throw new ApiError(400, 'Invalid relationship request');}
  const action = s(body.action);
  if (Object.keys(body).some(key => !['action', 'claimId', 'expectedVersion'].includes(key))) throw new ApiError(400, 'Relationship discovery and claims are scoped to your authenticated identity');
  if (!['discover', 'request_owner_verification', 'confirm_tenancy', 'approve_tenancy', 'authorize_tenancy_invitation', 'reject'].includes(action)) throw new ApiError(400, 'Invalid relationship action');
  await throttleRelationshipAction(user.uid, action === 'discover' ? 'discover' : 'claim', action === 'discover' ? 20 : 10);
  if (action === 'discover') return jsonResponse({success: true, ...await discoverFor(user)});
  if (!/^[a-f0-9]{64}$/.test(s(body.claimId))) throw new ApiError(400, 'Invalid relationship reference');
  if (body.expectedVersion !== undefined && (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0)) throw new ApiError(400, 'Invalid connection version');
  const ownerAction = action === 'approve_tenancy' || action === 'authorize_tenancy_invitation';
  const identity = await connectionIdentity(user);
  if (!ownerAction && action !== 'reject' && !identity.email && !identity.phone) throw new ApiError(403, 'Verify your Firebase account email before claiming a relationship');
  const authenticatedAt = Number(user.token.auth_time || 0);
  if (!authenticatedAt || Date.now() / 1000 - authenticatedAt > 300 || authenticatedAt > Date.now() / 1000 + 60) throw new AccessError(403, 'Sign in again before confirming a relationship');
  let linked: RecordData | null = null, expired = false, outcome = '', invitationEvents: TransactionalEmailEvent[] = [];
  await getDatabase().runTransaction(async tx => {
    linked = null; expired = false; outcome = ''; invitationEvents = [];
    const ref = links().doc(s(body.claimId)), snapshot = await tx.get(ref), claim = snapshot.data();
    if (!claim) throw new ApiError(404, 'Relationship request unavailable');
    const propertyRef = getDatabase().collection(COLLECTIONS.properties).doc(s(claim.propertyId)), property = (await tx.get(propertyRef)).data();
    const profile = (await tx.get(getDatabase().collection(COLLECTIONS.users).doc(user.uid))).data();
    if (!profile || profile.isActive === false || !property) throw new AccessError(403, 'Relationship request unavailable');
    const asOwner = claim.relationship === 'tenant' && claim.ownerUID === user.uid && property.ownerUID === user.uid;
    const asCandidate = claim.candidateUID === user.uid && matches(claim, await connectionIdentity(user)) && claim.createdByUID !== user.uid;
    if (ownerAction ? !asOwner : action === 'reject' ? !asOwner && !asCandidate : !asCandidate) throw new AccessError(403, 'Relationship request unavailable');
    const state = currentConnectionState(claim);
    if (state === 'linked') {
      if (action === 'confirm_tenancy' || action === 'approve_tenancy') {outcome = 'linked'; return;}
      throw new ApiError(409, 'This connection is already linked');
    }
    if (state === 'expired') {
      if (claim.status !== 'expired') tx.update(ref, statePatch(claim));
      expired = true; return;
    }
    if (state === 'rejected') throw new ApiError(409, 'This relationship request was rejected');
    if (body.expectedVersion !== undefined && body.expectedVersion !== Number(claim.version || 0)) throw new ApiError(409, 'Connection changed; refresh and review it again');
    const version = Number(claim.version || 0) + 1;
    if (action === 'reject') {tx.update(ref, {status: 'rejected', version, rejectedByUID: user.uid, rejectedAt: new Date(), updatedAt: new Date()}); return;}
    const tenantRef = claim.tenantId ? getDatabase().collection(COLLECTIONS.tenants).doc(s(claim.tenantId)) : null;
    const tenant = tenantRef ? (await tx.get(tenantRef)).data() : undefined;
    if (!eligible(claim, property, tenant) || (!asOwner && claim.createdByUID === user.uid) || claim.ownerUID === claim.candidateUID) throw new ApiError(409, 'Relationship changed; contact support');
    if (action === 'authorize_tenancy_invitation') {
      const email = normalizeEmailAddress(tenant?.email);
      if (!email || !tenant || tenant.propertyId !== claim.propertyId || tenant.ownerUID !== user.uid) throw new ApiError(409, 'A valid current tenant email is required');
      if (claim.authorizedByUID === user.uid && (claim.invitationAuthorizedByUID || claim.createdByUID) === user.uid) {outcome = state; return;}
      const now = new Date(), authorized = {...claim, authorizedByUID: user.uid, invitationAuthorizedByUID: user.uid, invitationAuthorizedAt: now,
        authorizedCandidateUID: claim.candidateUID || '', recipientEmailNormalized: email, identityMethod: 'email', version, updatedAt: now};
      const mail = await stageInvitationEmails(tx, [authorized], [{claimId: s(claim.id), email}]);
      invitationEvents = mail.events;
      mail.write(); tx.update(ref, authorized); outcome = state; return;
    }
    if (action === 'request_owner_verification') {
      if (claim.relationship !== 'owner' || property.ownershipVerification !== 'pending') throw new ApiError(409, 'Ownership is not awaiting verification');
      if (state === 'pending_admin_verification') return;
      tx.update(ref, {status: 'pending_admin_verification', version, requestedByUID: user.uid, ...(claim.recipientEmailNormalized ? {emailVerifiedAt: new Date()} : {phoneVerifiedAt: new Date()}), requestedAt: new Date(), updatedAt: new Date()});
      return;
    }
    if (claim.relationship !== 'tenant' || !tenant || !tenantRef) throw new ApiError(409, 'Tenancy invitation required');
    const ownerAuthorized = ownerAction || claim.authorizedByUID === property.ownerUID && claim.authorizedCandidateUID === user.uid;
    if (ownerAction && (property.ownerUID !== user.uid || state !== 'pending_owner_authorization' || !claim.confirmedByUID)) throw new AccessError(403, 'Owner approval is not available');
    if (!ownerAction && action !== 'confirm_tenancy') throw new ApiError(400, 'Invalid tenancy action');
    const targetUID = s(ownerAction ? claim.confirmedByUID : user.uid);
    // Recheck current Firebase identity when the owner approves later.
    const account = await getFirebaseAdminAuth().getUser(targetUID);
    const targetProfile = (await tx.get(getDatabase().collection(COLLECTIONS.users).doc(targetUID))).data();
    if (!connectionAccountMatches(claim, account) || !targetProfile || targetProfile.isActive === false) throw new ApiError(409, 'The invited identity changed; a new verification is required');
    if (!ownerAuthorized) {
      outcome = 'pending_owner_authorization';
      tx.update(ref, {status: 'pending_owner_authorization', version, confirmedByUID: user.uid, confirmedAt: new Date(), updatedAt: new Date()});
      return;
    }
    const embedded = entries(property.tenants), row = embedded.find(t => t.id === claim.tenantId);
    if (!row || row.isActive !== true || row.userUID || row.linkConfirmationRequired !== true || (claim.recipientEmailNormalized ? normalizeEmailAddress(row.email) !== claim.recipientEmailNormalized : indianMobile(row.phone) !== claim.contactE164) || tenant.propertyId !== claim.propertyId || tenant.ownerUID !== property.ownerUID) throw new ApiError(409, 'Tenancy changed; refresh before confirming');
    if (embedded.some(t => t.isActive === true && t.userUID === targetUID)) throw new ApiError(409, 'This account already has an active tenancy here');
    const now = new Date(), updates = {userUID: targetUID, linkConfirmationRequired: false, linkedAt: now, linkedByUID: user.uid};
    tx.update(tenantRef, {...updates, updatedAt: now});
    tx.update(propertyRef, {tenants: embedded.map(t => t.id === claim.tenantId ? {...t, ...updates} : t), tenancyRevision: Number(property.tenancyRevision || 0) + 1, updatedAt: now});
    tx.update(ref, {status: 'linked', version, confirmedByUID: targetUID, confirmedAt: claim.confirmedAt || now, authorizedByUID: property.ownerUID, authorizedCandidateUID: targetUID, ownerApprovedAt: ownerAction ? now : claim.createdAt, linkedAt: now, updatedAt: now});
    linked = {...claim, candidateUID: targetUID};
    outcome = 'linked';
  });
  if (expired) throw new ApiError(409, 'This connection has expired. Ask for a new invitation through the existing property workflow.');
  if (invitationEvents.length) dispatchEmailOutbox(invitationEvents);
  if (linked) {
    const claim = linked as RecordData;
    await bestEffort(() => persistUserEvent({eventType: 'relationship.tenant_linked', eventId: `${s(claim.id)}:linked`, recipients: [{uid: s(claim.candidateUID), role: 'tenant'}, {uid: s(claim.ownerUID), role: 'owner'}], propertyId: s(claim.propertyId), recordId: s(claim.tenantId), templateId: 'tenant-linked', subject: 'Tenancy confirmed', title: 'Tenancy confirmed', bodyHtml: '<p>Your tenancy relationship has been confirmed.</p>', bodyText: 'Your tenancy relationship has been confirmed.', action: {label: 'View property', path: `/manage-property/${s(claim.propertyId)}`}}));
  }
  return jsonResponse({success: true, status: outcome || undefined, message: 'Relationship request updated'});
}
