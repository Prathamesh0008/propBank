export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    condition?: string;
    remarks?: string;
}
export interface AgreementInventory {
    version: number;
    status: 'proposed' | 'agreed';
    items: InventoryItem[];
    proposedBy: string;
    proposedAt: unknown;
    confirmedBy?: string;
    confirmedAt?: unknown;
}
export const INVENTORY_CONDITIONS = ['New', 'Good', 'Fair', 'Damaged'] as const;
export function normalizeInventory(value: unknown): InventoryItem[] {
    if (!Array.isArray(value) || value.length > 100)
        throw Error('Inventory must contain at most 100 items');
    const names = new Set<string>(), ids = new Set<string>();
    return value.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw Error('Invalid inventory item');
        const item = raw as Record<string, unknown>;
        if (Object.keys(item).some(key => !['id', 'name', 'quantity', 'condition', 'remarks'].includes(key)))
            throw Error('Unsupported inventory item field');
        if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 120)
            throw Error(`Item ${index + 1}: enter an item name (up to 120 characters)`);
        const name = item.name.trim().replace(/\s+/g, ' '), key = name.toLocaleLowerCase('en-IN');
        if (names.has(key))
            throw Error(`Duplicate item name: ${name}. Edit its quantity or use distinct names.`);
        names.add(key);
        if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000)
            throw Error(`Item ${index + 1}: quantity must be a positive whole number (maximum 10000)`);
        if (item.condition !== undefined && item.condition !== '' && !INVENTORY_CONDITIONS.includes(item.condition as typeof INVENTORY_CONDITIONS[number]))
            throw Error('Invalid inventory condition');
        if (item.remarks !== undefined && (typeof item.remarks !== 'string' || item.remarks.length > 1000))
            throw Error('Item remarks must be under 1000 characters');
        const id = item.id === undefined ? `item-${index + 1}` : item.id;
        if (typeof id !== 'string' || !id || id.length > 100 || ids.has(id))
            throw Error('Inventory item identifiers must be unique');
        ids.add(id);
        return { id, name, quantity: item.quantity, condition: (item.condition || '') as string, remarks: (item.remarks || '') as string };
    });
}
export function propertyInventory(value: unknown): InventoryItem[] {
    if (!Array.isArray(value))
        return [];
    return value.filter(item => item && item.checked === true).map((item, index) => ({ id: String(item.id || `property-${index + 1}`), name: String(item.name || ''), quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1, condition: INVENTORY_CONDITIONS.includes(item.condition) ? item.condition : '', remarks: typeof item.remarks === 'string' ? item.remarks : '' }));
}
export function inventoryError(value: unknown): string { try {
    normalizeInventory(value);
    return '';
}
catch (error) {
    return error instanceof Error ? error.message : 'Invalid inventory';
} }
export function inventorySummary(items: InventoryItem[]) { return { items: items.length, quantity: items.reduce((sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0), 0) }; }
export function removeInventoryItem(items: InventoryItem[], index: number) { return { items: items.filter((_, i) => i !== index), removed: items[index], index }; }
export function restoreInventoryItem(items: InventoryItem[], removed: InventoryItem, index: number) { return [...items.slice(0, index), removed, ...items.slice(index)]; }
export function inventoryProposal(items: unknown, actor: string, version: number, now = new Date()): AgreementInventory {
    return { version: version + 1, status: 'proposed', items: normalizeInventory(items), proposedBy: actor, proposedAt: now };
}
export function inventoryLocked(tenant: Record<string, any>, property: Record<string, any>) { return tenant.isActive === false || ['signed', 'finalized'].includes(tenant.agreementStatus) || ['signed', 'finalized'].includes(property.agreementStatus) || ['agreed', 'finalized', 'signed'].includes(tenant.agreementInventory?.status) || !!tenant.agreementSignedAt || !!tenant.agreementFinalizedAt || !!property.agreementSignedAt || !!property.agreementFinalizedAt; }
export function inventoryAnnexure(snapshot: AgreementInventory | undefined): string {
    const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
    const items = snapshot?.items || [], status = !snapshot ? 'Inventory not recorded' : snapshot.status === 'agreed' ? 'Confirmed inventory' : 'Proposed inventory - Awaiting Tenant Confirmation';
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>PropBank Inventory Annexure</title><style>body{font:14px Arial,sans-serif;color:#183c32;margin:36px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d4d0c5;padding:10px;text-align:left}p{color:#565c56}@media print{body{margin:12mm}}</style><h1>Furniture &amp; Fixtures / Inventory Annexure</h1><p>${status}${snapshot ? ` | Version ${snapshot.version}` : ''}</p>${items.length ? `<table><thead><tr><th>Item</th><th>Quantity</th><th>Condition</th><th>Remarks</th></tr></thead><tbody>${items.map(item => `<tr><td>${escape(item.name)}</td><td>${item.quantity}</td><td>${escape(item.condition)}</td><td>${escape(item.remarks)}</td></tr>`).join('')}</tbody></table>` : '<p>No inventory items recorded for this agreement.</p>'}<p>Inventory confirmation is separate from a legal signature or handover.</p></html>`;
}
