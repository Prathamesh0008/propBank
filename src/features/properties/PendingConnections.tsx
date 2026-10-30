"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, CheckCircle2, ChevronDown, Clock3, KeyRound, RefreshCw, ShieldCheck, MailCheck, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { Link } from '@/lib/navigation';
import { CONNECTION_LABELS, connectionPending, type ConnectionState } from '@/lib/relationship-link-state';
import styles from './PropertyHub.module.css';

type Connection = {
  id: string; reference: string; relationship: 'owner' | 'tenant'; status: ConnectionState;
  viewer: 'owner' | 'candidate'; version: number; expiresAt?: string;
  propertyId?: string; propertyLabel?: string; canAuthorizeInvitation?: boolean;
};
type ConnectionsResponse = {connections: Connection[]; emailVerified: boolean; phoneVerified?: boolean; truncated: boolean};

async function connectionRequest(action: string, connection?: Connection) {
  const response = await apiFetch('/api/relationship-links', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action, ...(connection ? {claimId: connection.id, expectedVersion: connection.version} : {})}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'The connection could not be updated.');
  return data;
}

export default function PendingConnections() {
  const {user} = useAuth(), cache = useQueryClient(), id = useId();
  const observedLinked = useRef(new Set<string>());
  const discoveredIdentity = useRef('');
  const [busy, setBusy] = useState(false), [review, setReview] = useState('');
  const [feedback, setFeedback] = useState(''), [failure, setFailure] = useState('');
  const identityKey=`${user?.uid||''}:${user?.email||''}:${user?.emailVerified===true}`;
  async function discover() {for (let page = 0; page < 5; page++) if (!(await connectionRequest('discover')).truncated) break;discoveredIdentity.current=identityKey;}
  const query = useQuery<ConnectionsResponse>({
    queryKey: ['relationshipLinks', user?.uid, user?.email, user?.emailVerified], enabled: !!user,
    staleTime: 0, retry: false, refetchOnWindowFocus: 'always',
    refetchInterval: query => query.state.data?.connections.some(item => connectionPending(item.status)) ? 30000 : false,
    queryFn: async () => {
      if(discoveredIdentity.current!==identityKey)await discover();
      const response = await apiFetch('/api/relationship-links');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Pending connections could not be loaded.');
      return data;
    },
  });
  const data = query.data;
  useEffect(() => {
    const newlyLinked = (data?.connections || []).filter(item => item.status === 'linked' && !observedLinked.current.has(item.id));
    if (!newlyLinked.length) return;
    newlyLinked.forEach(item => observedLinked.current.add(item.id));
    void Promise.all(['userProperties', 'productHub', 'property'].map(key => cache.invalidateQueries({queryKey: [key]})));
  }, [data, cache]);
  const pending = (data?.connections || []).filter(item => connectionPending(item.status));
  const history = (data?.connections || []).filter(item => ['rejected', 'expired'].includes(item.status));
  const disabled = busy || query.isFetching || query.isError;

  if (data?.emailVerified && !query.isError && !pending.length && !history.length) return null;

  async function refresh() {
    try{await discover();}catch(error){setFailure(error instanceof Error?error.message:'Pending connections could not be refreshed.');return;}
    const result = await query.refetch();
    if (!result.isError) await Promise.all(['userProperties', 'productHub'].map(key => cache.invalidateQueries({queryKey: [key]})));
  }

  async function act(action: string, connection: Connection) {
    if (disabled) return;
    setBusy(true); setFailure(''); setFeedback('');
    try {
      const result = await connectionRequest(action, connection);
      setFeedback(action === 'reject' ? 'Connection rejected.' : action === 'request_owner_verification' ? 'Ownership verification requested. An administrator must review the evidence.' : action === 'authorize_tenancy_invitation' ? 'Owner authorization recorded. The invitation is queued once delivery checks pass; the tenant must still accept.' : result.status === 'linked' ? 'Your tenancy has been connected successfully.' : 'Your acceptance has been recorded. Waiting for the property owner\u2019s approval.');
      setReview('');
      await Promise.all(['relationshipLinks', 'userProperties', 'productHub', 'allProperties', 'property'].map(key => cache.invalidateQueries({queryKey: [key]})));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The connection could not be updated.');
      await query.refetch();
    } finally {setBusy(false);}
  }

  return <section id="pending-connections" className={styles.connections} aria-labelledby={`${id}-heading`}>
    <div className={styles.connectionsHeading}>
      <div><h2 id={`${id}-heading`}>Pending Connections <span>{pending.length}</span></h2><p>Review relationship requests.</p></div>
      <button type="button" className={styles.connectionRefresh} disabled={busy || query.isFetching} onClick={() => void refresh()}><RefreshCw size={15} aria-hidden="true"/> Refresh</button>
    </div>
    {query.isLoading && <p className={styles.connectionFeedback} role="status"><Clock3 size={17} aria-hidden="true"/> Loading pending connections…</p>}
    {query.error && <div className={styles.connectionError} role="alert"><p>{query.error.message}</p><button type="button" disabled={query.isFetching} onClick={() => void refresh()}>Retry</button></div>}
    {data && !data.emailVerified && <div className={styles.phoneRequired}>
      <MailCheck size={21} strokeWidth={1.5} aria-hidden="true"/>
      <div><h3>Verification Required</h3><p id={`${id}-email-help`}>Use the Firebase account with the verified email that received your invitation. Profile contact details cannot unlock a connection.</p><Link to="/auth?next=%2Fmanage-property%23pending-connections" aria-describedby={`${id}-email-help`}>Verify Email</Link><Link to="/support">Contact support</Link></div>
    </div>}
    {data?.emailVerified && !query.isError && !pending.length && !!history.length && <p className={styles.connectionEmpty}><CheckCircle2 size={20} strokeWidth={1.5} aria-hidden="true"/> No pending connections</p>}
    {data?.truncated && <p className={styles.connectionHint}>Showing a limited set. Review these requests, then refresh for more.</p>}
    <div className={styles.connectionList}>
      {pending.map(item => {
        const Icon = item.relationship === 'owner' ? Building2 : KeyRound;
        const open = review === item.id;
        const ownership = item.relationship === 'owner';
        const canRequest = ownership && item.viewer === 'candidate' && data?.emailVerified && ['verification_required', 'pending_owner_authorization'].includes(item.status);
        const canAccept = !ownership && item.viewer === 'candidate' && item.status === 'pending_tenant_acceptance';
        const canApprove = item.viewer === 'owner' && item.status === 'pending_owner_authorization';
        return <article key={item.id} className={styles.connectionRow}>
          <Icon className={styles.connectionIcon} size={21} strokeWidth={1.4} aria-hidden="true"/>
          <div className={styles.connectionBody}>
            <div className={styles.connectionTitle}><h3>{item.viewer === 'owner' ? item.propertyLabel || `Property ${item.propertyId}` : ownership ? 'Ownership verification' : 'Tenant connection request'}</h3><span className={styles.connectionStatus} data-state={item.status}>{!ownership && item.viewer === 'candidate' && item.status === 'pending_tenant_acceptance' ? 'Awaiting your confirmation' : CONNECTION_LABELS[item.status]}</span></div>
            {!ownership && item.viewer === 'candidate' && <p>{item.status === 'pending_owner_authorization' ? 'Your acceptance has been recorded. Waiting for the property owner\u2019s approval.' : 'Review this tenancy invitation to connect the property to your account. The property will appear after confirmation and any required owner approval.'}</p>}
            {item.viewer === 'owner' && item.canAuthorizeInvitation && <p>This request needs your authorization before an invitation email can be sent.</p>}
            <div className={styles.connectionActions}>
              <button type="button" disabled={disabled} aria-expanded={open} aria-controls={`${id}-${item.id}`} onClick={() => setReview(open ? '' : item.id)}>{!ownership && item.viewer === 'candidate' ? 'Review Invitation' : 'Review'} <ChevronDown size={14} aria-hidden="true"/></button>
              {canRequest && <button type="button" className={styles.connectionPrimary} disabled={disabled} onClick={() => void act('request_owner_verification', item)}><ShieldCheck size={15} aria-hidden="true"/> Request Ownership Verification</button>}
              {canAccept && <button type="button" className={styles.connectionPrimary} disabled={disabled || !open || !data?.emailVerified} title={!open ? 'Review the invitation before accepting' : undefined} onClick={() => void act('confirm_tenancy', item)}><Check size={15} aria-hidden="true"/> Accept Tenancy</button>}
              {item.viewer === 'owner' && item.canAuthorizeInvitation && <button type="button" className={styles.connectionPrimary} disabled={disabled || !open} onClick={() => void act('authorize_tenancy_invitation', item)}><MailCheck size={15} aria-hidden="true"/> Authorize &amp; Send Invitation</button>}
              {canApprove && <button type="button" className={styles.connectionPrimary} disabled={disabled || !open} onClick={() => void act('approve_tenancy', item)}><Check size={15} aria-hidden="true"/> Approve Tenant Connection</button>}
              <button type="button" className={styles.connectionReject} disabled={disabled} onClick={() => void act('reject', item)}><X size={14} aria-hidden="true"/> Reject</button>
            </div>
            <div id={`${id}-${item.id}`} className={styles.connectionReview} hidden={!open}>
              <p className={styles.connectionReference}>Support reference: {item.reference}</p>
              <p>{ownership ? 'Confirm this reference with the person who reported the property. An administrator must independently review documentary ownership evidence before access is granted.' : item.viewer === 'owner' ? 'Check this reference with the tenant using contact details you already trust. Your authorization and their explicit acceptance are both required.' : 'Accept only an invitation you expect. Confirm this reference with the owner through a contact you already trust. Owner authorization is also required.'}</p>
              {item.status === 'pending_admin_verification' && <p>Ownership evidence is reviewed through the existing administrator verification workflow. <Link to="/support">Arrange a secure review</Link></p>}
              {item.expiresAt && <p>Expires {new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeZone: 'Asia/Kolkata'}).format(new Date(item.expiresAt))}</p>}
            </div>
          </div>
        </article>;
      })}
    </div>
    {!!history.length && <details className={styles.connectionHistory}><summary>Rejected / Expired <span>{history.length}</span></summary>{history.map(item => <div key={item.id}><span>{item.relationship === 'owner' ? 'Ownership request' : 'Tenant connection request'} - {item.reference}</span><span>{CONNECTION_LABELS[item.status]}</span></div>)}</details>}
    {failure && <p className={styles.connectionError} role="alert">{failure}</p>}
    {feedback && <p className={styles.connectionFeedback} role="status">{feedback}</p>}
  </section>;
}
