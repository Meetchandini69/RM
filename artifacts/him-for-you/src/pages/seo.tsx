import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { viewerApi } from './viewer-access';
type SeoPage={path:string;label:string;title:string;description:string;canonical:string;canonicalOverride?:string;noindex:boolean;private:boolean};
type SeoSettings={siteUrl:string;pages:SeoPage[];files:{filename:string;uploaded_at:string}[]};
const field='mt-2 w-full rounded-xl border border-foreground/20 bg-background px-4 py-3 text-sm';
const button='rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent disabled:opacity-50';
export function PageMeta() {
 const [location]=useLocation();
 const path=location.split('?')[0];
 const q=useQuery<SeoPage>({queryKey:['seo-page',path],queryFn:()=>viewerApi('seo/page?path='+encodeURIComponent(path)),refetchInterval:60000});
 useEffect(()=>{
  if(!q.data)return;
  const meta=q.data;
  document.title=meta.title;
  function setMeta(selector:string,attrs:Record<string,string>){let el=document.head.querySelector(selector);if(!el){el=document.createElement(selector.startsWith('link')?'link':'meta');document.head.appendChild(el);}for(const [key,value]of Object.entries(attrs))el.setAttribute(key,value);}
  setMeta('meta[name="description"]',{name:'description',content:meta.description});
  setMeta('meta[name="robots"]',{name:'robots',content:meta.noindex?'noindex, nofollow':'index, follow'});
  const canonical=meta.canonical || window.location.origin+path;
  setMeta('link[rel="canonical"]',{rel:'canonical',href:canonical});
  for(const [property,content]of [['og:title',meta.title],['og:description',meta.description],['og:url',canonical]])setMeta(`meta[property="${property}"]`,{property,content});
  for(const [name,content]of [['twitter:title',meta.title],['twitter:description',meta.description]])setMeta(`meta[name="${name}"]`,{name,content});
 },[path,q.data]);
 return null;
}
export function SeoAdmin(){
 const client=useQueryClient();
 const q=useQuery<SeoSettings>({queryKey:['admin-seo'],queryFn:()=>viewerApi('registration/admin/seo'),retry:false});
 const [search,setSearch]=useState(''); const [draft,setDraft]=useState<SeoPage|null>(null);
 const [origin,setOrigin]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function save(path:string,body:unknown){setBusy(true);setMessage('');try{await viewerApi(path,body);await client.invalidateQueries({queryKey:['admin-seo']});await client.invalidateQueries({queryKey:['seo-page']});setMessage('Saved successfully.');return true;}catch(e){setMessage((e as Error).message);return false;}finally{setBusy(false);}}
 if(q.isLoading)return <p className="mt-8">Loading SEO pages…</p>;
 if(q.isError||!q.data)return <div className="mt-8"><p role="alert">Could not load SEO settings.</p><button className={button} onClick={()=>q.refetch()}>Retry</button></div>;
 const data=q.data;const matches=data.pages.filter(p=>`${p.label} ${p.path}`.toLowerCase().includes(search.toLowerCase()));
 return <section className="mt-8 space-y-7"><div><h2 className="font-editorial text-3xl">SEO & Sitemaps</h2><p className="mt-3 text-sm text-muted-foreground">Manage metadata for every site page, configured city and published profile. New public pages appear here automatically.</p></div>
 <p role="status" className="text-accent">{message}</p>
 <form className="rounded-2xl border border-foreground/15 bg-card p-5" onSubmit={async e=>{e.preventDefault();if(await save('registration/admin/seo/site',{siteUrl:origin??data.siteUrl}))setOrigin(null);}}><label className="text-sm">Public website URL<input className={field} required type="url" value={origin??data.siteUrl} onChange={e=>setOrigin(e.target.value)} placeholder="https://yourdomain.com" /></label><p className="mt-2 text-xs text-muted-foreground">Used for automatic canonical URLs and sitemap links. Enter your custom domain without a page path.</p><button className={`${button} mt-4`} disabled={busy}>Save website URL</button></form>
 <div className="rounded-2xl border border-foreground/15 bg-card p-5"><h3 className="font-editorial text-2xl">Page metadata</h3><input className={field} aria-label="Search SEO pages" placeholder="Search by page name or URL…" value={search} onChange={e=>setSearch(e.target.value)} /><p className="mt-3 text-xs text-muted-foreground">{matches.length} pages · Account and admin pages always use noindex and are excluded from sitemaps.</p><div className="mt-4 max-h-80 overflow-auto divide-y divide-white/10">{matches.map(p=><button key={p.path} type="button" disabled={busy} onClick={()=>setDraft({...p,canonical:p.canonicalOverride||''})} className={`flex w-full items-center justify-between gap-3 px-2 py-3 text-left ${draft?.path===p.path?'bg-accent/10':''}`}><span><span className="block text-sm">{p.label}</span><span className="text-xs text-muted-foreground">{p.path}</span></span><span className="text-xs text-accent">{p.noindex?'Noindex':'Public'} · Edit</span></button>)}</div>
 {draft&&<form key={draft.path} className="mt-6 grid gap-4 border-t border-white/10 pt-5" onSubmit={async e=>{e.preventDefault();await save('registration/admin/seo/page',draft);}}><h4 className="font-editorial text-xl">Editing {draft.path}</h4><label className="text-sm">Meta title<input required maxLength={200} className={field} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} /><span className="text-xs text-muted-foreground">{draft.title.length} characters</span></label><label className="text-sm">Meta description<textarea required maxLength={1000} rows={3} className={field} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} /><span className="text-xs text-muted-foreground">{draft.description.length} characters</span></label><label className="text-sm">Canonical URL<input type="url" className={field} value={draft.canonical} onChange={e=>setDraft({...draft,canonical:e.target.value})} placeholder={data.siteUrl?data.siteUrl+draft.path:'Automatic from website URL'} /><span className="text-xs text-muted-foreground">Leave blank to use this page’s URL automatically.</span></label><label className="flex gap-3 text-sm"><input type="checkbox" checked={draft.noindex} disabled={draft.private} onChange={e=>setDraft({...draft,noindex:e.target.checked})} />Exclude from search engines and sitemaps (noindex)</label><button disabled={busy} className={button}>Save page metadata</button></form>}</div>
 <div className="rounded-2xl border border-foreground/15 bg-card p-5"><h3 className="font-editorial text-2xl">Webmaster verification file</h3><p className="mt-2 text-sm text-muted-foreground">Upload the original Google Search Console HTML file, BingSiteAuth.xml, or Yandex HTML verification file. Maximum 32 KB. The file is served at the website root with its original filename.</p><input className="mt-4 block w-full text-sm" type="file" accept=".html,.xml" disabled={busy} aria-label="Upload webmaster verification file" onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;if(file.size>32768){setMessage('Choose a file smaller than 32 KB.');input.value='';return;}try{await save('registration/admin/seo/verification',{filename:file.name,content:await file.text()});}catch{setMessage('Could not read the file.');}input.value='';}} /><ul className="mt-4 space-y-3">{data.files.map(f=><li key={f.filename} className="flex flex-wrap items-center justify-between gap-3"><a className="break-all text-sm text-accent" href={'/'+f.filename} target="_blank" rel="noreferrer">/{f.filename}</a><button disabled={busy} className={button} onClick={()=>save('registration/admin/seo/verification/delete',{filename:f.filename})}>Remove</button></li>)}</ul></div>
 <div className="rounded-2xl border border-foreground/15 bg-card p-5"><h3 className="font-editorial text-2xl">Generated sitemaps</h3><p className="mt-2 text-sm text-muted-foreground">Sitemaps regenerate on request from public canonical pages and approved profiles. Metadata and approval changes are included automatically.</p>{!data.siteUrl&&<p className="mt-3 text-primary">Save your public website URL above to enable generation.</p>}<div className="mt-4 flex flex-wrap gap-3"><a className={button} href="/sitemap.xml" target="_blank" rel="noreferrer">Generate / view sitemap.xml</a><a className={button} href="/sitemap.html" target="_blank" rel="noreferrer">Generate / view sitemap.html</a><a className={button} href="/robots.txt" target="_blank" rel="noreferrer">View robots.txt</a></div></div>
 </section>;
}
