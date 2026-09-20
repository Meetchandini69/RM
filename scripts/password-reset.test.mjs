import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { scryptSync } from 'node:crypto';
import ts from 'typescript';

const require = createRequire(resolve('artifacts/api-server/package.json'));
let pending, password = 'old-hash', sessions = 2, telegram = [], failTelegram = false;
const pool = {
  async query(sql, args = []) {
    if (sql.startsWith('SELECT token')) return { rows: [{ token: 'admin' }] };
    if (sql.startsWith('INSERT INTO password_reset_requests')) {
      if (pending || args[2] !== '+919876543210') return { rows: [] };
      pending = { id: args[0], member: 'member', password: args[1] };
      return { rows: [{ id: pending.id, member: pending.member }] };
    }
    if (sql.startsWith("SELECT record->>'displayName'")) return { rows: [{ name: 'Test Member' }] };
    if (sql.startsWith('SELECT p.id')) return { rows: pending ? [{ id: pending.id, name: 'Test Member', mobile: '+919876543210', status: 'Pending' }] : [] };
    if (sql.startsWith('SELECT member, password')) return { rows: pending && pending.id === args[0] ? [pending] : [] };
    if (sql.startsWith('UPDATE registrations SET password')) password = args[0];
    else if (sql.startsWith('DELETE FROM registration_sessions')) sessions = 0;
    else if (sql.startsWith('UPDATE password_reset_requests')) pending = undefined;
    else if (!['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) throw Error(`Unexpected query: ${sql}`);
    return { rows: [] };
  },
  async connect() { return { query: pool.query.bind(pool), release() {} }; },
};
const mod = { exports: {} };
const source = ts.transpileModule(readFileSync('artifacts/api-server/src/routes/registration.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
new Function('require', 'module', 'exports', source)(name => {
  if (name === '@workspace/db') return { pool };
  if (name === '@workspace/api-zod' || name.includes('member-access')) return {};
  if (name.includes('/telegram')) return { sendAdminTelegram: async text => { telegram.push(text); if (failTelegram) throw Error('Telegram unavailable'); } };
  return require(name);
}, mod, mod.exports);
const app = require('express')(); app.use(require('express').json()); app.use(mod.exports.default);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
async function call(path, body, admin = false) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/registration/${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(admin ? { cookie: 'ram_admin=test' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
try {
  const body = { mobile: '+91 98765 43210', password: 'new-password-123', confirmPassword: 'new-password-123' };
  assert.equal((await call('password-resets', { ...body, confirmPassword: 'mismatch' })).status, 400);
  assert.equal((await call('password-resets', body)).status, 202);
  assert.equal(password, 'old-hash');
  const original = { ...pending };
  const [salt, hash] = pending.password.split(':');
  assert.equal(scryptSync(body.password, salt, 64).toString('hex'), hash);
  assert.ok(!telegram[0].includes(body.password));
  assert.equal((await call('password-resets', { ...body, password: 'different-password', confirmPassword: 'different-password' })).status, 202);
  assert.deepEqual(pending, original); assert.equal(telegram.length, 1);
  assert.equal((await call('admin/password-resets')).status, 401);
  const queue = await call('admin/password-resets', undefined, true);
  assert.equal(queue.data.length, 1); assert.equal(queue.data[0].password, undefined);
  const review = `admin/password-resets/${pending.id}/review`;
  assert.equal((await call(review, { status: 'Approved', identityVerified: true })).status, 401);
  assert.equal((await call(review, { status: 'Approved' }, true)).status, 400);
  assert.equal(password, 'old-hash');
  assert.equal((await call(review, { status: 'Approved', identityVerified: true }, true)).status, 200);
  assert.equal(password, original.password); assert.equal(sessions, 0); assert.equal(pending, undefined);
  assert.equal((await call(review, { status: 'Approved', identityVerified: true }, true)).status, 409);
  failTelegram = true;
  assert.equal((await call('password-resets', body)).status, 202); assert.ok(pending);
  assert.equal((await call(`admin/password-resets/${pending.id}/review`, { status: 'Rejected' }, true)).status, 200);
  assert.equal(password, original.password); assert.equal(pending, undefined);
  const unknown = await call('password-resets', { ...body, mobile: '+919999999999' });
  assert.equal(unknown.status, 202); assert.equal(pending, undefined);
  console.log('Password reset route checks passed (database and Telegram mocked).');
} finally { server.close(); }
