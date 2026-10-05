// Actual deletion queries + exact 0023/0024 migrations, disposable partial PGlite only.
// No storage client, DATABASE_URL, hosted data or multi-connection proof.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {deleteRecipe,removeRecipePhoto} from '../packages/db/src/queries/recipes.ts';
import {deleteUserById} from '../packages/db/src/queries/users.ts';
import {processPendingPhotoDeletions} from '../packages/db/src/queries/photo-cleanup.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const {drizzle}=require('drizzle-orm/pglite');
const {readMigrationFiles}=require('drizzle-orm/migrator');
const journal=JSON.parse(readFileSync('packages/db/migrations/meta/_journal.json','utf8'));
const migrations=readMigrationFiles({migrationsFolder:'packages/db/migrations'});
const migrationIndex=journal.entries.findIndex(entry=>entry.tag==='0023_pending-photo-deletions');
assert.ok(migrationIndex>0);
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const recipe='00000000-0000-4000-8000-000000000003',foreign='00000000-0000-4000-8000-000000000004';
const key=(user,id,n)=>`recipes/${user}/${id}/00000000-0000-4000-8000-${String(n).padStart(12,'0')}.jpg`;
const first=key(owner,recipe,5),second=key(owner,recipe,6),foreignKey=key(other,foreign,7);
const photo=key=>({key,url:'https://fixture.invalid/photo',createdAt:'2026-10-04T00:00:00Z'});
const rows=async(pg,sql)=>(await pg.query(sql)).rows;
async function fixture(run,{migrate=true,photos=true}={}){
 const pg=new PGlite();
 try{
  const initial=readFileSync('packages/db/migrations/0000_initial_schema.sql','utf8');
  await pg.exec(initial.split('--> statement-breakpoint').find(sql=>sql.includes('CREATE TABLE "users"')));
  await pg.exec(`CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE${photos?",photos jsonb NOT NULL DEFAULT '[]'::jsonb":''});`);
  const db=drizzle(pg,{schema});
  await pg.exec(`CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint);`);
  await pg.query(`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('synthetic-prior',$1)`,[migrations[migrationIndex-1].folderMillis]);
  const migrateExact=()=>db.dialect.migrate(migrations,db.session,{migrationsSchema:'drizzle',migrationsTable:'__drizzle_migrations'});
  if(migrate)await migrateExact();
  await pg.query(`INSERT INTO users(id,email,handle,display_name) VALUES ($1,'owner@example.test','fixture-owner','Owner'),($2,'other@example.test','fixture-other','Other')`,[owner,other]);
  if(photos)await pg.query(`INSERT INTO recipes(id,owner_id,photos) VALUES ($1,$2,$3),($4,$5,$6)`,[recipe,owner,JSON.stringify([photo(first),photo(second)]),foreign,other,JSON.stringify([photo(foreignKey)])]);
  await run({pg,db,migrateExact});
 }finally{await pg.close();}
}
test('photo ledger: actual single removal records only removed key; unchanged update does not duplicate',async()=>fixture(async({pg,db})=>{
 const result=await removeRecipePhoto(db,owner,recipe,first);assert.equal(result.removed,true);assert.deepEqual(result.photos.map(p=>p.key),[second]);
 assert.deepEqual(await rows(pg,'SELECT key FROM pending_photo_deletions'),[{key:first}]);
 await pg.query('UPDATE recipes SET photos=photos WHERE id=$1',[recipe]);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,1);
}));
test('photo ledger: actual recipe deletion refuses foreign owner; own deletion retains both keys',async()=>fixture(async({pg,db})=>{
 assert.equal(await deleteRecipe(db,other,recipe),undefined);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
 assert.equal((await deleteRecipe(db,owner,recipe)).photos.length,2);
 assert.deepEqual((await rows(pg,'SELECT key FROM pending_photo_deletions ORDER BY key')).map(p=>p.key),[first,second]);
 assert.equal((await rows(pg,'SELECT * FROM recipes')).length,1);
}));
test('photo ledger: actual account cascade preserves cleanup references and other tenant',async()=>fixture(async({pg,db})=>{
 assert.equal((await deleteUserById(db,owner)).photos.length,2);
 assert.deepEqual((await rows(pg,'SELECT key FROM pending_photo_deletions ORDER BY key')).map(p=>p.key),[first,second]);
 assert.deepEqual((await rows(pg,'SELECT id FROM users')).map(p=>p.id),[other]);
 assert.deepEqual((await rows(pg,'SELECT photos FROM recipes'))[0].photos,[photo(foreignKey)]);
 assert.deepEqual((await deleteUserById(db,owner)).photos,[]);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,2);
}));
test('photo ledger: insert fault rolls account cascade and ledger back, deliberate retry succeeds',async()=>fixture(async({pg,db})=>{
 await pg.exec(`CREATE FUNCTION reject_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture cleanup insert failure'; END $$; CREATE TRIGGER reject_cleanup BEFORE INSERT ON pending_photo_deletions FOR EACH ROW EXECUTE FUNCTION reject_cleanup();`);
 await assert.rejects(deleteUserById(db,owner));
 assert.equal((await rows(pg,'SELECT * FROM users')).length,2);assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
 await pg.exec('DROP TRIGGER reject_cleanup ON pending_photo_deletions');await deleteUserById(db,owner);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,2);
}));
test('photo ledger: caller rollback restores recipe and removes pending entries',async()=>fixture(async({pg,db})=>{
 await assert.rejects(db.transaction(async tx=>{await deleteRecipe(tx,owner,recipe);throw new Error('synthetic caller rollback');}));
 assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
}));
test('photo ledger: foreign-key descriptor cannot become eligible for cleanup',async()=>fixture(async({pg,db})=>{
 await pg.query('UPDATE recipes SET photos=$1 WHERE id=$2',[JSON.stringify([photo(first),photo(second),photo(foreignKey)]),recipe]);
 await assert.rejects(deleteUserById(db,owner));
 assert.equal((await rows(pg,'SELECT * FROM users')).length,2);assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
}));
test('photo migration: missing source column rolls DDL/journal back and explicit repair permits retry',async()=>fixture(async({pg,migrateExact})=>{
 await assert.rejects(migrateExact());
 assert.equal((await rows(pg,"SELECT to_regclass('public.pending_photo_deletions') AS table"))[0].table,null);
 assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,1);
 await pg.exec("ALTER TABLE recipes ADD COLUMN photos jsonb NOT NULL DEFAULT '[]'::jsonb");await migrateExact();await migrateExact();
 assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,3);
 assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
},{migrate:false,photos:false}));
test('photo migration: snapshot adds only independent key/time ledger',()=>{
 const prior=JSON.parse(readFileSync('packages/db/migrations/meta/0022_snapshot.json','utf8'));
 const next=JSON.parse(readFileSync('packages/db/migrations/meta/0023_snapshot.json','utf8'));
 const table=next.tables['public.pending_photo_deletions'];assert.deepEqual(Object.keys(table.columns),['key','created_at']);assert.deepEqual(table.foreignKeys,{});
 delete next.tables['public.pending_photo_deletions'];next.id=prior.id;next.prevId=prior.prevId;assert.deepEqual(next,prior);
});
test('photo consumer: partial failure retains failed key; explicit retry acknowledges only success',async()=>fixture(async({pg,db})=>{
 await deleteRecipe(db,owner,recipe);
 const calls=[];
 assert.deepEqual(await processPendingPhotoDeletions(db,async key=>{calls.push(key);if(key===first)throw new Error('synthetic storage failure');}),{completed:1,failed:1,blocked:0});
 assert.deepEqual(calls,[first,second]);assert.deepEqual(await rows(pg,'SELECT key FROM pending_photo_deletions'),[{key:first}]);
 await pg.exec("UPDATE pending_photo_deletions SET retry_after=CURRENT_TIMESTAMP - interval '1 second'");
 assert.deepEqual(await processPendingPhotoDeletions(db,async()=>{}),{completed:1,failed:0,blocked:0});
 assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
}));
test('photo consumer: timeout aborts, late completion cannot acknowledge; explicit retry is separate',async()=>fixture(async({pg,db})=>{
 await removeRecipePhoto(db,owner,recipe,first);let finish,signal;
 const result=await processPendingPhotoDeletions(db,async(_key,s)=>{signal=s;await new Promise(resolve=>{finish=resolve;});},{limit:1,timeoutMs:100});
 assert.deepEqual(result,{completed:0,failed:1,blocked:0});assert.equal(signal.aborted,true);
 finish();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(await rows(pg,'SELECT key FROM pending_photo_deletions'),[{key:first}]);
 await pg.exec("UPDATE pending_photo_deletions SET retry_after=CURRENT_TIMESTAMP - interval '1 second'");
 assert.deepEqual(await processPendingPhotoDeletions(db,async()=>{}),{completed:1,failed:0,blocked:0});
}));
test('photo consumer: acknowledgement fault rolls ledger back despite provider success',async()=>fixture(async({pg,db})=>{
 await deleteRecipe(db,owner,recipe);let calls=0;
 await pg.exec(`CREATE FUNCTION reject_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture acknowledgement failure'; END $$; CREATE TRIGGER reject_ack BEFORE DELETE ON pending_photo_deletions FOR EACH ROW EXECUTE FUNCTION reject_ack();`);
 await assert.rejects(processPendingPhotoDeletions(db,async()=>{calls++;}));assert.equal(calls,1);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,2);
 await pg.exec('DROP TRIGGER reject_ack ON pending_photo_deletions');
 assert.deepEqual(await processPendingPhotoDeletions(db,async()=>{calls++;}),{completed:2,failed:0,blocked:0});assert.equal(calls,3);
}));
test('photo consumer: live and malformed keys are blocked without storage calls or acknowledgement',async()=>fixture(async({pg,db})=>{
 await pg.query('INSERT INTO pending_photo_deletions(key) VALUES ($1),($2)',[first,'recipes/not-a-valid-key']);let calls=0;
 assert.deepEqual(await processPendingPhotoDeletions(db,async()=>{calls++;}),{completed:0,failed:0,blocked:2});
 assert.equal(calls,0);assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,2);
}));
test('photo consumer: invalid limits refuse database/provider dispatch',async()=>{
 for(const options of [{limit:0},{limit:11},{limit:1.5},{timeoutMs:99},{timeoutMs:3001},{timeoutMs:NaN}]){
  await assert.rejects(processPendingPhotoDeletions({transaction(){throw new Error('database must not open');}},async()=>{throw new Error('provider must not dispatch');},options),/Invalid photo cleanup batch limits/);
 }
});
test('photo consumer: maximum batch size is respected; remaining key waits for deliberate next call',async()=>fixture(async({pg,db})=>{
 await deleteRecipe(db,owner,recipe);const calls=[];
 assert.deepEqual(await processPendingPhotoDeletions(db,async key=>{calls.push(key);},{limit:1}),{completed:1,failed:0,blocked:0});
 assert.deepEqual(calls,[first]);assert.deepEqual(await rows(pg,'SELECT key FROM pending_photo_deletions'),[{key:second}]);
}));
test('photo consumer: a failed oldest key must not starve the next explicit batch',async()=>fixture(async({db})=>{
 await deleteRecipe(db,owner,recipe);const calls=[];
 const erase=async key=>{calls.push(key);if(key===first)throw new Error('synthetic persistent storage failure');};
 assert.deepEqual(await processPendingPhotoDeletions(db,erase,{limit:1}),{completed:0,failed:1,blocked:0});
 assert.deepEqual(await processPendingPhotoDeletions(db,erase,{limit:1}),{completed:1,failed:0,blocked:0});
 assert.deepEqual(calls,[first,second]);
}));
test('photo consumer: blocked oldest entry defers without losing key or starving eligible entries',async()=>fixture(async({pg,db})=>{
 await deleteRecipe(db,owner,recipe);
 await pg.query("INSERT INTO pending_photo_deletions(key,created_at) VALUES ($1,'2000-01-01T00:00:00Z')",['malformed-key']);const calls=[];
 assert.deepEqual(await processPendingPhotoDeletions(db,async key=>{calls.push(key);},{limit:1}),{completed:0,failed:0,blocked:1});
 assert.deepEqual(await processPendingPhotoDeletions(db,async key=>{calls.push(key);},{limit:1}),{completed:1,failed:0,blocked:0});assert.deepEqual(calls,[first]);
 const [blocked]=await rows(pg,"SELECT key,attempts,created_at,EXTRACT(epoch FROM retry_after-last_attempt_at) AS delay FROM pending_photo_deletions WHERE key='malformed-key'");
 assert.equal(blocked.attempts,1);assert.equal(new Date(blocked.created_at).getUTCFullYear(),2000);assert.equal(Number(blocked.delay),900);
}));
test('photo consumer: deferral-write fault rolls metadata back and never acknowledges a failed erase',async()=>fixture(async({pg,db})=>{
 await deleteRecipe(db,owner,recipe);
 await pg.exec(`CREATE FUNCTION reject_deferral() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture deferral failure'; END $$; CREATE TRIGGER reject_deferral BEFORE UPDATE ON pending_photo_deletions FOR EACH ROW EXECUTE FUNCTION reject_deferral();`);
 await assert.rejects(processPendingPhotoDeletions(db,async()=>{throw new Error('synthetic erase failure');}));
 const pending=await rows(pg,'SELECT attempts,last_attempt_at FROM pending_photo_deletions');assert.equal(pending.length,2);assert.ok(pending.every(p=>p.attempts===0&&p.last_attempt_at===null));
}));
test('photo consumer: retries use DB time, preserve capture age, cap delay and never expire references',async()=>fixture(async({pg,db})=>{
 await removeRecipePhoto(db,owner,recipe,first);const [before]=await rows(pg,'SELECT created_at FROM pending_photo_deletions');let calls=0;
 const erase=async()=>{calls++;throw new Error('synthetic failure');};
 assert.deepEqual(await processPendingPhotoDeletions(db,erase),{completed:0,failed:1,blocked:0});
 assert.deepEqual(await processPendingPhotoDeletions(db,erase),{completed:0,failed:0,blocked:0});assert.equal(calls,1);
 let [entry]=await rows(pg,'SELECT created_at,attempts,EXTRACT(epoch FROM retry_after-last_attempt_at) AS delay FROM pending_photo_deletions');
 assert.equal(entry.attempts,1);assert.equal(Number(entry.delay),60);assert.equal(new Date(entry.created_at).getTime(),new Date(before.created_at).getTime());
 await pg.exec("UPDATE pending_photo_deletions SET attempts=1000000,retry_after=CURRENT_TIMESTAMP - interval '1 second'");
 await processPendingPhotoDeletions(db,erase);
 [entry]=await rows(pg,'SELECT created_at,attempts,EXTRACT(epoch FROM retry_after-last_attempt_at) AS delay FROM pending_photo_deletions');assert.equal(entry.attempts,1000000);assert.equal(Number(entry.delay),3600);assert.equal(new Date(entry.created_at).getTime(),new Date(before.created_at).getTime());
}));
test('photo retry migration: snapshot changes only retry metadata, with no identities/content/errors',()=>{
 const prior=JSON.parse(readFileSync('packages/db/migrations/meta/0023_snapshot.json','utf8'));
 const next=JSON.parse(readFileSync('packages/db/migrations/meta/0024_snapshot.json','utf8'));
 for(const column of ['attempts','last_attempt_at','retry_after']){assert.ok(next.tables['public.pending_photo_deletions'].columns[column]);delete next.tables['public.pending_photo_deletions'].columns[column];}
 next.id=prior.id;next.prevId=prior.prevId;assert.deepEqual(next,prior);
});
test('photo retry migration: partial DDL fault preserves pending keys/journal and explicit repair permits retry',async()=>fixture(async({pg,migrateExact})=>{
 await pg.exec(readFileSync('packages/db/migrations/0023_pending-photo-deletions.sql','utf8'));
 await pg.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)',[migrations[migrationIndex].hash,migrations[migrationIndex].folderMillis]);
 await pg.query("INSERT INTO pending_photo_deletions(key,created_at) VALUES ($1,'2000-01-01T00:00:00Z')",[first]);
 await pg.exec('ALTER TABLE pending_photo_deletions ADD COLUMN retry_after timestamp with time zone');
 await assert.rejects(migrateExact());
 const columns=await rows(pg,"SELECT column_name FROM information_schema.columns WHERE table_name='pending_photo_deletions' ORDER BY ordinal_position");
 assert.deepEqual(columns.map(c=>c.column_name),['key','created_at','retry_after']);assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,2);
 assert.equal((await rows(pg,'SELECT key FROM pending_photo_deletions'))[0].key,first);
 await pg.exec('ALTER TABLE pending_photo_deletions DROP COLUMN retry_after');await migrateExact();await migrateExact();
 const [entry]=await rows(pg,'SELECT key,created_at,attempts,last_attempt_at,retry_after FROM pending_photo_deletions');assert.equal(entry.key,first);assert.equal(new Date(entry.created_at).getUTCFullYear(),2000);assert.equal(entry.attempts,0);assert.equal(entry.last_attempt_at,null);assert.ok(entry.retry_after);assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,3);
},{migrate:false}));
