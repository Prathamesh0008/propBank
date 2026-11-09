import 'server-only';
import { getDatabase, COLLECTIONS } from '../firestore';
import { identity, readObject } from './domain-contracts';
import {wireValue} from './contracts';
import { ApiError, jsonResponse } from '../http';
import { inventoryProposal, inventoryLocked, inventoryAnnexure, type AgreementInventory } from '@/lib/agreement-inventory';
export async function tenantInventory(request: Request, id: string) {
    const user = await identity(request, true), db = getDatabase();
    if (!id || id.includes('/'))
        throw new ApiError(400, 'Tenant ID required');
    const ref = db.collection(COLLECTIONS.tenants).doc(id), req = request.method === 'GET' ? {} : await readObject(request, 512000);
    const response = await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists)
            throw new ApiError(404, 'Tenancy not found');
        const tenant = doc.data()!, pref = db.collection(COLLECTIONS.properties).doc(String(tenant.propertyId)), property = await tx.get(pref);
        if (!property.exists || property.data()?.ownerUID !== tenant.ownerUID)
            throw new ApiError(403, 'Property relationship changed');
        const p = property.data()!, entry = (p.tenants || []).find((t: any) => t.id === id);
        if (!entry)
            throw new ApiError(409, 'Tenancy relationship changed');
        const owner = user.role === 'admin' || user.uid === p.ownerUID, linked = tenant.isActive === true && entry.isActive === true && tenant.linkConfirmationRequired !== true && entry.linkConfirmationRequired !== true && tenant.userUID === user.uid && entry.userUID === user.uid;
        if (!owner && !linked)
            throw new ApiError(403, 'Tenancy inventory access required');
        if(JSON.stringify(wireValue(tenant.agreementInventory??null))!==JSON.stringify(wireValue(entry.agreementInventory??null)))throw new ApiError(409,'Inventory copies differ; reconcile before editing');
        const current = tenant.agreementInventory as AgreementInventory | undefined, history = Array.isArray(tenant.inventoryHistory) ? tenant.inventoryHistory : [];
        if (request.method === 'GET')
            return { inventory: current || null, history, locked: inventoryLocked(tenant, p) };
        if (!Number.isInteger(req.expectedVersion) || req.expectedVersion !== Number(current?.version || 0))
            throw new ApiError(409, 'Inventory changed; reload before continuing');
        if (history.length >= 100)
            throw new ApiError(409, 'Inventory history limit reached');
        let next: AgreementInventory;
        if (request.method === 'POST') {
            if (Object.keys(req).some(key => !['expectedVersion', 'action'].includes(key)) || req.action !== 'confirm' || !linked || owner)
                throw new ApiError(403, 'Only the linked tenant can confirm this exact inventory');
            if (current?.status === 'agreed')
                return { inventory: current, history };
            if (!current || current.status !== 'proposed')
                throw new ApiError(409, 'Proposed inventory required');
            next = { ...current, items: current.items.map(item => ({ ...item })), status: 'agreed', confirmedBy: user.uid, confirmedAt: new Date() };
            history.push(next);
        }
        else {
            if (!owner)
                throw new ApiError(403, 'Only the owner or administrator can propose inventory');
            if (Object.keys(req).some(key => !['expectedVersion', 'action', 'items'].includes(key)) || !['propose', 'amend'].includes(String(req.action)))
                throw new ApiError(400, 'Invalid inventory action');
            if (tenant.isActive === false)
                throw new ApiError(409, 'Historical tenancy inventory is immutable');
            if (inventoryLocked(tenant, p) && req.action !== 'amend')
                throw new ApiError(409, 'Confirmed/finalized inventory requires an explicit amendment and tenant reconfirmation');
            if (inventoryLocked(tenant, p) && current && !history.some((s: any) => s.version === current.version))
                history.push({ ...current, items: current.items.map(item => ({ ...item })) });
            try {
                next = inventoryProposal(req.items, user.uid, Number(current?.version || 0));
            }
            catch (error) {
                throw new ApiError(400, error instanceof Error ? error.message : 'Invalid inventory');
            }
        }
        tx.update(ref, { agreementInventory: next, inventoryHistory: history, updatedAt: new Date() });
        tx.update(pref, { tenants: p.tenants.map((t: any) => t.id === id ? { ...t, agreementInventory: next, inventoryHistory: history } : t), updatedAt: new Date() });
        return { inventory: next, history };
    });
    if (request.method === 'GET' && new URL(request.url).searchParams.get('format') === 'html') {
        const version = new URL(request.url).searchParams.get('version');
        const selected = version ? response.history.find((v: any) => String(v.version) === version) || (String(response.inventory?.version) === version ? response.inventory : null) : response.inventory;
        if (version && !selected)
            throw new ApiError(404, 'Inventory version not found');
        return new Response(inventoryAnnexure(selected || undefined), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'attachment; filename="propbank-inventory-annexure.html"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } });
    }
    return jsonResponse({ success: true, ...response });
}
