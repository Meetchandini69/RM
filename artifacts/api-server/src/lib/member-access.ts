import { pool } from '@workspace/db';
export async function activeMembership(member:string) {
 return (await pool.query("SELECT plan, expires FROM profile_boosts WHERE member=$1 AND status='Approved' AND expires > now() ORDER BY expires DESC LIMIT 1",[member])).rows[0] || null;
}
export async function paymentTelegram() {
 return (await pool.query('SELECT username FROM membership_payment_settings WHERE id=1')).rows[0]?.username || '';
}
