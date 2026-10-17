import {test} from 'node:test';
import assert from 'node:assert/strict';
import {remoteChoice} from './remote-routing.mjs';

test('concise local work ignores unselected drafts but keeps selected and real remote results',()=>{
  const job={interaction_policy:{mode:'concise'},artifacts:{candidate:{sha256:'source'}}};
  const runs=[{id:'draft',status:'planned'}];
  assert.equal(remoteChoice('.',job,runs),null);
  job.active_remote_run={run_id:'draft',source_sha256:'source'};
  assert.equal(remoteChoice('.',job,runs).action,'planned');
  delete job.active_remote_run;runs.push({id:'ready',status:'studio_result_ready'});
  assert.equal(remoteChoice('.',job,runs).action,'select_source_run');
  assert.equal(remoteChoice('.',{...job,interaction_policy:null},[runs[0]]).action,'select_source_run');
});
