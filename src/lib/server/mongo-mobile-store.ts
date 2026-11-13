import 'server-only';
import { createHash } from 'node:crypto';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import { getMobileMongo } from './mongodb';
import { ApiError } from './http';
import { MOBILE_CLAIM_INDEXES, MONGO_MOBILE_CONFLICT, MONGO_MOBILE_POLICY, MONGO_MOBILE_VERSION, type MobileAccount, type MobileClaim, type PendingMobile } from './mongo-mobile-policy';

const unavailable = () => new ApiError(503, 'Mobile registration is not activated or requires reconciliation. Retry later.', 'MONGO_MOBILE_NOT_READY');
const conflict = () => new ApiError(409, MONGO_MOBILE_CONFLICT, 'MOBILE_ALREADY_REGISTERED');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class MongoMobileStore {
  constructor(private client: MongoClient, private db: Db) {}
  private claims() { return this.db.collection<MobileClaim>('mobile_claims'); }
  private accounts() { return this.db.collection<MobileAccount>('mobile_accounts'); }
  private async ready(session?: ClientSession) {
    const control = await this.db.collection<{_id: string; status: string; version: number; policy: string; verifiedImport: boolean; writerIsolationVerified: boolean; fingerprint: string}>('mobile_claims_control').findOne({_id:'main'}, {session});
    if (control?.status !== 'active' || control.version !== MONGO_MOBILE_VERSION || control.policy !== MONGO_MOBILE_POLICY || control.verifiedImport !== true || control.writerIsolationVerified !== true || !/^[a-f0-9]{64}$/.test(control.fingerprint)) throw unavailable();
  }
  async checkReady() {
    await this.ready();
    const indexes = await this.claims().listIndexes().toArray();
    for (const required of MOBILE_CLAIM_INDEXES) {
      if (!indexes.some(index => index.name === required.name && index.unique === true && JSON.stringify(index.key) === JSON.stringify(required.key) && JSON.stringify(index.partialFilterExpression) === JSON.stringify(required.partialFilterExpression))) throw unavailable();
    }
    // Require explicit provisioning of the per-UID lock collection too. A
    // request must never implicitly create it on its first reservation.
    if (!(await this.accounts().listIndexes().toArray()).some(index => index.name === '_id_')) throw unavailable();
  }
  private async transaction<T>(fn: (session: ClientSession) => Promise<T>) {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => { await this.ready(session); return fn(session); }, {readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary'});
    } finally { await session.endSession(); }
  }
  async available(phone: string) {
    await this.checkReady();
    if (await this.claims().findOne({normalizedNumber:phone})) throw conflict();
  }
  async reconcile(uid: string, marker: string, phone: string | null, beforeConfirm: () => Promise<void>) {
    const account = await this.accounts().findOne({_id:uid});
    if (!account?.pending) return;
    if (account.pending.id !== marker || account.pending.phone !== phone) throw unavailable();
    await beforeConfirm();
    await this.checkReady();
    await this.confirm(uid, account.pending);
  }
  async reserve(uid: string, phone: string, previousPhone: string | null, profileExists: boolean, generation: string, repair: boolean): Promise<PendingMobile> {
    await this.checkReady();
    try { return await this.transaction(async session => {
      const options = {session}, account = await this.accounts().findOne({_id:uid},options);
      const pending = {id:digest([uid,phone,previousPhone,generation]),phone,previousPhone}, now = new Date();
      if (account?.pending) {
        if (account.pending.phone !== phone || account.state === 'conflicted' || account.pending.previousPhone !== account.phone) throw unavailable();
        // Only this UID can resume its operation; no TTL or lease can steal it.
        return account.pending;
      }
      if (account?.lastOperation === pending.id && account.phone === phone && account.state === 'owned') return pending;
      if (profileExists && !account || !profileExists && account || account?.state === 'conflicted') throw unavailable();
      if (account && account.phone !== previousPhone) throw unavailable();
      if (account && ['missing','invalid'].includes(account.state) && !repair) throw unavailable();
      const existing = await this.claims().findOne({normalizedNumber:phone}, options);
      if (existing && (existing.status !== 'owned' || existing.firebaseUID !== uid)) throw conflict();
      if (previousPhone) {
        const old = await this.claims().findOne({normalizedNumber:previousPhone},options);
        if (account?.state !== 'owned' || old?.status !== 'owned' || old.firebaseUID !== uid) throw unavailable();
      }
      if (existing) {
        // Same-number completion is an idempotent reconciliation, never transfer.
        if (phone !== previousPhone) throw unavailable();
      } else {
        await this.claims().insertOne({_id:digest(phone),normalizedNumber:phone,firebaseUID:uid,status:'reserved',idempotencyId:pending.id,createdAt:now,updatedAt:now},options);
      }
      if (account) await this.accounts().updateOne({_id:uid},{$set:{pending,updatedAt:now}},options);
      else await this.accounts().insertOne({_id:uid,state:'missing',phone:null,pending,createdAt:now,updatedAt:now},options);
      return pending;
    }); } catch (error) {
      if ((error as {code?:number}).code !== 11000) throw error;
      // A UID/idempotency-index collision is not evidence that the NUMBER is
      // registered. After transaction abort, resolve its actual winning claim.
      const winner = await this.claims().findOne({normalizedNumber:phone});
      if (winner && (winner.firebaseUID !== uid || winner.status === 'blocked')) throw conflict();
      throw unavailable();
    }
  }
  async confirm(uid: string, operation: PendingMobile) {
    await this.transaction(async session => {
      const options = {session}, account = await this.accounts().findOne({_id:uid},options);
      if (account?.lastOperation === operation.id && !account.pending) return;
      if (account?.pending?.id !== operation.id) throw unavailable();
      const target = await this.claims().findOne({normalizedNumber:operation.phone},options);
      if (!target || target.firebaseUID !== uid || !['owned','reserved'].includes(target.status) || target.status === 'reserved' && target.idempotencyId !== operation.id) throw unavailable();
      if (operation.previousPhone && operation.previousPhone !== operation.phone) {
        const removed = await this.claims().deleteOne({normalizedNumber:operation.previousPhone,firebaseUID:uid,status:'owned'},options);
        if (removed.deletedCount !== 1) throw unavailable();
      }
      await this.claims().updateOne({_id:target._id},{$set:{status:'owned',updatedAt:new Date()}},options);
      await this.accounts().updateOne({_id:uid},{$set:{state:'owned',phone:operation.phone,lastOperation:operation.id,updatedAt:new Date()},$unset:{pending:''}},options);
    });
  }
}

// SDK errors are never passed to the generic logger (URIs/contacts may appear in
// driver diagnostics). Only the intentional, non-sensitive API errors escape.
export async function withMongoMobile<T>(fn: (store: MongoMobileStore) => Promise<T>): Promise<T> {
  try { const {client,db} = await getMobileMongo(); return await fn(new MongoMobileStore(client,db)); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    throw unavailable();
  }
}
