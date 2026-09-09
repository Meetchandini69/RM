import { activeMembership, paymentTelegram } from "../lib/member-access";
import { discoveryOptions, locationSlug } from "../lib/discovery-options";
import { Router, type RequestHandler } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { pool } from '@workspace/db';
import { requireViewer } from './viewers';
import { requireAdmin, recordView, settings } from './registration';
import { sendAdminTelegram } from '../lib/telegram';
const router = Router();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const requireMember: RequestHandler = async (req, res, next) => {
 const token = req.cookies?.ram_session;
 const row = typeof token === 'string' ? (await pool.query('SELECT record FROM registrations JOIN registration_sessions ON registrations.id = registration_sessions.member WHERE token = $1 AND expires > $2', [digest(token), Date.now()])).rows[0] : null;
 if (!row || !['Approved', 'Profile pending', 'Profile rejected'].includes(row.record.reviewStatus)) { res.status(401).json({message:'Please log in to your approved member account.'}); return; }
 res.locals.member = recordView(row.record); res.setHeader('Cache-Control', 'no-store'); next();
};
router.get('/viewer/interests', requireViewer, async (_req, res) => {
 res.json((await pool.query('SELECT id, profile_slug, profile_name, note, created_at, delivery FROM member_interests WHERE viewer_id = $1 ORDER BY created_at DESC', [res.locals.viewer.id])).rows);
});
router.post('/registration/logout', async (req, res) => {
 if (typeof req.cookies?.ram_session === 'string') await pool.query('DELETE FROM registration_sessions WHERE token = $1', [digest(req.cookies.ram_session)]);
 res.clearCookie('ram_session', {path:'/api/registration'}).json({success:true});
});
router.get('/registration/interests', requireMember, async (_req, res) => {
 res.json((await pool.query("SELECT i.id, i.note, i.created_at, v.record->>'name' AS name FROM member_interests i JOIN viewers v ON v.id = i.viewer_id WHERE i.profile_slug = $1 ORDER BY i.created_at DESC", [`member-${res.locals.member.id}`])).rows);
});
router.get('/registration/boosts', requireMember, async (_req, res) => res.json((await pool.query('SELECT * FROM profile_boosts WHERE member = $1 ORDER BY created_at DESC', [res.locals.member.id])).rows));
router.post('/registration/boosts', requireMember, async (req, res) => {
 const plan = (await settings()).plans.find(p => p.id === req.body.plan && p.enabled);
 if (!plan) {res.status(400).json({message:'Choose an available boost plan.'}); return;}
 const member = res.locals.member;
 const result = await pool.query("INSERT INTO profile_boosts (id,member,plan,price) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *", [randomUUID(),member.id,plan.id,plan.price]);
 if (!result.rows.length) {res.status(409).json({message:'You already have a pending boost request.'}); return;}
 try { await sendAdminTelegram(`Profile boost requested\nMember: ${member.displayName}\nPlan: ${plan.id}\nPrice: INR ${plan.price}\nReview payment and activate in admin.`); } catch { /* Request remains in the admin queue. */ }
 res.status(201).json(result.rows[0]);
});
router.get('/registration/admin/boosts', requireAdmin, async (_req,res) => res.json((await pool.query("SELECT b.*, r.record->>'displayName' AS name FROM profile_boosts b JOIN registrations r ON r.id=b.member ORDER BY b.created_at DESC")).rows));
router.post('/registration/admin/boosts/:id/review', requireAdmin, async (req,res) => {
 if (!['Approved','Rejected'].includes(req.body.status)) {res.status(400).json({message:'Choose approve or reject.'}); return;}
 const result = await pool.query("UPDATE profile_boosts SET status=$1, expires=CASE WHEN $1='Approved' THEN now() + CASE plan WHEN 'weekly' THEN interval '7 days' WHEN 'monthly' THEN interval '30 days' WHEN 'halfyearly' THEN interval '6 months' WHEN 'yearly' THEN interval '1 year' ELSE interval '3 months' END ELSE NULL END WHERE id=$2 AND status='Pending' RETURNING *", [req.body.status,req.params.id]);
 if (!result.rows.length) {res.status(409).json({message:'Request already reviewed or not found.'}); return;}
 if (req.body.status === 'Approved') {
  const payment=result.rows[0];
  await pool.query("UPDATE registrations SET record = record || jsonb_build_object('listing', $1::text, 'listingPrice', $2::numeric) WHERE id=$3", [payment.plan === 'yearly' ? 'yearly' : 'quarterly',payment.price,payment.member]);
 }
 res.json(result.rows[0]);
});
router.get('/discovery-options', async (_req, res) => res.json(await discoveryOptions()));
router.get('/registration/admin/discovery-options', requireAdmin, async (_req, res) => res.json(await discoveryOptions()));
router.post('/registration/admin/discovery-options', requireAdmin, async (req, res) => {
 const result: { locations: string[]; lookingFor: string[] } = { locations: [], lookingFor: [] };
 for (const key of ['locations', 'lookingFor'] as const) {
  const values = req.body?.[key];
  if (!Array.isArray(values) || values.length < 1 || values.length > 100 || values.some(v => typeof v !== 'string' || !v.trim() || v.trim().length > 80)) {
   res.status(400).json({ message: 'Provide 1?100 options in each list, with at most 80 characters per option.' }); return;
  }
  result[key] = values.map((v: string) => v.trim());
  const normalized = result[key].map(v => key === 'locations' ? locationSlug(v) : v.toLowerCase());
  if (normalized.some(v => !v) || new Set(normalized).size !== normalized.length) {
   res.status(400).json({ message: 'Remove duplicate or invalid options before saving.' }); return;
  }
 }
 await pool.query('INSERT INTO discovery_settings VALUES (1, $1) ON CONFLICT(id) DO UPDATE SET value = excluded.value', [JSON.stringify(result)]);
 res.json(result);
});
router.get('/registration/membership',requireMember,async(_req,res)=>{
 res.json({membership:await activeMembership(res.locals.member.id),telegram:await paymentTelegram(),plans:(await settings()).plans});
});
router.get('/registration/admin/payment-settings',requireAdmin,async(_req,res)=>res.json({telegram:await paymentTelegram()}));
router.post('/registration/admin/payment-settings',requireAdmin,async(req,res)=>{
 const username=typeof req.body.telegram==='string'?req.body.telegram.trim().replace(/^https:\/\/t\.me\//i,'').replace(/^@/,''):'';
 if(!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)){res.status(400).json({message:'Enter a valid Telegram username or https://t.me/username link.'});return;}
 await pool.query('INSERT INTO membership_payment_settings VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET username=excluded.username',[username]);res.json({telegram:username});
});
export default router;
