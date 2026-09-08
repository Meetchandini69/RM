import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { viewerApi } from './viewer-access';
type Options = { locations: string[]; lookingFor: string[] };
export function useDiscoveryOptions() {
 return useQuery<Options>({queryKey:['discovery-options'],queryFn:()=>viewerApi('discovery-options'),refetchInterval:30000});
}
export function DiscoveryOptionsAdmin() {
 const client=useQueryClient();
 const q=useQuery<Options>({queryKey:['admin-discovery-options'],queryFn:()=>viewerApi('registration/admin/discovery-options'),retry:false});
 const [draft,setDraft]=useState<{locations:string;lookingFor:string}|null>(null);
 const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false);
 if(q.isLoading)return <p className="mt-8">Loading search options…</p>;
 if(q.isError || !q.data)return <div className="mt-8"><p role="alert">Could not load search options.</p><button onClick={()=>q.refetch()}>Try again</button></div>;
 const value=draft || {locations:q.data.locations.join('\n'),lookingFor:q.data.lookingFor.join('\n')};
 return <form className="mt-8 rounded-2xl border border-foreground/15 bg-card p-6" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage('');try{const data=await viewerApi('registration/admin/discovery-options',{locations:value.locations.split('\n').map(v=>v.trim()).filter(Boolean),lookingFor:value.lookingFor.split('\n').map(v=>v.trim()).filter(Boolean)});client.setQueryData(['admin-discovery-options'],data);setDraft(null);await Promise.all([client.invalidateQueries({queryKey:['discovery-options']}),client.invalidateQueries({queryKey:['/api/cities']})]);setMessage('Saved. Homepage and Browse Men search options are updated.');}catch(err){setMessage((err as Error).message);}finally{setBusy(false);}}}>
 <h2 className="font-editorial text-3xl">Search options</h2><p className="mt-3 text-sm text-muted-foreground">Enter one option per line. Add, remove, or reorder lines to control Location and “I’m looking for” on the homepage and Browse Men. Existing profile details remain saved; search matches the location and preference on each profile.</p>
 <div className="mt-6 grid gap-6 md:grid-cols-2">{(['locations','lookingFor'] as const).map(key=><label className="grid gap-2 text-sm" key={key}>{key==='locations'?'Locations':'I’m looking for'}<textarea required rows={12} value={value[key]} disabled={busy} onChange={e=>setDraft({...value,[key]:e.target.value})} className="w-full resize-y rounded-xl border border-foreground/20 bg-background p-4 leading-7" /></label>)}</div>
 <p className="mt-4 text-sm" role="status">{message}</p><button disabled={busy} className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Save search options'}</button>
 </form>;
}
