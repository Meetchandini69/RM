import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect } from 'wouter';

type Viewer = { id: string; name: string; contactType: 'telegram' | 'whatsapp'; contact: string; age: number; location: string; lookingFor: string; status: string; notificationStatus: string };
export async function viewerApi(path: string, body?: unknown) {
  const res = await fetch(`/api/${path}`, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Registration is temporarily unavailable. Please try again shortly.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Please try again.');
  return data;
}
export function useViewer() {
  return useQuery<Viewer | null>({ queryKey: ['viewer'], queryFn: () => viewerApi('viewer/me'), refetchInterval: 30000, retry: false });
}
export function UnlockNotice() {
  const { data } = useViewer();
  if (data) return null;
  return <div className="my-6 rounded-xl border border-accent/30 bg-card p-5"><h2 className="font-editorial text-2xl">Register to unlock profile photos</h2><p className="mt-2 text-sm text-muted-foreground">Share your name, Telegram ID or WhatsApp number, what you’re looking for, age and location. After admin approval, log in to view clear photos and send interest.</p><div className="mt-4 flex gap-5"><Link href="/unlock" className="text-accent">Register to unlock ?</Link><Link href="/login" className="text-accent">Women’s login</Link></div></div>;
}
export default function ViewerAccess({ login = false }: { login?: boolean }) {
  const viewer = useViewer();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const field = 'mt-2 w-full rounded-xl border border-foreground/20 bg-background p-3';
  if (viewer.data) return <Redirect to="/account" />;
  return <div className="mx-auto max-w-xl px-5 py-14"><h1 className="font-editorial text-4xl">{login ? "Women’s login" : "Women’s registration"}</h1><p className="mt-4 text-muted-foreground">{login ? 'For women: log in with your registered Telegram username or WhatsApp number and password to unlock profiles. Admin approval is required.' : 'Registration for women to unlock profiles. A few basic details help our team review your request. Your details are shared privately with our team.'}</p>{submitted ? <div className="mt-8 rounded-xl border border-accent/30 p-6"><p role="status">{message}</p><Link href="/login" className="mt-4 block text-accent">Go to women’s login</Link></div> : <form className="mt-8 grid gap-5" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form);
    try {
      const result = await viewerApi(login ? 'viewer/login' : 'viewer/register', login ? body : { ...body, age: Number(body.age) });
      if (login) { client.setQueryData(['viewer'], result); await client.invalidateQueries(); } else { setSubmitted(true); setMessage(result.message); }
    } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }}>
    {!login && <><label>Name<input name="name" required maxLength={100} autoComplete="name" className={field} /></label><label>Contact method<select name="contactType" className={field}><option value="telegram">Telegram</option><option value="whatsapp">WhatsApp</option></select></label></>}
    <label>Telegram username or WhatsApp number<input name="contact" required maxLength={64} placeholder="@username or +919876543210" className={field} autoComplete="username" /></label>
    {!login && <><label>What are you looking for?<textarea name="lookingFor" required maxLength={500} className={field} placeholder="Dating, companionship, a dinner partner…" /></label><div className="grid grid-cols-2 gap-4"><label>Age<input name="age" type="number" required min={18} max={100} className={field} /></label><label>Location<input name="location" required maxLength={150} placeholder="City / area" className={field} /></label></div></>}
    <label>Password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={login ? 'current-password' : 'new-password'} className={field} /></label>
    {!login && <label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="mt-1" />I am 18 or older and agree to the terms and privacy policy.</label>}
    <p role="alert" className="text-primary">{message}</p><button disabled={busy} className="rounded-xl bg-primary px-5 py-3 font-semibold disabled:opacity-50">{busy ? 'Please wait…' : login ? "Women’s login" : "Submit for approval"}</button>
    <Link className="text-accent" href={login ? '/unlock' : '/login'}>{login ? "New here? Women’s registration" : "Already registered? Women’s login"}</Link><Link href="/dashboard" className="text-sm text-muted-foreground">Men with a listed profile: manage your profile</Link>
  </form>}</div>;
}
export function ViewerQueue() {
  const client = useQueryClient();
  const query = useQuery<Viewer[]>({ queryKey: ['admin-viewers'], queryFn: () => viewerApi('registration/admin/viewers'), refetchInterval: 30000 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <section className="my-8"><h2 className="font-editorial text-3xl">Browsing access requests</h2><p className="mt-2 text-muted-foreground">Approve members to unlock photos and interest sending. New requests are also sent to your configured Telegram chat.</p>{query.isLoading && <p>Loading requests…</p>}{query.isError && <p role="alert">Could not load requests.</p>}<p role="alert" className="text-primary">{error}</p>{query.data?.length === 0 && <p className="mt-4">No browsing requests yet.</p>}{query.data?.map(v => <article key={v.id} className="mt-4 rounded-xl border border-foreground/15 bg-card p-5"><div className="flex justify-between gap-3"><h3 className="font-editorial text-2xl">{v.name}, {v.age}</h3><span>{v.status}</span></div><p>{v.contactType}: {v.contact} · {v.location}</p><p className="mt-2 whitespace-pre-wrap">Looking for: {v.lookingFor}</p><p className="mt-2 text-sm text-muted-foreground">Registration Telegram notification: {v.notificationStatus}</p><div className="mt-4 flex gap-4">{['Approved', 'Rejected'].filter(s => s !== v.status).map(status => <button key={status} disabled={busy} className="rounded-lg border border-accent/40 px-4 py-2 text-accent disabled:opacity-50" onClick={async () => { setBusy(true); setError(''); try { await viewerApi(`registration/admin/viewers/${v.id}/review`, { status }); await client.invalidateQueries({ queryKey: ['admin-viewers'] }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{status === 'Approved' ? 'Approve' : 'Reject / revoke'}</button>)}</div></article>)}</section>;
}

