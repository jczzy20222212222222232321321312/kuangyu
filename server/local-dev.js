#!/usr/bin/env node
/* Local self-hosted development stack:
 *   PostgreSQL (embedded binary) + Redis (redis-memory-server) + game server.
 * This is a single-node local test stack, not a managed HA cluster.
 */
'use strict';
const path = require('path');
const fs = require('fs');
(async () => {
  const EmbeddedPostgres = (await import('embedded-postgres')).default;
  const { RedisMemoryServer } = require('redis-memory-server');
  const dataDir = process.env.PGDATA || path.join(__dirname, 'pgdata-real');
  fs.mkdirSync(dataDir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir, user: 'postgres', password: 'postgres',
    port: Number(process.env.DEV_PG_PORT || 55432),
    persistent: true, autoRehydrateSymlinks: true,
  });
  try { await pg.initialise(); } catch (e) { /* existing cluster */ }
  await pg.start();
  try { await pg.createDatabase('orezone'); } catch (e) { /* existing */ }
  const redis = new RedisMemoryServer({ autoStart: false, instance: { port: Number(process.env.DEV_REDIS_PORT || 56379) } });
  await redis.start();
  const rhost = await redis.getHost(); const rport = await redis.getPort();
  process.env.DATABASE_URL = process.env.DATABASE_URL || ('postgres://postgres:postgres@127.0.0.1:' + (process.env.DEV_PG_PORT || 55432) + '/orezone');
  process.env.REDIS_URL = process.env.REDIS_URL || ('redis://' + rhost + ':' + rport);
  console.log('[local-dev] PostgreSQL', process.env.DATABASE_URL);
  console.log('[local-dev] Redis', process.env.REDIS_URL);
  require('./world-server');
  const stop = async () => {
    try { await redis.stop(); } catch (e) {}
    try { await pg.stop(); } catch (e) {}
    process.exit(0);
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
})().catch((e) => { console.error('[local-dev] failed', e); process.exit(1); });
