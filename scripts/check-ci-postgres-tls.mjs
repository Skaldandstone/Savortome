// Read-only proof that the disposable E2E server supports the unchanged
// production connection policy. Never connects to a hosted/customer database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {connectionOptions} from '../packages/db/src/connection.ts';
const url=new URL(process.env.DATABASE_URL??'http://not-configured');
assert.equal(process.env.CI,'true');
assert.ok(['postgresql:','postgres:'].includes(url.protocol));
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/savortome_e2e');assert.equal(url.username,'postgres');
assert.equal(url.search,'');assert.equal(url.hash,'');
assert.ok(url.port===''||url.port==='5432');
assert.ok(process.env.NODE_EXTRA_CA_CERTS,'Disposable CA must be installed for this process');
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {Pool}=require('pg');
const options=connectionOptions(url.href,'production');
assert.equal(options.ssl.rejectUnauthorized,true);
const pool=new Pool({...options,statement_timeout:5000});
try{
 const result=await pool.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()');
 assert.deepEqual(result.rows,[{ssl:true}]);
 console.log('PASS: disposable E2E PostgreSQL accepts verified production-mode TLS');
}finally{await pool.end();}
