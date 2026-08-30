import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireBetaDatabaseUrl} from '../../db/scripts/beta-database.js';

test('destructive beta fixtures reject query overrides and every other database',()=>{
  const permitted='postgresql://sb_beta@127.0.0.1:55494/seconds_beta';
  assert.equal(requireBetaDatabaseUrl(permitted),permitted);
  for(const input of [undefined,'',`${permitted}?host=database.example`,`${permitted}?port=5432`,`${permitted}?user=other`,permitted.replace('seconds_beta','production'),permitted.replace('127.0.0.1','localhost'),permitted.replace('55494','5432')]) {
    assert.throws(()=>requireBetaDatabaseUrl(input),/Only the documented disposable local beta database/);
  }
});
