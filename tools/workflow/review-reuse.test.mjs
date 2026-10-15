import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {atomicJSON,fileRef,readJSON} from './production-io.mjs';
import {newProduction,persist,changeCandidate,evaluateGate,recordDecision,inspectProduction,beginIteration,finishIteration,adoptDiagnostic} from './production.mjs';
import {assertAccepted} from './quality.mjs';
import {verifyUnchanged} from './review-reuse.mjs';
import {prepareExecution,reconcileExecution} from './execution.mjs';
const h=x=>x.repeat(64);
function fixture(t){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-reuse-'));
  t.after(()=>{assert.equal(path.dirname(base),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-reuse-'));fs.rmSync(base,{recursive:true,force:true});});
  const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
  const source=put('source.blend','synthetic'),out=put('out.blend','synthetic changed'),evidence=put('evidence.json',{synthetic:true});
  const spec={schema_version:2,status:'active',suite_id:'synthetic',basis:'test',motion_required:false,
    gates:{base_model:['geometry'],polish:['appearance'],final:['appearance']},criteria:{geometry:{kind:'assertion',description:'Geometry only'},appearance:{kind:'assertion',description:'Appearance'}},
    reuse_contract:{version:1,collector_sha256:h('a'),blender_version:'test',dependencies:{base_model:['geometry'],polish:['geometry','materials']}}};
  const job=newProduction('reuse-test',put('spec.json',spec));job.execution_required=false;job.evidence_policy_required=false;job.artifacts.candidate=source;
  const report=(stage,s=job.artifacts.candidate)=>put(`${stage}-${s.sha256.slice(0,6)}.json`,{schema_version:2,job_id:job.job_id,stage,source_sha256:s.sha256,quality_spec_sha256:job.quality_spec.sha256,suite_id:spec.suite_id,checks:spec.gates[stage].map(name=>({name,status:'pass',observation:'synthetic',evidence:[evidence]})),...(stage==='final'?{deliverables:[s]}:{})});
  const accept=stage=>{const ref=report(stage);evaluateGate(base,job,stage,ref);recordDecision(base,job,stage,put(`decision-${stage}.json`,{job_id:job.job_id,stage,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:ref.sha256,reviewer:'user',decision:'accepted',evidence:'Synthetic user decision'}));};
  let i=0;
  const proof=(from=source,to=out,a={geometry:h('b'),materials:h('c')},b={geometry:h('b'),materials:h('d')})=>{
    const n=++i,snap=(s,domains)=>({schema_version:1,source_sha256:s.sha256,collector_sha256:h('a'),blender_version:'test',domains});
    return put(`proof-${n}.json`,{source_sha256:from.sha256,output_sha256:to.sha256,before:put(`before-${n}.json`,snap(from,a)),after:put(`after-${n}.json`,snap(to,b))});
  };
  persist(base,job,{type:'fixture'});return {base,put,source,out,evidence,spec,job,report,accept,proof};
}
test('material change retains proven geometry acceptance, invalidates appearance/final, and preserves original reviewer identity',t=>{
  const f=fixture(t);f.accept('base_model');f.accept('polish');f.accept('final');
  const original=structuredClone(f.job.gates.base_model);
  const result=changeCandidate(f.base,f.job,f.out,f.proof());
  assert.deepEqual(result.retained_gates,['base_model']);assert.deepEqual(f.job.gates.base_model.report,original.report);assert.deepEqual(f.job.gates.base_model.decision,original.decision);
  assert.equal(f.job.gates.final,undefined);assert.deepEqual(f.job.artifacts.final_files,[]);
  assertAccepted(f.base,f.job,'base_model');assert.equal(inspectProduction(f.base,f.job).valid,true);
  assert.throws(()=>assertAccepted(f.base,f.job,'polish'),/Prerequisite/);
  f.accept('polish');assertAccepted(f.base,f.job,'polish');
});
test('changed/unmeasured domains and absent proof fall back to revalidation; invalid collector fails closed',t=>{
  for(const domains of [{geometry:h('e')},{geometry:null},{}]){
    const f=fixture(t);f.accept('base_model');changeCandidate(f.base,f.job,f.out,f.proof(f.source,f.out,undefined,domains));assert.deepEqual(f.job.gates,{});
  }
  const f=fixture(t);f.accept('base_model');changeCandidate(f.base,f.job,f.out);assert.deepEqual(f.job.gates,{});
  const p=f.proof(),d=readJSON(path.join(f.base,p.path)),after=readJSON(path.join(f.base,d.after.path));after.collector_sha256=h('f');d.after=f.put('spoof.json',after);
  assert.throws(()=>verifyUnchanged(f.base,f.spec,'base_model',f.put('bad-proof.json',d),f.source,f.out),/collector/);
});
test('reuse chains revalidate original evidence and all links on every read',t=>{
  const f=fixture(t);f.accept('base_model');changeCandidate(f.base,f.job,f.out,f.proof());
  const next=f.put('next.blend','next');changeCandidate(f.base,f.job,next,f.proof(f.out,next));
  assert.equal(f.job.gates.base_model.reuse.links.length,2);assertAccepted(f.base,f.job,'base_model');
  fs.appendFileSync(path.join(f.base,'evidence.json'),' ');assert.throws(()=>assertAccepted(f.base,f.job,'base_model'),/File changed/);
});
test('retained later evidence remains readable but cannot bypass an affected predecessor',t=>{
  const f=fixture(t);
  f.spec.motion_required=true;f.job.requirements.motion_required=true;f.spec.gates.motion=['geometry'];
  f.spec.reuse_contract.dependencies={base_model:['materials'],polish:['materials'],motion:['geometry']};
  f.job.quality_spec=f.put('spec.json',f.spec);
  f.accept('base_model');f.accept('polish');f.accept('motion');
  changeCandidate(f.base,f.job,f.out,f.proof());
  assert.deepEqual(Object.keys(f.job.gates),['motion']);assert.equal(inspectProduction(f.base,f.job).valid,true);
  assert.throws(()=>assertAccepted(f.base,f.job,'motion'),/Prerequisite/);
  f.accept('base_model');f.accept('polish');assert.ok(f.job.gates.motion.reuse);assertAccepted(f.base,f.job,'motion');
});
test('legacy diagnostic without execution receipt cannot enter formal production',t=>{
  const f=fixture(t),plan=f.put('trial-plan.json',{job_id:f.job.job_id,source_sha256:f.source.sha256,quality_spec_sha256:f.job.quality_spec.sha256,operation:'diagnostic',defect_id:'trial',strategy_id:'trial',hypothesis:'synthetic',authorization_evidence:'synthetic',success_checks:['appearance'],protected_checks:['geometry'],output_path:'trial.blend'});
  const round=beginIteration(f.base,f.job,plan),output=f.put('trial.blend','diagnostic result');
  finishIteration(f.base,f.job,f.put('trial-result.json',{job_id:f.job.job_id,iteration_id:round.id,status:'completed',summary:'supported',diagnostic_conclusion:'supported',candidate:output,evidence:[f.evidence]}));
  const r=f.put('adopt.json',{iteration_id:round.id,reason:'Reuse exact supported artifact',evidence:'authorized scope',report:f.report('base_model',output)});
  assert.throws(()=>adoptDiagnostic(f.base,f.job,r),/verified execution receipt/);assert.deepEqual(f.job.artifacts.candidate,f.source);
});

function adoptionFixture(t){
  const f=fixture(t);f.job.execution_required=true;
  fs.writeFileSync(path.join(f.base,'edit.py'),'# synthetic fixture');
  const plan={job_id:f.job.job_id,source_sha256:f.source.sha256,quality_spec_sha256:f.job.quality_spec.sha256,operation:'diagnostic',adoption_operation:'material',defect_id:'surface',strategy_id:'local-color',hypothesis:'synthetic',authorization_evidence:'synthetic scope',success_checks:['appearance'],protected_checks:['geometry'],output_path:'trial.blend',execution:{script:fileRef(f.base,'edit.py')}};
  const round=beginIteration(f.base,f.job,f.put('trial-plan.json',plan));prepareExecution(f.base,f.job);
  const request=readJSON(path.join(f.base,round.execution.request.path)),output=f.put('trial.blend','executed diagnostic');
  f.put(round.execution.receipt_path,{...request,request_sha256:round.execution.request.sha256,status:'completed',pid:123,blender_version:'test',output_sha256:output.sha256});reconcileExecution(f.base,f.job);
  finishIteration(f.base,f.job,f.put('trial-result.json',{job_id:f.job.job_id,iteration_id:round.id,status:'completed',summary:'supported',diagnostic_conclusion:'supported',candidate:output,evidence:[f.evidence]}));
  const formalPlan={...plan,operation:'material'},formalRef=f.put('formal-plan.json',formalPlan);
  const reports=(name,s,status)=>{
    const d=readJSON(path.join(f.base,f.report('polish',s).path));d.checks[0].status=status;d.checks.push({name:'geometry',status:'pass',observation:'protected',evidence:[f.evidence]});return f.put(name,d);
  };
  const result={summary:'Formal local improvement',evidence:[f.evidence],baseline_report:reports('before.json',f.source,'fail'),candidate_report:reports('after.json',output,'pass')};
  const adoption={iteration_id:round.id,reason:'Reuse executed result',evidence:'synthetic scope',plan:formalRef,result:f.put('formal-result.json',result)};
  return {...f,round,output,formalPlan,result,adoption,request:()=>f.put('adopt.json',adoption)};
}
test('diagnostic adoption reuses execution but consumes formal budget and validates protection',t=>{
  const f=adoptionFixture(t);const r=adoptDiagnostic(f.base,f.job,f.request());
  assert.deepEqual(f.job.artifacts.candidate,f.output);assert.equal(f.job.local_revisions.records.length,2);assert.equal(r.charged_budget_class,'repair');assert.equal(f.job.gates.final,undefined);
  assert.equal(f.job.local_revisions.records[1].adopted_diagnostic_id,f.round.id);
  assert.throws(()=>adoptDiagnostic(f.base,f.job,f.request()),/current source/);
});
test('adoption refuses exhausted budgets, stopped strategies, missing reports and degraded protection without changing candidate',t=>{
  for(const problem of ['budget','stopped','missing','regression','renamed']){
    const f=adoptionFixture(t);
    if(problem==='budget'){f.job.local_revisions.budgets={repair:0,creation:0,diagnostic:1,export:0};f.job.local_revisions.enforce_total=false;}
    if(problem==='stopped')f.job.local_revisions.stopped_strategies.push({defect_id:'surface',strategy_id:'local-color'});
    if(problem==='missing'){delete f.result.baseline_report;f.adoption.result=f.put('formal-result.json',f.result);}
    if(problem==='regression'){const d=readJSON(path.join(f.base,f.result.candidate_report.path));d.checks.find(x=>x.name==='geometry').status='fail';f.result.candidate_report=f.put('degraded.json',d);f.adoption.result=f.put('formal-result.json',f.result);}
    if(problem==='renamed'){f.formalPlan.strategy_id='renamed';f.adoption.plan=f.put('formal-plan.json',f.formalPlan);}
    const old=JSON.stringify(f.job);assert.throws(()=>adoptDiagnostic(f.base,f.job,f.request()));assert.equal(JSON.stringify(f.job),old,problem);
  }
});
test('known visual checks cannot drop material/scene dependencies and unknown checks require full coverage',t=>{
  const f=fixture(t),proof=f.proof();
  f.spec.gates.base_model=['design_identity'];f.spec.criteria.design_identity={kind:'visual',description:'Appearance identity'};
  assert.throws(()=>verifyUnchanged(f.base,f.spec,'base_model',proof,f.source,f.out),/mandatory domains/);
  f.spec.gates.base_model=['custom_visual'];f.spec.criteria.custom_visual={kind:'visual',description:'Custom visual'};
  assert.throws(()=>verifyUnchanged(f.base,f.spec,'base_model',proof,f.source,f.out),/mandatory domains/);
});
