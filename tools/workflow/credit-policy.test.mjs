import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,hash} from './workflow.mjs';
import {checkScope,defaultCreditAuthorization} from './policy.mjs';
import {submissionFixture} from './submission-fixture.mjs';
const policy={credit_authorization:defaultCreditAuthorization,review_mode:'guided',status:'approved',evidence:'synthetic scope',allowed_backends:['tripo_studio_browser'],allowed_operations:['generate'],studio_credit_cap:0,max_paid_runs:0,max_local_revision_rounds:1,reference_manifest_sha256:'a'.repeat(64)};
const plan={backend:'tripo_studio_browser',billing_source:'studio',operation:'generate',quoted_credits:100,reference_manifest_sha256:'a'.repeat(64)};
test('standing authorization ignores historical credit caps while retaining scope and unknown accounting',()=>{
  const r=checkScope(policy,plan,[{status:'failed',quoted_credits:400},{status:'accepted',quoted_credits:null}]);
  assert.equal(r.known_reserved,400);assert.equal(r.reserved,null);assert.equal(r.unknown_cost_runs,1);
  for(const status of ['submitting','submission_unknown','processing'])assert.throws(()=>checkScope(policy,plan,[{status,quoted_credits:45}]),/Reconcile/);
  assert.throws(()=>checkScope(policy,{...plan,billing_source:'api'}),/Studio/);
  assert.throws(()=>checkScope(policy,{...plan,operation:'rig'}),/outside scope/);
  assert.throws(()=>checkScope(policy,{...plan,quoted_credits:null}),/Quote/);
  assert.throws(()=>checkScope({...policy,status:'needs_configuration'},plan),/scope/);
});
test('CLI applies standing authorization without per-run approval, preserves replay and UI guards',()=>{
  const id='credit-test-'+Date.now(),base=path.join(root,'assets',id);
  const cli=(...args)=>spawnSync(process.execPath,[path.join(root,'tools/workflow/workflow.mjs'),...args],{encoding:'utf8',windowsHide:true});
  try{
    const f=submissionFixture(base);f.put('draft.json',f.plan);
    f.put('quality-spec.json',{status:'approved',evidence:'synthetic quality'});
    f.put('workflow-policy.json',{...policy,reference_manifest_sha256:hash(path.join(base,'ref.json')),quality_spec_sha256:hash(path.join(base,'quality-spec.json'))});
    assert.equal(cli('prepare',id,'001','draft.json').status,0);
    const approval=JSON.parse(fs.readFileSync(path.join(base,'runs/001/approval.json')));
    assert.equal(approval.authorization_kind,'standing_user_instruction');
    assert.equal(cli('mark',id,'001','submitting','synthetic no browser').status,0);
    assert.notEqual(cli('mark',id,'001','submitting','duplicate').status,0);
    assert.equal(cli('prepare',id,'002','draft.json').status,0);
    assert.match(cli('check-plan',id,'002').stderr,/Reconcile/);
    f.put('runs/001/state.json',{status:'failed'});
    f.put('runs/002/approval.json',{status:'pending'}); // planned legacy run
    assert.equal(cli('check-plan',id,'002').status,0);
    f.put('runs/002/plan.json',{...f.plan,observed_at:'2020-01-01T00:00:00Z'});
    assert.match(cli('check-plan',id,'002').stderr,/Refresh UI quote/);
  }finally{assert.equal(path.dirname(base),path.join(root,'assets'));assert.ok(path.basename(base).startsWith('credit-test-'));fs.rmSync(base,{recursive:true,force:true});}
});
