import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {atomicJSON,fileRef,readJSON} from './production-io.mjs';
import {newProduction,persist,recordContinuation,inspectNext,selectRemote} from './production.mjs';
import {checkScope} from './policy.mjs';
test('user continuation retains unknown outcome and costs, while stale records and new unknowns block',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-continuation-test-'));
 try{
  const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
  const job=newProduction('fixture',put('spec.json',{schema_version:2,status:'active',suite_id:'test',motion_required:false,basis:'test',gates:{base_model:['identity'],polish:['identity'],final:['identity']},criteria:{identity:{kind:'assertion',description:'Identity'}}}));job.evidence_policy_required=false;
  job.artifacts.candidate=put('source.blend',{synthetic:true});persist(base,job,{type:'fixture'});
  const oldState=put('runs/old/state.json',{status:'submission_unknown'}),oldPlan=put('runs/old/plan.json',{quoted_credits:15}),newPlan=put('runs/new/plan.json',{quoted_credits:15});put('runs/new/state.json',{status:'studio_result_ready'});
  const ev=put('evidence.json',{run_id:'new',plan_sha256:newPlan.sha256,source_identity:'synthetic://confirmed/new',evidence:[put('view.json',{observed:true})]});
  const r={reviewer:'user',decision:'continue_with_replacement',authorization:'Synthetic explicit user authorization',budget_release:false,unknown_run_id:'old',replacement_run_id:'new',unknown_state:oldState,unknown_plan:oldPlan,replacement_plan:newPlan,replacement_evidence:ev,source_sha256:job.artifacts.candidate.sha256};
  const call=x=>recordContinuation(base,job,put('request.json',x));
  assert.equal(inspectNext(base,job).action,'reconcile_remote');
  assert.throws(()=>call({...r,reviewer:'ai'}),/Explicit user/);
  assert.throws(()=>call({...r,budget_release:true}),/budget/);
  assert.throws(()=>call({...r,source_sha256:'0'.repeat(64)}),/source changed/);
  put('runs/new/state.json',{status:'processing'});assert.throws(()=>call(r),/not ready/);put('runs/new/state.json',{status:'studio_result_ready'});
  job.transfer={status:'unknown'};assert.throws(()=>call(r),/transfer/i);delete job.transfer;
  const before=fs.readFileSync(path.join(base,'runs/old/state.json'),'utf8');call(r);
  assert.equal(fs.readFileSync(path.join(base,'runs/old/state.json'),'utf8'),before);
  assert.equal(inspectNext(base,job).action,'select_source_run');assert.match(inspectNext(base,job).warnings.join(),/budget reserved/);
  selectRemote(base,job,put('select.json',{run_id:'new',source_sha256:r.source_sha256,purpose:'test',reason:'test'}));
  assert.equal(inspectNext(base,job).run,'new');
  put('runs/other/state.json',{status:'submission_unknown'});assert.equal(inspectNext(base,job).action,'reconcile_remote');
  put('runs/other/state.json',{status:'not_created'});put('runs/old/state.json',{status:'processing'});assert.equal(inspectNext(base,job).action,'reconcile_remote');
  const policy={status:'approved',evidence:'test',review_mode:'autonomous',allowed_operations:['generate'],allowed_backends:['tripo_studio_browser'],studio_credit_cap:100,max_paid_runs:10,max_local_revision_rounds:10,reference_manifest_sha256:'a'.repeat(64)};
  assert.equal(checkScope(policy,{operation:'generate',backend:'tripo_studio_browser',quoted_credits:15,reference_manifest_sha256:'a'.repeat(64)},[{status:'submission_unknown',quoted_credits:15}]).reserved,15);
 }finally{assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-continuation-test-'));fs.rmSync(base,{recursive:true,force:true});}
});
