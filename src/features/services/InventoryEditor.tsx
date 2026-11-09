"use client";
import { useState } from 'react';
import { Plus, Trash2, Undo2 } from 'lucide-react';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { INVENTORY_CONDITIONS, inventoryError, inventorySummary, removeInventoryItem, restoreInventoryItem, type InventoryItem, type AgreementInventory } from '@/lib/agreement-inventory';
import styles from './InventoryEditor.module.css';
export function InventoryEditor({ items, onChange, disabled = false }: {
    items: InventoryItem[];
    onChange: (items: InventoryItem[]) => void;
    disabled?: boolean;
}) {
    const [removed, setRemoved] = useState<{
        item: InventoryItem;
        index: number;
    } | null>(null), summary = inventorySummary(items), error = inventoryError(items);
    const edit = (index: number, changes: Partial<InventoryItem>) => onChange(items.map((item, i) => i === index ? { ...item, ...changes } : item));
    return <section className={styles.editor} aria-label="Furniture & Inventory Details"><h3 className={styles.heading}>Furniture &amp; Inventory Details</h3><p className={styles.hint}>This agreement only. Original property inventory remains unchanged. Owner edits await tenant confirmation.</p>{items.map((item, index) => <div key={item.id} className={styles.row}><label>Item name *<Input required maxLength={120} value={item.name} disabled={disabled} onChange={e => edit(index, { name: e.target.value })}/></label><label>Quantity *<Input required type="number" min={1} max={10000} step={1} value={item.quantity || ''} disabled={disabled} onChange={e => edit(index, { quantity: Number(e.target.value) })}/></label><label>Condition<select disabled={disabled} value={item.condition || ''} onChange={e => edit(index, { condition: e.target.value })}><option value="">Not specified</option>{INVENTORY_CONDITIONS.map(condition => <option key={condition}>{condition}</option>)}</select></label><label className={styles.remarks}>Remarks<Input maxLength={1000} value={item.remarks || ''} disabled={disabled} onChange={e => edit(index, { remarks: e.target.value })}/></label>{!disabled && <Button type="button" variant="ghost" aria-label={`Remove ${item.name || 'item ' + (index + 1)}`} onClick={() => { const next = removeInventoryItem(items, index); setRemoved({ item: next.removed, index }); onChange(next.items); }}><Trash2 size={16}/> Remove</Button>}</div>)}{!items.length && <p className={styles.hint}>No items in this agreement inventory.</p>}<div className={styles.actions}>{!disabled && <Button type="button" variant="outline" onClick={() => onChange([...items, { id: crypto.randomUUID(), name: '', quantity: 1, condition: '', remarks: '' }])}><Plus size={16}/> Add Item</Button>}{removed && !disabled && <Button type="button" variant="ghost" onClick={() => { onChange(restoreInventoryItem(items, removed.item, removed.index)); setRemoved(null); }}><Undo2 size={16}/> Undo remove</Button>}<span className={styles.summary}>Total Items: {summary.items} | Total Quantity: {summary.quantity}</span></div>{error && <p role="alert" className={styles.error}>{error}</p>}</section>;
}
export function InventorySnapshot({ snapshot }: {
    snapshot?: AgreementInventory;
}) { return <section className={styles.snapshot}><h3 className={styles.heading}>Furniture &amp; Fixtures / Inventory Annexure</h3><p className={styles.hint}>{!snapshot ? 'Inventory not recorded' : snapshot.status === 'agreed' ? 'Tenant-confirmed inventory' : 'Awaiting Tenant Confirmation'}{snapshot ? ` | Version ${snapshot.version}` : ''}</p>{snapshot?.items.length ? <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Item</th><th>Quantity</th><th>Condition</th><th>Remarks</th></tr></thead><tbody>{snapshot.items.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{item.condition || '—'}</td><td>{item.remarks || '—'}</td></tr>)}</tbody></table></div> : <p className={styles.hint}>No inventory items recorded for this agreement.</p>}</section>; }
