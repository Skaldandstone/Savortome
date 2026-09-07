import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { connectionOptions } from '../../db/src/connection.js';
const { Client } = createRequire(new URL('../../db/package.json', import.meta.url))('pg');
const parameters = (url: string, environment = 'production') => new Client(connectionOptions(url, environment)).connectionParameters;
test('database TLS validates remote peers despite connection-string overrides',()=>{
  const options=connectionOptions('postgres://test:test@database.example/test?sslmode=no-verify&ssl=false','production');
  assert.deepEqual(options.ssl,{rejectUnauthorized:true});
  assert.equal(new URL(options.connectionString).search,'');
});
test('the actual pg client cannot replace certificate checks with URL SSL options',()=>{
  for(const query of ['ssl=false','ssl=0','ssl=1','ssl=true','ssl=no-verify','sslmode=no-verify','sslmode=disable','sslmode=prefer&uselibpqcompat=true','sslmode=require&uselibpqcompat=true','sslmode=verify-ca&uselibpqcompat=true&sslrootcert=missing.pem','sslnegotiation=direct','sslnegotiation=direct&sslmode=disable&uselibpqcompat=true','sslrootcert=missing.pem&sslcert=missing.crt&sslkey=missing.key','ssl=true&ssl=no-verify']) {
    assert.deepEqual(parameters(`postgres://test:test@database.example/test?${query}`).ssl,{rejectUnauthorized:true},query);
  }
  assert.equal(parameters('postgres://test@database.example/test?sslnegotiation=direct').sslnegotiation,'direct');
  assert.equal(parameters('postgres://test@database.example/test?sslnegotiation=postgres').sslnegotiation,'postgres');
  assert.deepEqual(parameters('postgres://test@localhost/test?sslnegotiation=direct','development').ssl,{rejectUnauthorized:true});
});
test('a query host override cannot turn a remote connection into a plaintext local one',()=>{
  for(const suffix of ['host=database.example','host=127.0.0.1&host=database.example','host=localhost.evil.test']) {
    const result=parameters(`postgres://test@localhost/test?${suffix}`,'development');
    assert.deepEqual(result.ssl,{rejectUnauthorized:true});
    assert.notEqual(result.host,'localhost');
  }
  assert.equal(parameters('postgres://test@database.example/test?host=127.0.0.1','development').ssl,false);
  assert.deepEqual(parameters('postgres://test@database.example/test?host=127.0.0.1','production').ssl,{rejectUnauthorized:true});
});
test('connection parsing preserves non-TLS settings and never repeats malformed credentials',()=>{
  const result=parameters('postgres://test:p%40ss@database.example:5544/example?application_name=care-check&statement_timeout=321');
  assert.equal(result.host,'database.example');
  assert.equal(result.port,5544);
  assert.equal(result.database,'example');
  assert.equal(result.password,'p@ss');
  assert.equal(result.application_name,'care-check');
  assert.equal(result.statement_timeout,'321');
  assert.throws(()=>connectionOptions('postgres://test:DO_NOT_REPEAT@[invalid/example'),error=>{
    assert.ok(error instanceof Error);
    assert.equal(error.message,'DATABASE_URL must be a valid PostgreSQL URL.');
    assert.ok(!JSON.stringify(error).includes('DO_NOT_REPEAT'));
    return true;
  });
  assert.throws(()=>connectionOptions('https://database.example/test'),/valid PostgreSQL URL/);
  assert.throws(()=>connectionOptions('postgres://test@localhost/test?sslnegotiation=unexpected'),/unsupported TLS negotiation mode/);
});
test('environment SSL defaults cannot weaken the explicit remote TLS configuration',()=>{
  const previous=process.env.PGSSLMODE;
  try {
    for(const mode of ['disable','no-verify','prefer','require']) {
      process.env.PGSSLMODE=mode;
      assert.deepEqual(parameters('postgres://test@database.example/test','development').ssl,{rejectUnauthorized:true});
    }
  } finally {
    if(previous===undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE=previous;
  }
});
test('only a development loopback database may omit TLS',()=>{
  assert.equal(connectionOptions('postgres://test@127.0.0.1:55494/seconds_beta','development').ssl,false);
  assert.deepEqual(connectionOptions('postgres://test@127.0.0.1:55494/seconds_beta','production').ssl,{rejectUnauthorized:true});
  assert.deepEqual(connectionOptions('postgres://test@127.0.0.1.evil.test/seconds_beta','development').ssl,{rejectUnauthorized:true});
});
