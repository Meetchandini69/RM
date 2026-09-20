import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { viewerApi } from './viewer-access';

const input = 'mt-2 w-full rounded-lg border border-foreground/20 bg-background p-3';
const button = 'rounded-lg border border-accent/40 px-4 py-2 text-accent disabled:opacity-50';

export function PasswordResetRequest() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return <div className="mt-5">
    <button type="button" className="text-sm text-accent underline" onClick={() => setOpen(!open)} aria-expanded={open}>Forgot password? Request a reset</button>
    {open && <form className="mt-4 grid gap-4 rounded-xl border border-foreground/15 p-5" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      setBusy(true); setError(''); setMessage('');
      try {
        const result = await viewerApi('registration/password-resets', Object.fromEntries(values));
        setMessage(result.message); form.reset();
      } catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm text-muted-foreground">Enter your registered mobile number and a new password. Admin must verify and approve your request before the new password works.</p>
      <label>Mobile number with country code<input name="mobile" type="tel" autoComplete="username" placeholder="+91 98765 43210" maxLength={30} required className={input} /></label>
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={input} /></label>
      <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={input} /></label>
      <button className={button} disabled={busy}>{busy ? 'Submitting…' : 'Request admin approval'}</button>
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-primary">{error}</p>}
    </form>}
  </div>;
}

type ResetRequest = { id: string; name: string; mobile: string; created_at: string };
export function AdminPasswordResets() {
  const client = useQueryClient();
  const query = useQuery<ResetRequest[]>({ queryKey: ['admin-password-resets'], queryFn: () => viewerApi('registration/admin/password-resets'), refetchInterval: 30000, retry: false });
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function review(id: string, status: string) {
    setBusy(true); setError('');
    try {
      await viewerApi(`registration/admin/password-resets/${id}/review`, { status, identityVerified: !!verified[id] });
      await client.invalidateQueries({ queryKey: ['admin-password-resets'] });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="mt-6">
    <div role="status" aria-live="polite">{query.data && query.data.length > 0 && <h2 className="font-semibold text-accent">Password reset requests ({query.data.length} pending)</h2>}</div>
    {query.data?.map(request => <article key={request.id} className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-5">
      <p className="font-semibold">{request.name} · {request.mobile}</p>
      <p className="mt-2 text-sm">Requested {new Date(request.created_at).toLocaleString()}</p>
      <label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={!!verified[request.id]} onChange={e => setVerified({ ...verified, [request.id]: e.target.checked })} />I verified this member's identity through their registered contact.</label>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !verified[request.id]} onClick={() => review(request.id, 'Approved')}>Approve password reset</button><button className={button} disabled={busy} onClick={() => review(request.id, 'Rejected')}>Reject</button></div>
    </article>)}
    {(error || query.isError) && <p role="alert" className="text-primary">{error || 'Could not load password reset notifications.'} <button className="underline" onClick={() => query.refetch()}>Refresh</button></p>}
  </div>;
}
