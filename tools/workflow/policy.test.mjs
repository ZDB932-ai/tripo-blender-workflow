import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkScope,reviewGate} from './policy.mjs';
const policy={review_mode:'autonomous',status:'approved',evidence:'test fixture',allowed_backends:['tripo_studio_browser'],allowed_operations:['generate'],studio_credit_cap:90,max_paid_runs:2,max_local_revision_rounds:2,reference_manifest_sha256:'a'.repeat(64)};
const plan={backend:'tripo_studio_browser',operation:'generate',quoted_credits:45,reference_manifest_sha256:'a'.repeat(64)};
test('animation readiness cannot inherit static geometry acceptance in either review mode',()=>{
  const spec=JSON.parse(fs.readFileSync(new URL('./quality-spec.template.json',import.meta.url),'utf8'));
  for(const mode of ['guided','autonomous'])for(const stage of ['base_model','polish']){
    const required=spec.gates[stage];
    assert.ok(required.includes('deformation_readiness'));
    const staticChecks=required.filter(n=>n!=='deformation_readiness').map(name=>({name,status:'pass',evidence:'fixture static inspection'}));
    assert.equal(reviewGate(mode,stage,staticChecks,required).action,'blocked');
    for(const status of ['unknown','fail'])assert.equal(reviewGate(mode,stage,[...staticChecks,{name:'deformation_readiness',status,evidence:'fixture unresolved arm-body connection'}],required).action,'blocked');
    assert.equal(reviewGate(mode,stage,[...staticChecks,{name:'deformation_readiness',status:'not_applicable',reason:'Fixture: static prop with no motion requirement'}],required).action,'blocked');
    assert.notEqual(reviewGate(mode,stage,[...staticChecks,{name:'deformation_readiness',status:'not_applicable',reason:'Fixture: static prop with no motion requirement'}],required,[{name:'deformation_readiness',reason:'Approved static applicability'}]).action,'blocked');
  }
});
test('autonomous mode preserves human reference/final gates and technical blockers',()=>{
  const checks=[{name:'identity',status:'pass',evidence:'test render'}];
  assert.equal(reviewGate('autonomous','reference',checks).action,'user_review');
  assert.equal(reviewGate('autonomous','final',checks).action,'user_review');
  assert.equal(reviewGate('autonomous','polish',checks).action,'ai_review');
  assert.equal(reviewGate('guided','polish',checks).action,'user_review');
  for(const status of ['fail','unknown','not_performed'])assert.equal(reviewGate('autonomous','polish',[{name:'required',status}]).action,'blocked');
  assert.equal(reviewGate('autonomous','motion',[{name:'rig',status:'not_applicable',reason:'Static prop'}]).action,'blocked');
  assert.equal(reviewGate('autonomous','polish',[]).action,'blocked');
  assert.equal(reviewGate('autonomous','polish',checks,['identity','uv']).action,'blocked');
  assert.equal(reviewGate('autonomous','polish',[{name:'identity',status:'fail',required:false}],['identity']).action,'blocked');
});
test('unknown and failed runs reserve credits and attempts; unrelated backend and operation fail',()=>{
  assert.equal(checkScope(policy,plan,[{status:'submission_unknown',quoted_credits:45}]).remaining,0);
  assert.throws(()=>checkScope(policy,plan,[{status:'failed',quoted_credits:46}]));
  assert.throws(()=>checkScope(policy,plan,[{status:'processing',quoted_credits:45},{status:'accepted',quoted_credits:0}]));
  assert.throws(()=>checkScope(policy,{...plan,backend:'tripo_api'}));
  assert.throws(()=>checkScope(policy,{...plan,operation:'rig'}));
  assert.throws(()=>checkScope(policy,{...plan,reference_manifest_sha256:'b'.repeat(64)}));
  assert.throws(()=>checkScope({...policy,status:'needs_configuration'},plan));
  assert.throws(()=>checkScope(policy,plan,[{status:'processing',quoted_credits:null}]));
});
