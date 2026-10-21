"use client";

import { useState } from 'react';
import { Search, UserRoundCheck, Building2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useNavigate } from '@/lib/navigation';
import { Button } from '@/ui/button';
import type { Property } from '@/services/propertyService';
import styles from './AdminPropertyOperations.module.css';

type Account={uid:string;name:string;email:string;phoneNumber:string;role:string;isActive:boolean};

export default function AdminPropertyOperations({properties}:{properties:Property[]}) {
  const navigate=useNavigate();
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<Account[]>([]);
  const [selected,setSelected]=useState<Account|null>(null);
  const [propertyId,setPropertyId]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const search=async()=>{
    setLoading(true);setError('');setSelected(null);
    try{const response=await apiFetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);const data=await response.json();if(!response.ok)throw new Error(data.message||'Search failed');setResults(data.users||[]);}
    catch(error){setResults([]);setError(error instanceof Error?error.message:'Search failed');}
    finally{setLoading(false);}
  };
  const active=selected?.isActive===true;
  return <section className={styles.panel} aria-labelledby="admin-property-operations-title">
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>Account assistance</p><h2 id="admin-property-operations-title">Add property or tenant relationship</h2></div>
      <UserRoundCheck aria-hidden="true" />
    </div>
    <div className={styles.searchRow}>
      <label className={styles.field}><span>Registered user</span><input value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void search();}}} placeholder="Name, email or phone" /></label>
      <Button type="button" variant="outline" onClick={search} disabled={loading||query.trim().length<2}><Search className="h-4 w-4 mr-2"/>{loading?'Searching…':'Search'}</Button>
    </div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {!!results.length&&<div className={styles.results} role="list" aria-label="Matching registered users">{results.map(account=><button type="button" role="listitem" key={account.uid} className={selected?.uid===account.uid?styles.selected:styles.result} onClick={()=>setSelected(account)}>
      <strong>{account.name||'Unnamed account'}</strong><span>{account.email} · {account.phoneNumber||'No phone'}</span><small>{account.isActive?'Active account':'Inactive account'} · {account.role}</small>
    </button>)}</div>}
    {selected&&<div className={styles.actions}>
      <div className={styles.confirmation}><strong>{selected.name}</strong><span>{selected.email}</span><span className={active?styles.active:styles.inactive}>{active?'Active and eligible':'Inactive — linking disabled'}</span></div>
      <div className={styles.actionGrid}>
        <div><h3>Create for owner</h3><p>Uses the existing property form. The selected account becomes the owner and public listings remain pending review.</p><Button disabled={!active} onClick={()=>navigate(`/select-property-type?as=owner&adminOwnerUID=${encodeURIComponent(selected.uid)}`)}><Building2 className="h-4 w-4 mr-2"/>Add Property for User</Button></div>
        <div><h3>Link as tenant</h3><p>Select a verified owner property, then complete the existing rental and tenant form.</p><label className={styles.field}><span>Property</span><select value={propertyId} onChange={event=>setPropertyId(event.target.value)}><option value="">Choose property</option>{properties.filter(property=>property.ownerUID&&property.isActive!==false&&property.createdAs!=='tenant').map(property=><option key={property.id} value={property.id}>{property.title} · {property.ownerName}</option>)}</select></label><Button variant="outline" disabled={!active||!propertyId} onClick={()=>navigate(`/add-tenant/${encodeURIComponent(propertyId)}?admin=1&tenantUID=${encodeURIComponent(selected.uid)}`)}>Manage tenancy</Button><p className={styles.note}>If the property is not registered, the tenant must use the existing private tenant-intake and owner-verification workflow from their own account.</p></div>
      </div>
    </div>}
  </section>;
}
