import {publicListing,listingApproved} from '../../listing-policy';
import 'server-only';

import type { DocumentData, UpdateData } from 'firebase-admin/firestore';

import { getDatabase, COLLECTIONS } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { AccessError, type AuthenticatedUser } from '../auth';
import { requireAdmin } from '../permissions';
import { identity, readObject } from './domain-contracts';
import { getProperty } from './properties';
import { parsePrice, stringValue } from './contracts';
import {
  escapeHtml,
  bestEffort,
} from './property-effects';
import { createNotification } from './notifications';
import { persistUserEvent } from './transactional-email';
import type {
  Negotiation,
  NegotiationAction,
} from '../../negotiation';

const collection = () =>
  getDatabase().collection(COLLECTIONS.negotiations);

function amount(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1e10 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.0001
  ) {
    throw new ApiError(
      400,
      'Amount must be positive with at most two decimal places'
    );
  }

  return value;
}

function canRead(
  user: AuthenticatedUser,
  n: Negotiation
) {
  return (
    user.role === 'admin' ||
    [n.ownerUID, n.customerUID, n.brokerUID].includes(user.uid)
  );
}

async function notify(n: Negotiation) {
  await bestEffort(() =>
    createNotification({
      type: 'negotiation_update',
      title: 'Negotiation Update',
      message: `${n.propertyTitle}: ${n.status}`,
      propertyId: n.propertyId,
      ownerId: n.ownerUID,
      userId: n.customerUID,
      relatedId: n.id,
    })
  );

  await bestEffort(()=>persistUserEvent({eventType:`negotiation.${n.status}`,eventId:`${n.id}:${n.version||0}:${n.status}`,recipients:Array.from(new Set([n.ownerUID,n.customerUID,n.brokerUID].filter(Boolean))).map(uid=>({uid,role:uid===n.ownerUID?'owner':uid===n.customerUID?'customer':'broker'})),propertyId:n.propertyId,recordId:n.id,templateId:'negotiation-activity',subject:`Negotiation update: ${n.propertyTitle}`,title:'Negotiation updated',bodyHtml:`<p><strong>${escapeHtml(n.propertyTitle)}</strong>: ${escapeHtml(n.status.replaceAll('_',' '))}</p><p>Open the property to review the offer and its history.</p>`,bodyText:`${n.propertyTitle}: ${n.status.replaceAll('_',' ')}. Open the property to review the offer and its history.`,action:{label:'Review negotiation',path:`/manage-property/${n.propertyId}`}}));
}

export async function createNegotiation(
  request: Request
) {
  const user = await identity(request);

  let body;

  try {
    body = await readObject(request, 8192);
  } catch {
    throw new ApiError(400, 'Invalid request body');
  }

  const propertyId = stringValue(body.propertyId);

  if (!propertyId || propertyId.includes('/')) {
    throw new ApiError(400, 'Property ID required');
  }

  const offer = amount(body.amount);

  const property = await getProperty(propertyId);

  if (
    !property || !publicListing(property) ||
    !['rent', 'sell'].includes(
      stringValue(property.listingType)
    ) ||
    property.isActive !== true ||
    property.status === 'inactive' ||
    property.isSold ||
    property.isRented ||
    property.rentalStatus === 'rented'
  ) {
    throw new ApiError(
      404,
      'Available property not found'
    );
  }

  if (property.ownerUID === user.uid) {
    throw new ApiError(
      400,
      'You cannot submit an offer on your own property'
    );
  }

  const asking = amount(
    parsePrice(
      property.listingType === 'rent'
        ? property.monthlyRent
        : property.sellingPrice
    ) || property.price
  );

  const ref = collection().doc();
  const now = new Date().toISOString();

  const n: Negotiation = {
    id: ref.id,
    propertyId,
    propertyTitle: stringValue(property.title),
    ownerUID: stringValue(property.ownerUID),
    customerUID: user.uid,
    brokerUID: stringValue(property.submittingAgentUID||property.submittedByUID),
    originalAskingPrice: asking,
    customerOffer: offer,
    brokerProposedAmount: null,
    ownerCounterAmount: null,
    ownerApprovedAmount: null,
    finalAgreedAmount: null,
    status: 'offered',
    version: 1,
    history: [
      {
        action: 'offer',
        actorUID: user.uid,
        amount: offer,
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  await ref.create(n);
  await notify(n);

  return jsonResponse(
    {
      success: true,
      negotiation: n,
    },
    201
  );
}

export async function listNegotiations(
  request: Request
) {
  const user = await identity(request);
  const params = new URL(request.url).searchParams;

  const propertyId = params.get('propertyId');

  if (propertyId?.includes('/')) {
    throw new ApiError(
      400,
      'Invalid property ID'
    );
  }

  const base = propertyId
    ? collection().where(
        'propertyId',
        '==',
        propertyId
      )
    : collection();

  const snapshots =
    user.role === 'admin'
      ? [await base.limit(100).get()]
      : await Promise.all(
          [
            'ownerUID',
            'customerUID',
            'brokerUID',
          ].map((field) =>
            base
              .where(field, '==', user.uid)
              .limit(100)
              .get()
          )
        );

  const rows = new Map<
    string,
    Negotiation
  >();

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      const n =
        doc.data() as Negotiation;

      if (canRead(user, n)) {
        rows.set(doc.id, n);
      }
    }
  }

  const negotiations = [
    ...rows.values(),
  ].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );

  return jsonResponse({
    success: true,
    negotiations,
    limited: negotiations.length >= 100,
  });
}

