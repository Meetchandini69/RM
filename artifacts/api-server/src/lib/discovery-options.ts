import { pool } from '@workspace/db';
export const defaultDiscoveryOptions = {
 locations: ['Coimbatore','Chennai','Bangalore','Hyderabad','Mumbai','Delhi','Pune','Kochi','Madurai','Trichy'],
 lookingFor: ['Dating','Companionship','Dinner & Social Companion','Travel Companion','Events & Parties'],
};
export const locationSlug = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
export async function discoveryOptions(): Promise<typeof defaultDiscoveryOptions> {
 const row = (await pool.query('SELECT value FROM discovery_settings WHERE id = 1')).rows[0];
 return row?.value || defaultDiscoveryOptions;
}
