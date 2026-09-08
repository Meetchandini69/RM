import { Router } from 'express';
import { pool } from '@workspace/db';
import { requireAdmin } from './registration';
import { allProfiles } from './discovery';
import { discoveryOptions, locationSlug } from '../lib/discovery-options';
const router = Router();
type SeoPage = { path:string; label:string; title:string; description:string; canonical:string; noindex:boolean; private:boolean };
const pages: [string,string,boolean?][] = [
 ['/','Home'], ['/men','Browse Men'], ['/premium','Premium Membership'], ['/join','Register as a Man'], ['/unlock','Register to Browse'], ['/login','Log In',true],
 ['/terms','Terms and Conditions'], ['/privacy','Privacy Policy'], ['/sitemap.html','Sitemap'],
 ['/dashboard','Men’s Dashboard',true], ['/my-profile','My Profile',true], ['/complete-profile','Complete Profile',true],
 ['/member-interests','Received Interests',true], ['/boost-profile','Boost Profile',true], ['/account','Women’s Dashboard',true],
 ['/account/profile','My Account Profile',true], ['/account/interests','Sent Interests',true], ['/admin','Admin',true], ['/admin/registration','Registration Admin',true],
];
const description = 'Discover men for dating, companionship, travel, dinners, and meaningful private connections.';
export const escapeSeo = (text:string) => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function validSeoUrl(value:unknown, originOnly=false): value is string {
 if(typeof value!=='string' || value.length>2048) return false;
 try { const u=new URL(value); return (u.protocol==='https:' || (u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname))) && !u.username && !u.password && !u.hash && (!originOnly || (u.pathname==='/' && !u.search)); } catch { return false; }
}
export async function seoSiteUrl() { return (await pool.query('SELECT site_url FROM seo_settings WHERE id=1')).rows[0]?.site_url || ''; }
export async function seoCatalog():Promise<SeoPage[]> {
 const [profiles,options,stored,origin]=await Promise.all([allProfiles(),discoveryOptions(),pool.query('SELECT * FROM seo_pages'),seoSiteUrl()]);
 const catalog:SeoPage[]=pages.map(([path,label,privatePage=false])=>({path,label,title:`${label} | Men For You`,description,canonical:origin?origin+(path==='/'?'/':path):'',noindex:privatePage,private:privatePage}));
 for(const city of options.locations)catalog.push({path:`/men/${locationSlug(city)}`,label:`Men in ${city}`,title:`Browse Men in ${city} | Men For You`,description:`Discover men in ${city} for dating, companionship and meaningful connections.`,canonical:'',noindex:false,private:false});
 for(const p of profiles)catalog.push({path:`/profile/${p.slug}`,label:`${p.displayName} – ${p.city}`,title:`${p.displayName}, ${p.age} in ${p.city} | Men For You`,description:p.headline || description,canonical:'',noindex:false,private:false});
 return catalog.map(page=>{const override=stored.rows.find(r=>r.path===page.path);return {...page,title:override?.title || page.title,description:override?.description || page.description,canonicalOverride:override?.canonical || '',canonical:override?.canonical || (origin?origin+page.path:''),noindex:page.private || !!override?.noindex};});
}
router.get('/seo/page',async(req,res)=>{
 const path=typeof req.query.path==='string'?req.query.path:'/';
 const page=(await seoCatalog()).find(p=>p.path===path);
 res.json(page?{...page,found:true}:{path,title:'Page not found | Men For You',description:'This page could not be found.',canonical:'',noindex:true,found:false});
});
router.get('/registration/admin/seo',requireAdmin,async(_req,res)=>{
 const [siteUrl,pages,files]=await Promise.all([seoSiteUrl(),seoCatalog(),pool.query('SELECT filename, uploaded_at FROM seo_verification_files ORDER BY filename')]);res.json({siteUrl,pages,files:files.rows});
});
router.post('/registration/admin/seo/site',requireAdmin,async(req,res)=>{
 if(!validSeoUrl(req.body?.siteUrl,true)){res.status(400).json({message:'Enter your website origin, such as https://example.com, without a page path.'});return;}
 const siteUrl=new URL(req.body.siteUrl).origin;
 await pool.query('INSERT INTO seo_settings VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET site_url=excluded.site_url',[siteUrl]);res.json({siteUrl});
});
router.post('/registration/admin/seo/page',requireAdmin,async(req,res)=>{
 const {path,title,description,canonical,noindex}=req.body || {};
 if(typeof path!=='string'||typeof title!=='string'||!title.trim()||title.length>200||typeof description!=='string'||!description.trim()||description.length>1000||typeof canonical!=='string'||(canonical && !validSeoUrl(canonical))||typeof noindex!=='boolean'){res.status(400).json({message:'Enter a title (up to 200 characters), description (up to 1000), and a valid absolute canonical URL or leave it blank.'});return;}
 const page=(await seoCatalog()).find(p=>p.path===path);if(!page){res.status(404).json({message:'Page not found. Refresh the page list.'});return;}
 await pool.query('INSERT INTO seo_pages (path,title,description,canonical,noindex) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(path) DO UPDATE SET title=excluded.title,description=excluded.description,canonical=excluded.canonical,noindex=excluded.noindex',[path,title.trim(),description.trim(),canonical.trim(),page.private||noindex]);res.json({success:true});
});
export function verificationType(filename:string) {
 if(/^google[a-zA-Z0-9_-]+\.html$/.test(filename)||/^yandex_[a-zA-Z0-9_-]+\.html$/.test(filename))return 'text/html';
 if(filename==='BingSiteAuth.xml')return 'application/xml';
 return null;
}
router.post('/registration/admin/seo/verification',requireAdmin,async(req,res)=>{
 const {filename,content}=req.body||{};
 if(typeof filename!=='string'||filename.length>120||!verificationType(filename)||typeof content!=='string'||!content.trim()||Buffer.byteLength(content)>32768){res.status(400).json({message:'Upload a Google verification HTML file, BingSiteAuth.xml, or Yandex verification HTML file (maximum 32 KB).'});return;}
 if((filename.startsWith('google') && content.trim()!==`google-site-verification: ${filename}`)||(filename==='BingSiteAuth.xml' && (!/<user>\s*[a-z0-9]+\s*<\/user>/i.test(content)||!/<users>/i.test(content)))||(filename.startsWith('yandex_')&&!/verification/i.test(content))){res.status(400).json({message:'The file does not match the expected verification format.'});return;}
 await pool.query('INSERT INTO seo_verification_files (filename,content) VALUES ($1,$2) ON CONFLICT(filename) DO UPDATE SET content=excluded.content, uploaded_at=now()',[filename,content]);res.json({success:true,filename});
});
router.post('/registration/admin/seo/verification/delete',requireAdmin,async(req,res)=>{
 if(typeof req.body?.filename!=='string'||!verificationType(req.body.filename)){res.status(400).json({message:'Invalid verification filename.'});return;}
 await pool.query('DELETE FROM seo_verification_files WHERE filename=$1',[req.body.filename]);res.json({success:true});
});
router.get('/seo/files/:filename',async(req,res)=>{
 const filename=String(req.params.filename);const type=verificationType(filename);
 if(!type){res.sendStatus(404);return;}
 const row=(await pool.query('SELECT content FROM seo_verification_files WHERE filename=$1',[filename])).rows[0];
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
 if(!row){res.sendStatus(404);return;}res.type(type).send(row.content);
});
router.get('/seo/sitemap/:format',async(req,res)=>{
 if(!['xml','html','robots'].includes(String(req.params.format))){res.sendStatus(404);return;}
 const origin=await seoSiteUrl();
 if(!origin){res.status(503).type('text/plain').send('Set the public website URL in Admin > SEO to generate sitemaps.');return;}
 const catalog=await seoCatalog();
 // Include only canonical, public pages on the configured site; never list account URLs.
 const publicPages=catalog.filter(p=>!p.noindex&&!p.private&&p.canonical===origin+p.path);
 if(req.params.format==='robots'){res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);return;}
 if(req.params.format==='xml'){res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPages.map(p=>`  <url><loc>${escapeSeo(p.canonical)}</loc></url>`).join('\n')}\n</urlset>`);return;}
 const meta=catalog.find(p=>p.path==='/sitemap.html')!;
 res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeSeo(meta.title)}</title><meta name="description" content="${escapeSeo(meta.description)}"><link rel="canonical" href="${escapeSeo(meta.canonical)}"><meta name="robots" content="${meta.noindex?'noindex, nofollow':'index, follow'}"><link rel="icon" href="/rm-logo.png"><style>body{font:16px system-ui;background:#101116;color:#eee;margin:0}main{max-width:960px;margin:auto;padding:48px 24px}a{color:#e3c17b}ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;padding:24px}h1{font:42px Georgia}footer{margin-top:40px;color:#bbb}</style></head><body><main><a href="/">Men For You</a><h1>Sitemap</h1><p>Explore our public pages, cities and approved profiles.</p><ul>${publicPages.map(p=>`<li><a href="${escapeSeo(p.canonical)}">${escapeSeo(p.label)}</a></li>`).join('')}</ul><footer><a href="/sitemap.xml">XML sitemap</a></footer></main></body></html>`);
});
export default router;
