export function verificationType(filename: string) {
 if (/^google[a-zA-Z0-9_-]+\.html$/.test(filename) || /^yandex_[a-zA-Z0-9_-]+\.html$/.test(filename)) return 'text/html';
 if (filename === 'BingSiteAuth.xml') return 'application/xml';
 return null;
}

// Browsers append a numbered suffix when the same file is downloaded again.
// Only accept known provider filenames; public URLs must use the original name.
export function verificationFilename(value: unknown): string | null {
 if (typeof value !== 'string' || value.length > 120) return null;
 const filename = value.replace(/ \([1-9]\d*\)(\.(?:html|xml))$/, '$1');
 return verificationType(filename) ? filename : null;
}
