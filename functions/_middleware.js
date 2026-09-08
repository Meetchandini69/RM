import { injectSeo, seoFilePath } from '../scripts/seo-render.mjs';
export async function onRequest(context) {
 const { request, env }=context;
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/') || !['GET','HEAD'].includes(request.method))return context.next();
 const special=seoFilePath(url.pathname);
 if(!special && /\.[a-z0-9]+$/i.test(url.pathname))return context.next();
 async function api(path) {
  const origin=new URL(env.API_ORIGIN);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||(env.API_PROXY_SECRET?.length||0)<32)throw Error('API not configured');
  return fetch(new URL(path,origin),{headers:{'X-API-Proxy-Secret':env.API_PROXY_SECRET},signal:AbortSignal.timeout(10000),redirect:'error'});
 }
 try {
  if(special){const upstream=await api(special);const headers=new Headers(upstream.headers);headers.delete('set-cookie');headers.set('Cache-Control','no-store');return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers});}
  const [page,seo]=await Promise.all([context.next(),api('/api/seo/page?path='+encodeURIComponent(url.pathname))]);
  if(!page.headers.get('content-type')?.includes('text/html'))return page;
  if(!seo.ok)throw Error('SEO unavailable');
  const meta=await seo.json();const headers=new Headers(page.headers);
  for(const key of ['Content-Length','Content-Encoding','ETag'])headers.delete(key);
  headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag',meta.noindex?'noindex, nofollow':'index, follow');
  return new Response(request.method==='HEAD'?null:injectSeo(await page.text(),meta,url.origin),{status:meta.found? page.status:404,headers});
 }catch{
  // Avoid returning a misleading indexable SPA shell when SEO storage is unavailable.
  return new Response('The page is temporarily unavailable. Please try again.',{status:503,headers:{'Content-Type':'text/plain','Retry-After':'60','Cache-Control':'no-store'}});
 }
}
