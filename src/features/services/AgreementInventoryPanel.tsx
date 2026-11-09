"use client";
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { workflowRequest } from '@/lib/client-workflows';
import { inventoryError, type AgreementInventory, type InventoryItem } from '@/lib/agreement-inventory';
import { InventoryEditor, InventorySnapshot } from './InventoryEditor';
import { Button } from '@/ui/button';
export default function AgreementInventoryPanel({ tenantId, owner, label, initialItems = [] }: {
    tenantId: string;
    owner: boolean;
    label: string;
    initialItems?: InventoryItem[];
}) {
    const { user } = useAuth();
    const query = useQuery({ queryKey: ['agreementInventory', tenantId, user?.uid], enabled: !!user, queryFn: () => workflowRequest<{
            inventory: AgreementInventory | null;
            history: AgreementInventory[];
            locked?: boolean;
        }>(`tenants/${encodeURIComponent(tenantId)}/inventory`) });
    const [editing, setEditing] = useState(false), [items, setItems] = useState<InventoryItem[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [editingVersion,setEditingVersion]=useState(0),[editingAmend,setEditingAmend]=useState(false);
    const current = query.data?.inventory;
    async function save(confirm = false) { if (busy)
        return; setError(''); if (!confirm && inventoryError(items)) {
        setError(inventoryError(items));
        return;
    } setBusy(true); try {
        await workflowRequest(`tenants/${encodeURIComponent(tenantId)}/inventory`, { action: confirm ? 'confirm' : editingAmend ? 'amend' : 'propose', expectedVersion: confirm ? current?.version || 0 : editingVersion, ...(confirm ? {} : { items }) }, confirm ? 'POST' : 'PUT');
        setEditing(false);
        await query.refetch();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Inventory could not be saved');
    }
    finally {
        setBusy(false);
    } }
    async function download(version?: number) { setError(''); try {
        const response = await apiFetch(`/api/tenants/${encodeURIComponent(tenantId)}/inventory?format=html${version ? `&version=${version}` : ''}`);
        if (!response.ok)
            throw new Error('Inventory annexure could not be downloaded');
        const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
        link.href = url;
        link.download = `inventory-annexure-v${version || current?.version || 0}.html`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Download failed');
    } }
    return <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">{label} — Agreement inventory</h3>{query.isLoading && <p role="status">Loading inventory…</p>}{(query.error || error) && <p role="alert" className="text-destructive">{query.error?.message || error}</p>}{query.data && <><InventorySnapshot snapshot={current || undefined}/>{editing && <InventoryEditor key={tenantId} items={items} onChange={setItems}/>}<div className="flex gap-2 flex-wrap">{owner && !editing && <Button type="button" variant="outline" onClick={() => { setEditingVersion(current?.version||0);setEditingAmend(!!query.data?.locked);setItems((current?.items ?? initialItems).map(item => ({ ...item }))); setEditing(true); }}>{query.data?.locked ? 'Prepare inventory amendment' : 'Edit proposed inventory'}</Button>}{owner && editing && <><Button type="button" disabled={busy || !!inventoryError(items)} onClick={() => void save()}>Save proposed inventory</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button></>}{!owner && current?.status === 'proposed' && <Button type="button" disabled={busy} onClick={() => void save(true)}>Confirm this inventory (version {current.version})</Button>}<Button type="button" variant="outline" onClick={() => void download()}>Download inventory annexure</Button></div><p className="text-sm text-muted-foreground">Confirmation acknowledges these exact items; it is not a legal signature or handover. Open the downloaded annexure to print it.</p>{query.data.history.length > 0 && <details><summary>Inventory history</summary>{query.data.history.map(snapshot => <div key={snapshot.version}><InventorySnapshot snapshot={snapshot}/><Button type="button" variant="ghost" onClick={() => void download(snapshot.version)}>Download version {snapshot.version}</Button></div>)}</details>}</>}</section>;
}
