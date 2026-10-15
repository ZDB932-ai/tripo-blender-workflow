import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {atomicJSON,fileRef} from './production-io.mjs';
import {verifyPreflightInput} from './input-binding.mjs';
function fixture(t){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-input-binding-'));
  t.after(()=>{assert.equal(path.dirname(base),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-input-binding-'));fs.rmSync(base,{recursive:true,force:true});});
  const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
  const candidate=put('candidate.blend','candidate A'),evidence=put('evidence.json','synthetic inspection');
  const job={job_id:'test',artifacts:{candidate},quality_spec:put('spec.json',{}),animation_reviews:{preflight:put('checkpoint.json',{})}};
  const input={kind:'studio_asset',asset_url:'https://example.invalid/A',version:'v1',evidence};
  const comparison={candidate_sha256:candidate.sha256,input,checks:['geometry','scale_axes','rig_correspondence'].map(name=>({name,status:'pass',observation:'Synthetic equivalence',evidence:[evidence]}))};
  const binding={schema_version:1,job_id:job.job_id,candidate,quality_spec_sha256:job.quality_spec.sha256,checkpoint_sha256:job.animation_reviews.preflight.sha256,input,relation:'verified_geometry_equivalence',comparison:put('comparison.json',comparison)};
  const plan={input,preflight_input_binding:put('binding.json',binding)},observation={source_input:input};
  return {base,put,job,plan,observation,binding,comparison};
}
test('a texture task must target the candidate itself or a verified exact remote version',t=>{
  const f=fixture(t);verifyPreflightInput(f.base,f.job,f.plan,f.observation);
  const input={kind:'local_file',file:f.job.artifacts.candidate,format:'blend'};
  assert.equal(verifyPreflightInput(f.base,f.job,{input},{source_input:input}).relation,'exact_candidate');
  assert.throws(()=>verifyPreflightInput(f.base,f.job,{input:f.plan.input},f.observation),/reference/);
});
test('different model/version, changed candidate, stale checkpoint and failed equivalence are blocked',t=>{
  for(const problem of ['model','version','candidate','checkpoint','ui','comparison']){
    const f=fixture(t);
    if(problem==='model')f.plan.input={...f.plan.input,asset_url:'https://example.invalid/B'};
    if(problem==='version')f.plan.input={...f.plan.input,version:'v2'};
    if(['model','version'].includes(problem))f.observation.source_input=f.plan.input;
    if(problem==='candidate')f.job.artifacts.candidate=f.put('new.blend','candidate B');
    if(problem==='checkpoint')f.job.animation_reviews.preflight=f.put('new-checkpoint.json','new');
    if(problem==='ui')f.observation.source_input={...f.plan.input,version:'different'};
    if(problem==='comparison'){f.comparison.checks[0].status='unknown';f.binding.comparison=f.put('comparison2.json',f.comparison);f.plan.preflight_input_binding=f.put('binding2.json',f.binding);}
    assert.throws(()=>verifyPreflightInput(f.base,f.job,f.plan,f.observation),undefined,problem);
  }
});
