/* Storage adapter: PostgreSQL (managed or embedded PGlite) + Redis (managed or in-memory dev).
 * DATABASE_URL=postgres://... and REDIS_URL=redis://... switch to real managed services.
 * Without them: PGlite (Postgres-compatible, on-disk) and ioredis-mock are used for local dev.
 */
'use strict';
const path = require('path');
const fs = require('fs');

let mode = 'pglite';
let pool = null;
let pglite = null;
let redis = null;

async function init() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: url, max: 10 });
    await pool.query(`CREATE TABLE IF NOT EXISTS world_state (
      id integer PRIMARY KEY, json text NOT NULL, updated_at bigint NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_log (
      id bigserial PRIMARY KEY, at bigint NOT NULL, kind text NOT NULL, body text
    )`);
    mode = 'postgres';
    console.log('[storage] PostgreSQL:', url.replace(/:\/\/[^@]+@/, '://***@'));
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir = process.env.PGDATA || path.join(__dirname, 'pgdata');
    fs.mkdirSync(dataDir, { recursive: true });
    pglite = new PGlite(dataDir);
    await pglite.exec(`CREATE TABLE IF NOT EXISTS world_state (
      id integer PRIMARY KEY, json text NOT NULL, updated_at bigint NOT NULL
    ); CREATE TABLE IF NOT EXISTS audit_log (
      id bigserial PRIMARY KEY, at bigint NOT NULL, kind text NOT NULL, body text
    );`);
    mode = 'pglite';
    console.log('[storage] embedded PostgreSQL (PGlite):', dataDir);
  }
  if (process.env.REDIS_URL) {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL);
    console.log('[storage] Redis:', process.env.REDIS_URL.replace(/:\/\/[^@]+@/, '://***@'));
  } else {
    const RedisMock = require('ioredis-mock');
    redis = new RedisMock();
    console.log('[storage] Redis: in-memory dev adapter');
  }
  await redis.ping();
}

async function query(sql, params) {
  if (mode === 'postgres') return pool.query(sql, params);
  return pglite.query(sql, params);
}

async function loadState() {
  const r = await query('SELECT json FROM world_state WHERE id = 1');
  if (!r.rows || !r.rows[0] || !r.rows[0].json) return null;
  return JSON.parse(r.rows[0].json);
}

async function saveState(state) {
  const json = JSON.stringify(state);
  await query('INSERT INTO world_state (id,json,updated_at) VALUES (1,$1,$2) ON CONFLICT (id) DO UPDATE SET json=EXCLUDED.json, updated_at=EXCLUDED.updated_at', [json, Date.now()]);
}

async function audit(kind, body) {
  try {
    await query('INSERT INTO audit_log (at,kind,body) VALUES ($1,$2,$3)', [Date.now(), String(kind), JSON.stringify(body || {}).slice(0, 2000)]);
  } catch (e) { console.error('[storage] audit failed', e.message); }
}

async function setPresence(id, ms) {
  try { await redis.set('ore:presence:' + id, String(Date.now()), 'PX', ms); } catch (e) {}
}
async function setSession(id, token, ms) {
  try { await redis.set('ore:session:' + id, token, 'PX', ms); } catch (e) {}
}
async function close() {
  try { if (pool) await pool.end(); } catch (e) {}
  try { if (pglite) await pglite.close(); } catch (e) {}
  try { if (redis) await redis.quit(); } catch (e) {}
}

module.exports = {
  init, loadState, saveState, audit, setPresence, setSession, close,
  get mode() { return mode; }, get redis() { return redis; },
};
