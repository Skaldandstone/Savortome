/** Disposable local verification only. Does not claim pgvector/migration parity. */
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {connectionOptions} from '../src/connection.js';
import {requireBetaDatabaseUrl} from './beta-database.js';
const url=requireBetaDatabaseUrl(process.env.DATABASE_URL);
const client=new pg.Client(connectionOptions(url));await client.connect();
try {
  const existing=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if(existing.rows.length) throw new Error('Fixture database already contains tables; refusing to recreate it.');
  const journal=JSON.parse(readFileSync('migrations/meta/_journal.json','utf8'));
  await client.query('BEGIN');
  for(const entry of journal.entries) {
    const sql=readFileSync(`migrations/${entry.tag}.sql`,'utf8').replace(/vector\(1024\)/g,'double precision[]');
    await client.query(sql);
  }
  await client.query('COMMIT');
  console.log('Disposable PostgreSQL schema created. The unused embedding column is double precision[]; pgvector itself is NOT verified.');
} catch(error) { await client.query('ROLLBACK');throw error; } finally { await client.end(); }
