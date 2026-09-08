// Shared by Cloudflare Pages and Vite's development HTML transform.
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function seoFilePath(path) {
 if(path==='/sitemap.xml')return '/api/seo/sitemap/xml';
 if(path==='/sitemap.html')return '/api/seo/sitemap/html';
 if(path==='/robots.txt')return '/api/seo/sitemap/robots';
 if(/^\/(google[a-zA-Z0-9_-]+\.html|yandex_[a-zA-Z0-9_-]+\.html|BingSiteAuth\.xml)$/.test(path))return '/api/seo/files'+path;
 return null;
}
export function injectSeo(html, meta, origin) {
 const canonical=meta.canonical || origin+meta.path;
 const clean=html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'')
  .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:title|og:description|og:url|twitter:title|twitter:description)["'][^>]*>/gi,'')
  .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi,'');
 const tags=`<title>${escapeHtml(meta.title)}</title>\n<meta name="description" content="${escapeHtml(meta.description)}">\n<link rel="canonical" href="${escapeHtml(canonical)}">\n<meta name="robots" content="${meta.noindex?'noindex, nofollow':'index, follow'}">\n<meta property="og:title" content="${escapeHtml(meta.title)}">\n<meta property="og:description" content="${escapeHtml(meta.description)}">\n<meta property="og:url" content="${escapeHtml(canonical)}">\n<meta name="twitter:title" content="${escapeHtml(meta.title)}">\n<meta name="twitter:description" content="${escapeHtml(meta.description)}">\n`;
 return clean.replace(/<\/head>/i,()=>tags+'</head>');
}
