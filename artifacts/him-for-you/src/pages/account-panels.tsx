import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useViewer, viewerApi } from './viewer-access';
import ViewerAccess from './viewer-access';
import { useGetMyRegistration } from '@workspace/api-client-react';

const box = 'mt-5 rounded-2xl border border-foreground/15 bg-card p-5 sm:p-7';
const button = 'inline-block rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent disabled:opacity-50';
export function AccountMenu() {
 const viewer = useViewer();
 const member = useGetMyRegistration({query:{queryKey:['/api/registration/me'],retry:false,refetchInterval:30000}});
 const client = useQueryClient();
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);
 const woman = !!viewer.data;
 const name = viewer.data?.name || member.data?.displayName;
 if (!name) return <Link href="/login" className="text-xs font-semibold uppercase tracking-widest">Women’s login</Link>;
 const base = woman ? '/account' : '/dashboard';
 return <details className="relative"><summary className="max-w-40 cursor-pointer truncate rounded-lg border border-accent/30 px-3 py-2 text-sm text-accent">{name} ▾</summary><div className="absolute right-0 z-50 mt-2 grid w-56 gap-1 rounded-xl border border-foreground/15 bg-card p-3 shadow-xl"><Link className="rounded p-2 hover:bg-muted" href={woman ? '/account/profile' : '/my-profile'}>View profile</Link><Link className="rounded p-2 hover:bg-muted" href={base}>Dashboard</Link><Link className="rounded p-2 hover:bg-muted" href={woman ? '/account/interests' : '/member-interests'}>{woman ? 'Sent interests & messages' : 'Received interests'}</Link>{!woman && <Link className="rounded p-2 hover:bg-muted" href="/boost-profile">Upgrade / boost profile</Link>}<button disabled={busy} className="p-2 text-left text-primary" onClick={async()=>{setBusy(true);try{await viewerApi(woman?'viewer/logout':'registration/logout',{}); client.setQueryData(woman?['viewer']:['/api/registration/me'],null); client.removeQueries({queryKey:['account-interests']}); client.removeQueries({queryKey:['member-boosts']}); await client.invalidateQueries();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Log out</button>{error && <p role="alert" className="text-xs text-primary">{error}</p>}</div></details>;
}

type Interest = {id:string; profile_slug?:string; profile_name?:string; name?:string; note:string; created_at:string; delivery?:string};
export function InterestHistory({men=false}:{men?:boolean}) {
 const q=useQuery<Interest[]>({queryKey:['account-interests',men?'men':'women'],queryFn:()=>viewerApi(men?'registration/interests':'viewer/interests'),refetchInterval:30000,retry:false});
 return <section className={box}><h2 className="font-editorial text-2xl">{men?'Received interests':'Your sent interests & messages'}</h2><p className="mt-2 text-sm text-muted-foreground">{men?'Introductions from women who have shown interest in your profile.':'Your history stays here whenever you log in again.'}</p>{q.isLoading && <p className="mt-5">Loading…</p>}{q.isError && <p role="alert" className="mt-5 text-primary">{(q.error as Error).message}</p>}{q.data?.length===0 && <p className="mt-6 text-muted-foreground">No interests yet.{!men && <Link href="/men" className="ml-2 text-accent">Browse men →</Link>}</p>}<div className="mt-5 grid gap-4">{q.data?.map(i=><article key={i.id} className="rounded-xl border border-foreground/10 p-4"><div className="flex flex-wrap justify-between gap-2">{i.profile_slug?<Link className="font-editorial text-xl text-accent" href={`/profile/${i.profile_slug}`}>{i.profile_name}</Link>:<h3 className="font-editorial text-xl">{i.name}</h3>}<time className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</time></div><p className="mt-3 whitespace-pre-wrap text-sm">{i.note || 'Interest sent without a message.'}</p>{i.delivery && <p className="mt-3 text-xs text-muted-foreground">{i.delivery==='Sent'?'Sent to the team':i.delivery==='Failed'?'Saved · team notification delayed':'Saved · notification pending'}</p>}</article>)}</div></section>;
}
export function WomenPanel({profile=false,interests=false}:{profile?:boolean;interests?:boolean}) {
 const viewer=useViewer();
 if(viewer.isLoading) return <p className="p-12">Loading your account…</p>;
 if(!viewer.data) return <ViewerAccess login />;
 const v=viewer.data;
 return <div className="mx-auto max-w-4xl px-5 py-12"><p className="text-xs uppercase tracking-widest text-accent">Your private account</p><h1 className="mt-3 font-editorial text-4xl">{profile?'My profile':interests?'My interests':`Welcome, ${v.name}`}</h1><nav className="mt-6 flex flex-wrap gap-3"><Link className={button} href="/account">Dashboard</Link><Link className={button} href="/account/profile">View profile</Link><Link className={button} href="/account/interests">Interests & messages</Link><Link className={button} href="/men">Browse men</Link></nav>{profile?<section className={box}><h2 className="font-editorial text-2xl">{v.name}</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Member ID',v.id],['Contact',v.contact],['Age',v.age],['Location',v.location],['Looking for',v.lookingFor],['Access',v.status]].map(([k,val])=><div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 break-words">{val}</dd></div>)}</dl></section>:<>{!interests && <section className={box}><h2 className="font-editorial text-2xl">Your access is approved</h2><p className="mt-2 text-muted-foreground">Explore clear profile photos, send interest, and keep track of your introductions below.</p></section>}<InterestHistory /></>}</div>;
}

type Boost={id:string;plan:string;price:string;status:string;created_at:string;expires?:string;name?:string};
export function useAdminBoosts(enabled: boolean) {
 return useQuery<Boost[]>({queryKey:['admin-boosts'],queryFn:()=>viewerApi('registration/admin/boosts'),enabled,refetchInterval:30000,retry:false});
}
export function BoostPanel({admin=false}:{admin?:boolean}) {
 const client=useQueryClient();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const key=admin?'admin-boosts':'member-boosts';
 const q=useQuery<Boost[]>({queryKey:[key],queryFn:()=>viewerApi(admin?'registration/admin/boosts':'registration/boosts'),refetchInterval:30000,retry:false});
 const plans=useQuery<{plans:{id:string;price:number;enabled:boolean}[]}>({queryKey:['boost-plans'],queryFn:()=>viewerApi('registration/settings'),enabled:!admin});
 async function action(path:string,body:unknown){setBusy(true);setError('');try{await viewerApi(path,body);await client.invalidateQueries({queryKey:[key]});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className={box}><h2 className="font-editorial text-2xl">{admin?'Profile boost requests':'Upgrade / boost your profile'}</h2><p className="mt-3 text-sm text-muted-foreground">{admin?'Confirm payment separately before activating. A boost never bypasses profile approval.':'Request a plan any time. Our team will arrange payment and activate your boost after confirmation. Your profile must also be approved to appear publicly.'}</p>{!admin && <div className="mt-5 grid gap-3 sm:grid-cols-2">{plans.data?.plans.filter(p=>p.enabled).map(p=><div key={p.id} className="rounded-xl border border-accent/20 p-4"><h3 className="capitalize">{p.id === 'quarterly' ? 'Quarterly' : 'Annual'}</h3><p className="my-3 text-2xl text-accent">₹{p.price}</p><button className={button} disabled={busy||q.data?.some(b=>b.status==='Pending')} onClick={()=>action('registration/boosts',{plan:p.id})}>Request boost</button></div>)}</div>}<p role="alert" className="mt-3 text-primary">{error || (q.isError ? (q.error as Error).message : '')}</p>{q.isLoading && <p>Loading requests…</p>}{q.data?.map(b=><article key={b.id} className="mt-4 rounded-xl border border-foreground/10 p-4"><p>{b.name && `${b.name} · `}<span className="capitalize">{b.plan}</span> · ₹{b.price} · {b.status==='Approved'&&b.expires&&Date.parse(b.expires)<Date.now()?'Expired':b.status}</p><p className="mt-2 text-xs text-muted-foreground">Requested {new Date(b.created_at).toLocaleString()}{b.expires && ` · Ends ${new Date(b.expires).toLocaleString()}`}</p>{admin&&b.status==='Pending'&&<div className="mt-3 flex gap-3"><button className={button} disabled={busy} onClick={()=>action(`registration/admin/boosts/${b.id}/review`,{status:'Approved'})}>Payment confirmed · activate</button><button className={button} disabled={busy} onClick={()=>action(`registration/admin/boosts/${b.id}/review`,{status:'Rejected'})}>Reject</button></div>}</article>)}</section>;
}
