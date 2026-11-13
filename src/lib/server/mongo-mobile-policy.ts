import type { IndexDescription } from 'mongodb';

export const MONGO_MOBILE_VERSION = 1;
export const MONGO_MOBILE_POLICY = 'firebase-mobile-claims-v1';
export const MONGO_MOBILE_CONFLICT = 'Number already registered. Use a different number.';
// Declarative only: no request or module import creates an index.
export const MOBILE_CLAIM_INDEXES: IndexDescription[] = [
  { name: 'mobile_unique', key: { normalizedNumber: 1 }, unique: true },
  { name: 'owned_uid_unique', key: { firebaseUID: 1 }, unique: true, partialFilterExpression: { status: 'owned' } },
  { name: 'reserved_uid_unique', key: { firebaseUID: 1 }, unique: true, partialFilterExpression: { status: 'reserved' } },
  { name: 'operation_unique', key: { idempotencyId: 1 }, unique: true },
];
export const MOBILE_CLAIM_VALIDATOR = {$jsonSchema:{
  bsonType:'object', required:['_id','normalizedNumber','status','idempotencyId','createdAt','updatedAt'],
  properties:{
    _id:{bsonType:'string'}, normalizedNumber:{bsonType:'string',pattern:'^\\+91[6-9][0-9]{9}$'},
    status:{enum:['reserved','owned','blocked']}, idempotencyId:{bsonType:'string'},
    firebaseUID:{bsonType:'string',minLength:1}, createdAt:{bsonType:'date'},updatedAt:{bsonType:'date'},
  },
  oneOf:[
    {properties:{status:{enum:['reserved','owned']}},required:['firebaseUID']},
    {properties:{status:{enum:['blocked']},memberCount:{bsonType:['int','long','double'],minimum:2},membersFingerprint:{bsonType:'string',pattern:'^[a-f0-9]{64}$'}},required:['memberCount','membersFingerprint'],not:{required:['firebaseUID']}},
  ],
}};
export type MobileClaim = {
  _id: string; normalizedNumber: string; firebaseUID?: string;
  status: 'reserved' | 'owned' | 'blocked'; idempotencyId: string;
  createdAt: Date; updatedAt: Date; memberCount?: number; membersFingerprint?: string;
};
export type PendingMobile = { id: string; phone: string; previousPhone: string | null };
export type MobileAccount = {
  _id: string; state: 'owned' | 'conflicted' | 'missing' | 'invalid';
  phone: string | null; pending?: PendingMobile; lastOperation?: string;
  createdAt: Date; updatedAt: Date;
};
