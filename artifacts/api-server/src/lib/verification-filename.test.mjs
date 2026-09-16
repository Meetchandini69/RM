import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verificationFilename, verificationType } from './verification-filename.ts';

test('restores provider filenames after repeated browser downloads', () => {
 for (const filename of ['googlec51b28265cc4196c.html', 'BingSiteAuth.xml', 'yandex_123abc.html']) {
  assert.equal(verificationFilename(filename), filename);
  for (const number of [1, 2, 12]) {
   const duplicate = filename.replace(/\.(html|xml)$/, ` (${number}).$1`);
   assert.equal(verificationFilename(duplicate), filename);
   assert.equal(verificationType(duplicate), null);
  }
 }
});

test('rejects paths, unsupported files, and malformed suffixes', () => {
 for (const value of [null, 123, '../googleabc (1).html', 'googleabc.html.exe', 'unknown (1).html', 'googleabc (0).html', 'googleabc (1) (2).html']) {
  assert.equal(verificationFilename(value), null);
 }
});
