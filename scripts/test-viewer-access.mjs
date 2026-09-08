import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url));
const express = require('express');
const rows = new Map(), sessions = new Map();
let notifications = 0;
const pool = { async query(sql, args = []) {
  if (sql.startsWith('INSERT INTO viewers')) { if ([...rows.values()].some(r => r.contact === args[1])) return { rows: [] }; const row = { id: args[0], contact: args[1], password: args[2], record: JSON.parse(args[3]) }; rows.set(row.id, row); return { rows: [{ id: row.id }] }; }
  if (sql.startsWith('UPDATE viewers')) { const row = rows.get(args[1]); if (!row) return { rows: [] }; row.record[sql.includes('notificationStatus') ? 'notificationStatus' : 'status'] = args[0]; return { rows: [row] }; }
  if (sql.startsWith('SELECT * FROM viewers')) return { rows: [...rows.values()].filter(r => r.contact === args[0]) };
  if (sql.startsWith('SELECT record FROM viewers JOIN')) { const session = sessions.get(args[0]); const row = session && session.expires > args[1] ? rows.get(session.member) : null; return { rows: row?.record.status === 'Approved' ? [row] : [] }; }
  if (sql.startsWith('SELECT record FROM viewers ORDER')) return { rows: [...rows.values()] };
  if (sql.startsWith('INSERT INTO viewer_sessions')) sessions.set(args[0], { member: args[1], expires: args[2] });
  else if (sql.startsWith('DELETE FROM viewer_sessions')) for (const [key, value] of sessions) if (sql.includes('member =') ? value.member === args[0] : sql.includes('token =') ? key === args[0] : value.expires < args[0]) sessions.delete(key);
  else throw Error(`Unhandled SQL: ${sql}`);
  return { rows: [] };
} };
const source = readFileSync(new URL('../artifacts/api-server/src/routes/viewers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => name === '@workspace/db' ? { pool } : name === './registration' ? { requireAdmin: (req, res, next) => req.headers['x-test-admin'] === 'yes' ? next() : res.sendStatus(401) } : name === '../lib/telegram' ? { sendAdminTelegram: async () => { notifications++; } } : require(name), module, module.exports);
const app = express(); app.use(express.json()); app.use('/api', module.exports.default); app.post('/api/test-interest', module.exports.requireViewer, (_req, res) => res.json({ success: true }));
const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/`;
async function request(path, body, headers = {}) { return fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
try {
  const details = { name: 'Test Browser', contactType: 'telegram', contact: '@Test_user', lookingFor: 'Dating', age: 25, location: 'Chennai', password: 'test-password-123' };
  assert.equal((await request('test-interest', {})).status, 403);
  assert.equal((await request('viewer/register', { ...details, age: 17 })).status, 400);
  assert.equal((await request('viewer/register', details)).status, 201); assert.equal(notifications, 1);
  assert.equal((await request('viewer/register', details)).status, 409);
  assert.equal((await request('viewer/login', details)).status, 403);
  assert.equal((await request('viewer/login', { ...details, password: 'wrong' })).status, 401);
  const id = [...rows.keys()][0];
  assert.equal((await request(`registration/admin/viewers/${id}/review`, { status: 'Approved' })).status, 401);
  assert.equal((await request(`registration/admin/viewers/${id}/review`, { status: 'Approved' }, { 'x-test-admin': 'yes' })).status, 200);
  const login = await request('viewer/login', details); assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await request('viewer/me', null, { cookie })).json()).name, details.name);
  assert.equal((await request('test-interest', {}, { cookie })).status, 200);
  await request(`registration/admin/viewers/${id}/review`, { status: 'Rejected' }, { 'x-test-admin': 'yes' });
  assert.equal((await request('test-interest', {}, { cookie })).status, 403);
  assert.equal(await (await request('viewer/me', null, { cookie })).json(), null);
  console.log('PASS: validation, duplicate prevention, pending/wrong-password login, admin protection, approval, session access, interest gate and revocation. Database and Telegram mocked; no messages sent.');
} finally { server.closeAllConnections(); server.close(); }