export async function updateNegotiation(
  request: Request,
  id: string
) {
  const user = await identity(request);

  let body;

  try {
    body = await readObject(request, 8192);
  } catch {
    throw new ApiError(
      400,
      'Invalid request body'
    );
  }

  const action = stringValue(
    body.action
  ) as NegotiationAction;

  if (!Number.isInteger(body.version)) {
    throw new ApiError(
      400,
      'Current version is required'
    );
  }

  const ref = collection().doc(id);

  const result =
    await getDatabase().runTransaction(
      async (tx) => {
        const snapshot =
          await tx.get(ref);

        if (!snapshot.exists) {
          throw new ApiError(
            404,
            'Negotiation not found'
          );
        }

        const before =
          snapshot.data() as Negotiation;

        if (!canRead(user, before)) {
          throw new AccessError(
            403,
            'Negotiation access required'
          );
        }

        const propertyRef = getDatabase()
          .collection(COLLECTIONS.properties)
          .doc(before.propertyId);

        const property =
          await tx.get(propertyRef);

        if (
          !property.exists ||
          property.data()?.ownerUID !==
            before.ownerUID
        ) {
          throw new ApiError(
            409,
            'Property ownership changed'
          );
        }

        if (
          !listingApproved(property.data()||{}) ||
          property.data()?.isActive !== true ||
          property.data()?.status ===
            'inactive' ||
          property.data()?.isSold ||
          property.data()?.isRented ||
          property.data()?.rentalStatus ===
            'rented'
        ) {
          throw new ApiError(
            409,
            'Property is no longer available'
          );
        }

        if (
          before.version !== body.version
        ) {
          throw new ApiError(
            409,
            'Negotiation changed; reload before continuing'
          );
        }

        if (
          [
            'rejected',
            'withdrawn',
            'completed',
          ].includes(before.status)
        ) {
          throw new ApiError(
            409,
            'Negotiation is closed'
          );
        }

        if (before.history.length >= 100) {
          throw new ApiError(
            409,
            'Negotiation history limit reached'
          );
        }

        const n: Negotiation = {
          ...before,
        };

        let nextAmount: number | null =
          null;

        const owner =
          before.ownerUID === user.uid;

        const customer =
          before.customerUID === user.uid;

        const broker =
          user.role === 'admin' ||
          (user.role === 'agent' &&
            before.brokerUID === user.uid);

        const pending = [
          'offered',
          'proposed',
          'countered',
        ].includes(before.status);

        switch (action) {
          case 'assign_broker': {
            requireAdmin(user);

            if (!pending) {
              throw new ApiError(
                409,
                'Cannot assign a closed proposal'
              );
            }

            const brokerUID =
              stringValue(body.brokerUID);

            if (
              !brokerUID ||
              brokerUID.includes('/')
            ) {
              throw new ApiError(
                400,
                'Broker UID required'
              );
            }

            const profile =
              await tx.get(
                getDatabase()
                  .collection(
                    COLLECTIONS.users
                  )
                  .doc(brokerUID)
              );

            if (
              !profile.exists ||
              profile.data()?.role !==
                'agent' ||
              profile.data()?.isActive ===
                false
            ) {
              throw new ApiError(
                400,
                'Active agent required'
              );
            }

            n.brokerUID = brokerUID;
            break;
          }

          case 'propose':
            if (!broker) {
              throw new AccessError(
                403,
                'Assigned broker or administrator access required'
              );
            }

            if (!pending) {
              throw new ApiError(
                409,
                'Proposal cannot be changed after approval'
              );
            }

            nextAmount = amount(
              body.amount
            );

            n.brokerProposedAmount =
              nextAmount;
            n.ownerApprovedAmount = null;
            n.ownerCounterAmount = null;
            n.finalAgreedAmount = null;
            n.status = 'proposed';

            break;

          case 'counter':
            if (!owner) {
              throw new AccessError(
                403,
                'Only the property owner can counter'
              );
            }

            if (!pending) {
              throw new ApiError(
                409,
                'Proposal cannot be countered now'
              );
            }

            nextAmount = amount(
              body.amount
            );

            n.ownerCounterAmount =
              nextAmount;
            n.ownerApprovedAmount =
              nextAmount;
            n.status = 'countered';

            break;

          case 'accept':
            if (!owner) {
              throw new AccessError(
                403,
                'Only the property owner can approve'
              );
            }

            if (
              ![
                'offered',
                'proposed',
              ].includes(before.status)
            ) {
              throw new ApiError(
                409,
                'No proposal awaiting owner approval'
              );
            }

            nextAmount =
              before.brokerProposedAmount ??
              before.customerOffer;

            n.ownerApprovedAmount =
              nextAmount;

            // Approval always returns to the customer for explicit confirmation,
            // including when the approved amount matches their original offer.
            n.status = 'owner_approved';
            n.finalAgreedAmount = null;

            break;

          case 'customer_accept':
            if (!customer) {
              throw new AccessError(
                403,
                'Only the customer can accept this amount'
              );
            }

            if (
              ![
                'countered',
                'owner_approved',
              ].includes(before.status) ||
              !before.ownerApprovedAmount
            ) {
              throw new ApiError(
                409,
                'Owner approval is required'
              );
            }

            nextAmount =
              before.ownerApprovedAmount;

            n.finalAgreedAmount =
              nextAmount;
            n.status = 'accepted';

            break;

          case 'reject':
            if (!owner) {
              throw new AccessError(
                403,
                'Only the property owner can reject'
              );
            }

            if (
              !pending &&
              before.status !==
                'owner_approved'
            ) {
              throw new ApiError(
                409,
                'Cannot reject a confirmed agreement'
              );
            }

            n.status = 'rejected';
            n.ownerApprovedAmount = null;

            break;

          case 'withdraw':
            if (!customer) {
              throw new AccessError(
                403,
                'Only the customer can withdraw'
              );
            }

            if (
              before.status ===
              'accepted'
            ) {
              throw new ApiError(
                409,
                'Cannot withdraw a confirmed agreement'
              );
            }

            n.status = 'withdrawn';

            break;

          case 'complete':
            requireAdmin(user);

            if (
              before.status !==
                'accepted' ||
              !before.ownerApprovedAmount ||
              before.finalAgreedAmount !==
                before.ownerApprovedAmount
            ) {
              throw new ApiError(
                409,
                'Owner and customer acceptance required'
              );
            }

            n.status = 'completed';

            break;

          default:
            throw new ApiError(
              400,
              'Unsupported negotiation action'
            );
        }

        n.version++;
        n.updatedAt =
          new Date().toISOString();

        n.history = [
          ...before.history,
          {
            action,
            actorUID: user.uid,
            amount: nextAmount,
            at: n.updatedAt,
          },
        ];

        // firebase-admin v13's UpdateData<DocumentData> typing
        // requires dotted-field support. Negotiation is a complete
        // object and is intentionally being used as update data here.
        const updateData =
          n as unknown as UpdateData<DocumentData>;

        tx.update(ref, updateData);

        return n;
      }
    );

  await notify(result);

  return jsonResponse({
    success: true,
    negotiation: result,
  });
}
