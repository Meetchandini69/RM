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
  return fetch(new URL(path,origin),{headers:{'X-API-Proxy-Secret':env.API_PROXY_SECRET},signal:AbortSignal.timeout(3000),redirect:'error'});
 }
 // Files must never fall back to the application's HTML shell.
 if(special){
  try {const upstream=await api(special);const headers=new Headers(upstream.headers);headers.delete('set-cookie');headers.set('Cache-Control','no-store');return new Response(request.method==='HEAD'?null:upstream.body,{status:upstream.status,headers});}
  catch {return new Response('SEO file temporarily unavailable.',{status:503,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});}
 }
 const page=await context.next();
 if(!page.headers.get('content-type')?.includes('text/html'))return page;
 const headers=new Headers(page.headers);
 for(const key of ['Content-Length','Content-Encoding','ETag'])headers.delete(key);
 headers.set('Cache-Control','no-store');
 const html=request.method==='HEAD'?'':await page.text();
 try {
  const seo=await api('/api/seo/page?path='+encodeURIComponent(url.pathname));
  if(!seo.ok)throw Error('SEO unavailable');
  const meta=await seo.json();
  if(typeof meta.title!=='string'||typeof meta.description!=='string'||typeof meta.found!=='boolean')throw Error('Invalid SEO response');
  headers.set('X-Robots-Tag',meta.noindex?'noindex, nofollow':'index, follow');
  headers.set('X-SEO-Status','applied');
  return new Response(request.method==='HEAD'?null:injectSeo(html,meta,url.origin),{status:meta.found?page.status:404,headers});
 }catch{
  // Metadata is optional: keep the website and admin usable during API outages.
  headers.set('X-SEO-Status','fallback');
  headers.set('X-Robots-Tag','noindex, nofollow');
  const fallback={path:url.pathname,title:'Men For You',description:'Discover Men For You.',canonical:url.origin+url.pathname,noindex:true};
  return new Response(request.method==='HEAD'?null:injectSeo(html,fallback,url.origin),{status:page.status,headers});
 }
}

