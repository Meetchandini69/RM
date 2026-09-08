import assert from 'node:assert/strict';
import { injectSeo, seoFilePath } from './seo-render.mjs';
import { onRequest } from '../functions/_middleware.js';
const shell='<!doctype html><html><head><title>Old</title><meta name="description" content="Old"><meta property="og:title" content="Old"><link rel="canonical" href="https://old.test"><meta name="robots" content="index, follow"></head><body><div id="root"></div></body></html>';
const meta={path:'/men',title:'New <title> & "quotes"',description:'Safe </head><script>alert(1)</script>',canonical:'https://example.test/men',noindex:false,found:true};
const output=injectSeo(shell,meta,'https://example.test');
assert.equal((output.match(/<title>/g)||[]).length,1);assert.equal((output.match(/rel="canonical"/g)||[]).length,1);
assert.ok(output.includes('&lt;script&gt;'));assert.ok(!output.includes('<script>alert(1)</script>'));assert.ok(!output.includes('https://old.test'));
assert.equal(seoFilePath('/googleabc.html'),'/api/seo/files/googleabc.html');assert.equal(seoFilePath('/sitemap.xml'),'/api/seo/sitemap/xml');assert.equal(seoFilePath('/../index.html'),null);
const originalFetch=globalThis.fetch;let lastRequest;
globalThis.fetch=async(url,options)=>{lastRequest={url:String(url),options};if(String(url).includes('sitemap'))return new Response('<urlset/>',{headers:{'content-type':'application/xml'}});if(String(url).includes('/files/'))return new Response('google-site-verification: googleabc.html');return Response.json(meta);};
const env={API_ORIGIN:'https://api.example.test',API_PROXY_SECRET:'x'.repeat(32)};
const context=(path)=>({request:new Request('https://example.test'+path,{headers:{cookie:'do-not-forward'}}),env,next:async()=>new Response(shell,{headers:{'content-type':'text/html','etag':'old','content-length':'999'}})});
try{
 let res=await onRequest(context('/men'));assert.equal(res.status,200);assert.equal(res.headers.get('etag'),null);assert.equal(res.headers.get('x-robots-tag'),'index, follow');assert.ok((await res.text()).includes('https://example.test/men'));assert.ok(!lastRequest.options.headers.cookie);
 res=await onRequest(context('/sitemap.xml'));assert.equal(await res.text(),'<urlset/>');assert.ok(lastRequest.url.endsWith('/api/seo/sitemap/xml'));
 res=await onRequest(context('/googleabc.html'));assert.equal(await res.text(),'google-site-verification: googleabc.html');
 meta.found=false;meta.noindex=true;res=await onRequest(context('/not-found'));assert.equal(res.status,404);assert.equal(res.headers.get('x-robots-tag'),'noindex, nofollow');
 globalThis.fetch=async()=>{throw Error('offline');};res=await onRequest(context('/men'));assert.equal(res.status,200);assert.ok((await res.text()).includes('id="root"'));assert.equal(res.headers.get('x-seo-status'),'fallback');
 res=await onRequest(context('/admin'));assert.equal(res.status,200);assert.equal(res.headers.get('x-robots-tag'),'noindex, nofollow');
 globalThis.fetch=async()=>new Response('Missing route',{status:404});res=await onRequest(context('/men'));assert.equal(res.status,200);
 globalThis.fetch=async()=>new Response('<html>invalid json</html>');res=await onRequest(context('/admin'));assert.equal(res.status,200);
 globalThis.fetch=async()=>{throw Error('offline');};res=await onRequest(context('/sitemap.xml'));assert.equal(res.status,503);
 console.log('PASS: Cloudflare metadata rendering, tag deduplication, escaping, root sitemap/verification routing, no cookie forwarding, 404/noindex and outage handling.');
}finally{globalThis.fetch=originalFetch;}
