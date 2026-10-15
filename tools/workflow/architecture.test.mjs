// Read-only architecture audit against production code; all fixture writes stay in OS temp.
// Synthetic files are NOT Blender evidence and do not certify model quality.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {newProduction, projection, beginIteration, finishIteration, evaluateGate, recordDecision, persist, inspectNext, configure,recordTransfer,attachSource,selectCandidate,budgetClass,budgetBlockers} from './production.mjs';
import {currentExport} from './export-chain.mjs';
import {atomicJSON, fileRef} from './production-io.mjs';
import {compareReports, STAGES, evaluateReport, validateSpec} from './quality.mjs';
import {qualityTemplate} from './quality-template.mjs';
import {transition, reconcileSubmission, checkInput, checkReference} from './workflow.mjs';

import {test} from 'node:test';
function fixture(fn){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-architecture-audit-'));
  try{
    const put=(name,value)=>{atomicJSON(path.join(base,name),value);return fileRef(base,name);};
    fs.writeFileSync(path.join(base,'source.blend'),'SYNTHETIC source');
    fs.writeFileSync(path.join(base,'candidate.blend'),'SYNTHETIC candidate');
    fs.writeFileSync(path.join(base,'evidence.txt'),'Synthetic observation, no Blender operation');
    const evidence=fileRef(base,'evidence.txt');
    const spec={schema_version:2,status:'active',motion_required:true,suite_id:'synthetic-suite',basis:'audit fixture',
      gates:{base_model:['identity'],polish:['shape','error'],motion:['clip','contact'],final:['identity']},
      criteria:{identity:{kind:'assertion',description:'Identity'},shape:{kind:'visual',description:'Shape'},error:{kind:'metric',description:'Error',operator:'lte',unit:'ratio',limit:1},clip:{kind:'assertion',description:'Clip'},contact:{kind:'visual',description:'Contact'}}};
    const job=newProduction('fixture',put('spec.json',spec));job.evidence_policy_required=false;
    job.execution_required=false;
    job.requirements={motion_required:true,intent:'wave',evidence:'Synthetic request'};
    job.artifacts.candidate=fileRef(base,'source.blend');
    const report=(name,stage,source=job.artifacts.candidate,error=0.5,unknownName=null)=>{
      const raw=put(name+'-raw.json',{source_sha256:source.sha256,suite_id:spec.suite_id,units:{error:'ratio'},error});
      return put(name+'.json',{schema_version:2,job_id:job.job_id,stage,source_sha256:source.sha256,quality_spec_sha256:job.quality_spec.sha256,suite_id:spec.suite_id,
        checks:spec.gates[stage].map(n=>n===unknownName?{name:n,status:'unknown',observation:'not yet authored',evidence:[evidence]}:n==='error'?{name:n,evidence:[raw],measurement:{file:raw,pointer:'/error'}}:{name:n,status:'pass',observation:'Synthetic pass',evidence:[evidence]}),
        ...(stage==='final'?{deliverables:[source]}:{})});
    };
    const accept=stage=>{
      const r=report('accept-'+stage,stage);evaluateGate(base,job,stage,r);
      recordDecision(base,job,stage,put('decision-'+stage+'.json',{job_id:job.job_id,stage,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:r.sha256,reviewer:'user',decision:'accepted',evidence:'SYNTHETIC fixture approval'}));
    };
    const plan=(name,operation='geometry_repair',protectedChecks=['shape'])=>put(name+'.json',{job_id:job.job_id,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,operation,format:'glb',defect_id:name,strategy_id:name,hypothesis:'Synthetic hypothesis',authorization_evidence:'SYNTHETIC fixture scope',success_checks:['error'],protected_checks:protectedChecks,output_path:name+'.blend'});
    const exportAsset=(name='export')=>{
      const round=beginIteration(base,job,put(name+'-plan.json',{job_id:job.job_id,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,operation:'export',format:'glb',authorization_evidence:'synthetic',success_checks:['identity'],protected_checks:['identity'],output_path:name+'.glb'}));
      fs.writeFileSync(path.join(base,round.output_path),'SYNTHETIC export '+name);const output=fileRef(base,round.output_path);
      const r=JSON.parse(fs.readFileSync(path.join(base,report(name+'-report','final').path)));r.deliverables=[output];r.export_iteration_id=round.id;
      finishIteration(base,job,put(name+'-result.json',{job_id:job.job_id,iteration_id:round.id,status:'completed',summary:'synthetic export',evidence:[evidence],candidate:output,candidate_report:put(name+'-report.json',r)}));
      return {round,output};
    };
    fn({base,put,job,spec,evidence,report,accept,plan,exportAsset});
  }finally{
    const resolved=path.resolve(base);
    assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('tripo-architecture-audit-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}

test('next routes accepted polish to motion, then final; unknown remote operation takes priority',()=>fixture(({base,job,accept,put})=>{
  accept('base_model');accept('polish');assert.equal(projection(job).next_skill,'tripo-blender-rig-motion');
  accept('motion');assert.equal(projection(job).next_skill,'tripo-studio-deliver');
  put('runs/001/state.json',{status:'submission_unknown'});
  assert.equal(inspectNext(base,job).action,'reconcile_remote');
}));
test('engine requirement rejects a missing spec and blocks final until exact project/files tested',()=>fixture(({base,job,spec,put,accept,report,exportAsset})=>{
  job.requirements.engine={required:true,name:'Unity',version:'test',project:'test-project'};
  assert.throws(()=>accept('base_model'),/Engine requirements/);
  spec.engine_required=true;spec.gates.engine=['identity'];job.quality_spec=put('engine-spec.json',spec);
  accept('base_model');accept('polish');accept('motion');
  assert.throws(()=>accept('final'),/Prerequisite not accepted: engine/);
  const r=report('engine','engine'),doc=JSON.parse(fs.readFileSync(path.join(base,r.path)));
  doc.engine={name:'Unity',version:'wrong',project:'test-project'};doc.imported_files=[job.artifacts.candidate];
  assert.throws(()=>evaluateGate(base,job,'engine',put('engine-wrong.json',doc)),/Engine target/);
  doc.engine.version='test';assert.throws(()=>evaluateGate(base,job,'engine',put('engine-no-export.json',doc)),/verified export required/);
  const {round,output}=exportAsset();doc.export_iteration_id=round.id;
  assert.throws(()=>evaluateGate(base,job,'engine',put('engine-other-file.json',doc)),/Engine files differ/);
  doc.imported_files=[output];const good=put('engine-good.json',doc);evaluateGate(base,job,'engine',good);
  recordDecision(base,job,'engine',put('engine-decision.json',{job_id:job.job_id,stage:'engine',source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:good.sha256,reviewer:'user',decision:'accepted',evidence:'synthetic'}));
  const finalDoc=JSON.parse(fs.readFileSync(path.join(base,report('final','final').path)));finalDoc.export_iteration_id=round.id;
  assert.throws(()=>evaluateGate(base,job,'final',put('wrong-final.json',finalDoc)),/Final files differ/);
  finalDoc.deliverables=[output,job.artifacts.candidate];
  assert.throws(()=>evaluateGate(base,job,'final',put('extra-final.json',finalDoc)),/Final files differ/);
  finalDoc.deliverables=[output];const final=put('final-good.json',finalDoc);evaluateGate(base,job,'final',final);
  recordDecision(base,job,'final',put('final-decision.json',{job_id:job.job_id,stage:'final',source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:final.sha256,reviewer:'user',decision:'accepted',evidence:'synthetic'}));
  assert.equal(job.status,'accepted');assert.deepEqual(job.artifacts.final_files,[output]);
}));
test('first creation allows missing old clip but requires known protected checks and passing new clip',()=>fixture(({base,job,report})=>{
  const c=fileRef(base,'candidate.blend'),before=report('before','motion',job.artifacts.candidate,0.5,'clip'),after=report('after','motion',c);
  assert.equal(compareReports(base,job,'motion',job.artifacts.candidate,c,before,after,{mode:'create',protected_checks:['contact']}),true);
  assert.equal(compareReports(base,job,'motion',job.artifacts.candidate,c,before,after,{mode:'create',protected_checks:['clip']}),false);
  assert.equal(compareReports(base,job,'motion',job.artifacts.candidate,c,before,report('bad','motion',c,0.5,'clip'),{mode:'create',protected_checks:['contact']}),false);
}));
test('visual improvement needs bound actual comparison; stale comparison is refused',()=>fixture(({base,job,put,evidence,report})=>{
  const c=fileRef(base,'candidate.blend'),before=report('before','motion'),after=report('after','motion',c);
  assert.equal(compareReports(base,job,'motion',job.artifacts.candidate,c,before,after),false);
  const comparison={before_report_sha256:before.sha256,after_report_sha256:after.sha256,source_sha256:job.artifacts.candidate.sha256,candidate_sha256:c.sha256,quality_spec_sha256:job.quality_spec.sha256,reviewer:'user',observation:'synthetic comparison',evidence:[evidence],decision:'improved',checks:[{name:'contact',decision:'improved',observation:'synthetic contact improvement',evidence:[evidence]}]};
  assert.equal(compareReports(base,job,'motion',job.artifacts.candidate,c,before,after,{comparison:put('comparison.json',comparison)}),true);
  comparison.candidate_sha256='0'.repeat(64);
  assert.throws(()=>compareReports(base,job,'motion',job.artifacts.candidate,c,before,after,{comparison:put('stale.json',comparison)}),/Comparison identity/);
}));
test('declared cross-stage protected check cannot be skipped during candidate promotion',()=>fixture(({base,job,put,evidence,report,plan})=>{
  const round=beginIteration(base,job,plan('repair','geometry_repair',['contact']));
  fs.writeFileSync(path.join(base,round.output_path),'synthetic changed source');const candidate=fileRef(base,round.output_path);
  const outcome=finishIteration(base,job,put('result.json',{job_id:job.job_id,iteration_id:round.id,status:'completed',summary:'synthetic',evidence:[evidence],candidate,baseline_report:report('before','polish',round.baseline,0.8),candidate_report:report('after','polish',candidate,0.4)}));
  assert.equal(outcome.outcome,'no_improvement');assert.equal(job.artifacts.candidate.sha256,round.baseline.sha256);
}));
test('classified diagnostic budget leaves export budget available; existing total cap is retained',()=>fixture(({base,job,put,evidence,accept,plan})=>{
  job.local_revisions.budgets={repair:2,diagnostic:2,creation:2,export:1};job.local_revisions.enforce_total=false;
  for(let i=0;i<2;i++){
    const r=beginIteration(base,job,plan('diag'+i,'diagnostic'));
    finishIteration(base,job,put('abort'+i+'.json',{job_id:job.job_id,iteration_id:r.id,status:'aborted',summary:'synthetic',evidence:[evidence]}));
  }
  accept('base_model');accept('polish');accept('motion');
  put('workflow-policy.json',{status:'approved',max_local_revision_rounds:2});
  assert.throws(()=>beginIteration(base,job,plan('export-blocked','export')),/Local revision limit/);
  fs.unlinkSync(path.join(base,'workflow-policy.json')); // fixture only, demonstrate a new job without historical total cap
  const r=beginIteration(base,job,plan('export','export'));assert.equal(r.budget_class,'export');
}));
test('unknown submissions reconcile with evidence and cannot be blindly resubmitted',()=>fixture(({base,evidence})=>{
  for(const outcome of ['failed','cancelled','processing','studio_result_ready'])assert.equal(reconcileSubmission(base,'submission_unknown',{outcome,reason:'fixture service response',remote_identity:'task-1',evidence:[evidence]}),outcome);
  assert.throws(()=>reconcileSubmission(base,'submission_unknown',{outcome:'not_created',reason:'not in list',evidence:[evidence]}),/not proof/);
  assert.equal(reconcileSubmission(base,'submission_unknown',{outcome:'not_created',confirmation:'explicit_service_confirmation',reason:'fixture explicit response',evidence:[evidence]}),'not_created');
  assert.throws(()=>transition('failed','submitting','retry'),/Invalid transition/);
}));
test('quality profiles do not force locomotion or skinning on unrelated requests',()=>{
  const wave=qualityTemplate(true);assert.doesNotMatch(wave.criteria.motion_intent.description,/forward run/);assert.ok(!wave.gates.motion.includes('sole_drift'));assert.ok(!wave.gates.motion.includes('ik_unreachable'));
  const run=qualityTemplate(true,{locomotion_contact:true,uses_ik:true});assert.ok(run.gates.motion.includes('sole_drift'));assert.ok(run.gates.motion.includes('ik_unreachable'));
  const prop=qualityTemplate(true,{profile:'articulated-prop'});assert.ok(!prop.gates.motion.includes('weights'));assert.ok(!prop.gates.polish.includes('protected_region'));
});
test('typed source identity and text reference are validated without invented Tripo run IDs',()=>fixture(({base,evidence})=>{
  checkInput(base,{kind:'local_file',file:evidence,format:'glb'});
  checkInput(base,{kind:'studio_asset',asset_url:'https://studio.tripo3d.ai/example',version:'v1',evidence});
  assert.throws(()=>checkInput(base,{kind:'studio_asset',asset_url:'url',version:null,evidence}),/version/);
  checkReference(base,{kind:'text',prompt:evidence,decision:{status:'approved',evidence:'synthetic'}});
  assert.throws(()=>checkReference(base,{kind:'text',prompt:evidence,decision:{status:'pending'}}),/not approved/);
}));
test('transfer unknown blocks duplicate sends and local mutations until same-source reconciliation',()=>fixture(({base,job,put,evidence,plan})=>{
  const r={id:'transfer-1',source_identity:'studio-v1',route:'bridge',status:'sending',evidence:[evidence]};
  recordTransfer(base,job,put('sending.json',r));assert.equal(inspectNext(base,job).action,'reconcile_transfer');
  assert.throws(()=>recordTransfer(base,job,put('duplicate.json',r)),/Reconcile existing/);
  recordTransfer(base,job,put('unknown.json',{...r,status:'unknown'}));
  assert.throws(()=>beginIteration(base,job,plan('edit')),/Reconcile transfer/);
  assert.throws(()=>recordTransfer(base,job,put('wrong-source.json',{...r,source_identity:'v2',status:'received',candidate:job.artifacts.candidate})),/Reconcile existing/);
  recordTransfer(base,job,put('received.json',{...r,status:'received',candidate:job.artifacts.candidate}));
  assert.equal(job.transfer.status,'received');
}));
test('first motion creation promotes a tested candidate but never accepts it automatically',()=>fixture(({base,job,put,evidence,report,accept})=>{
  accept('base_model');accept('polish');
  const r=beginIteration(base,job,put('create.json',{job_id:job.job_id,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,operation:'motion',mode:'create',defect_id:'requested-wave',strategy_id:'author-wave',hypothesis:'requested motion',authorization_evidence:'synthetic',success_checks:['clip'],protected_checks:['contact'],output_path:'wave.blend'}));
  fs.writeFileSync(path.join(base,'wave.blend'),'synthetic wave');const candidate=fileRef(base,'wave.blend');
  finishIteration(base,job,put('created.json',{job_id:job.job_id,iteration_id:r.id,status:'completed',summary:'synthetic wave completed',evidence:[evidence],candidate,baseline_report:report('before-create','motion',r.baseline,0.5,'clip'),candidate_report:report('after-create','motion',candidate)}));
  assert.equal(job.artifacts.candidate.sha256,candidate.sha256);assert.notEqual(job.status,'accepted');assert.deepEqual(job.gates,{});
}));
test('legacy Bridge receipt reconciles exporting only when run and archived hash match',()=>fixture(({base,job,put})=>{
  job.source_run_id='005';persist(base,job,{type:'fixture'});
  put('runs/005/state.json',{status:'exporting'});
  assert.equal(inspectNext(base,job).action,'reconcile_remote');
  put('runs/005/transfer-result.json',{status:'completed_via_bridge',manifest:'transfers/005.json'});
  put('transfers/005.json',{run_id:'005',status:'received_and_audited',file:job.artifacts.candidate.path,sha256:job.artifacts.candidate.sha256});
  assert.equal(inspectNext(base,job).action,'base_model');
  put('transfers/005.json',{run_id:'005',status:'received_and_audited',file:job.artifacts.candidate.path,sha256:'0'.repeat(64)});
  assert.equal(inspectNext(base,job).action,'reconcile_remote');
}));

test('Bridge attachment shares receipt validation and rejects another run or candidate',()=>fixture(({base,job,put})=>{
  put('runs/005/state.json',{status:'exporting'});
  const receipt=put('runs/005/transfer-result.json',{status:'completed_via_bridge',manifest:'transfers/005.json'});
  const manifest={run_id:'005',status:'received_and_audited',file:job.artifacts.candidate.path,sha256:job.artifacts.candidate.sha256};
  put('transfers/005.json',manifest);
  const request={reason:'fixture import',run_id:'005',candidate:job.artifacts.candidate,receipt};
  attachSource(base,job,put('attach.json',request));assert.equal(job.source_run_id,'005');
  put('transfers/005.json',{...manifest,run_id:'006'});
  assert.throws(()=>attachSource(base,job,put('wrong-run.json',request)),/source run mismatch/);
  put('transfers/005.json',manifest);
  assert.throws(()=>attachSource(base,job,put('wrong-file.json',{...request,candidate:fileRef(base,'candidate.blend')})),/candidate mismatch/);
  assert.throws(()=>attachSource(base,job,put('not-receipt.json',{...request,receipt:put('unrelated.json',{status:'failed'})})),/Received transfer receipt/);
}));

test('pending transfer freezes every context mutation while reconciliation stays available',()=>fixture(({base,job,put,evidence,plan})=>{
  const transfer={id:'t1',source_identity:'v1',route:'bridge',status:'sending',evidence:[evidence]};
  recordTransfer(base,job,put('intent.json',transfer));
  const request=put('change.json',{reason:'fixture',candidate:job.artifacts.candidate});
  for(const mutate of [()=>attachSource(base,job,request),()=>selectCandidate(base,job,request),()=>configure(base,job,request),()=>beginIteration(base,job,plan('repair')),()=>evaluateGate(base,job,'base_model',request),()=>recordDecision(base,job,'base_model',request)])assert.throws(mutate,/Reconcile transfer/);
  recordTransfer(base,job,put('failed.json',{...transfer,status:'failed'}));
  selectCandidate(base,job,request);assert.equal(job.transfer.status,'failed');
}));

test('known supplemental checks survive gate reuse but required protection and typos still fail',()=>fixture(({base,job,put,evidence,report,accept})=>{
  accept('base_model');
  const r=JSON.parse(fs.readFileSync(path.join(base,report('extra','polish').path)));
  r.checks.push({name:'contact',status:'unknown',observation:'not measured',evidence:[evidence]});
  const ref=put('extra.json',r);
  assert.equal(evaluateGate(base,job,'polish',ref).action,'user_review');
  assert.equal(evaluateReport(base,job,'polish',ref,job.artifacts.candidate,['contact']).action,'blocked');
  r.checks.push({name:'contcat',status:'pass'});
  assert.throws(()=>evaluateGate(base,job,'polish',put('typo.json',r)),/Unknown check/);
}));

test('budget classification follows mode and preserves already recorded buckets',()=>fixture(({base,job,put,plan})=>{
  for(const op of ['motion','rig','material','uv']){
    assert.equal(budgetClass(op,'repair'),'repair');assert.equal(budgetClass(op,'create'),'creation');
  }
  job.local_revisions.budgets={repair:1,creation:1,diagnostic:0,export:1};job.local_revisions.enforce_total=false;
  job.local_revisions.records.push({operation:'motion',mode:'repair',budget_class:'creation',status:'failed'});
  assert.deepEqual(budgetBlockers(base,job,'rig','repair'),[]);
  assert.deepEqual(budgetBlockers(base,job,'material','create'),['Operation budget limit reached']);
  assert.equal(beginIteration(base,job,plan('material-repair','material')).budget_class,'repair');
}));

test('latest failed export or changed file cannot reuse previous export success',()=>fixture(({base,job,spec,put,accept,exportAsset,evidence})=>{
  job.requirements.engine={required:true,name:'Unity',version:'test',project:'test-project'};
  spec.engine_required=true;spec.gates.engine=['identity'];job.quality_spec=put('engine-spec.json',spec);
  accept('base_model');accept('polish');accept('motion');
  const {output}=exportAsset();assert.equal(inspectNext(base,job).action,'engine');
  fs.writeFileSync(path.join(base,output.path),'changed file');
  assert.throws(()=>currentExport(base,job));assert.equal(inspectNext(base,job).action,'export_for_engine');
  fs.writeFileSync(path.join(base,output.path),'SYNTHETIC export export');
  assert.ok(currentExport(base,job));
  const r=beginIteration(base,job,put('retry-plan.json',{job_id:job.job_id,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,operation:'export',format:'glb',authorization_evidence:'synthetic',success_checks:['identity'],protected_checks:['identity'],output_path:'retry.glb'}));
  finishIteration(base,job,put('failed-result.json',{job_id:job.job_id,iteration_id:r.id,status:'failed',summary:'synthetic failure',evidence:[evidence]}));
  assert.throws(()=>currentExport(base,job),/verified export required/);
  assert.equal(inspectNext(base,job).action,'resolve_budget');
}));

test('next reports unresolved active-stage limits and operation budgets without blocking evidence collection',()=>fixture(({base,job,spec,put,accept})=>{
  accept('base_model');spec.criteria.error.limit=null;job.quality_spec=put('spec-null.json',spec);
  job.gates={};accept('base_model');
  assert.deepEqual(inspectNext(base,job).blocked_by,['unresolved_limit:error']);
  spec.criteria.error.limit=1;job.quality_spec=put('spec-fixed.json',spec);job.gates={};accept('base_model');
  job.local_revisions.budgets={repair:0,creation:0,diagnostic:0,export:0};job.local_revisions.enforce_total=false;persist(base,job,{type:'fixture'});
  const next=inspectNext(base,job);assert.equal(next.action,'polish');
  assert.ok(next.operation_readiness.length);assert.ok(next.operation_readiness.every(o=>o.blocked_by.includes('Operation budget limit reached')));
}));

test('draft quality and export thresholds route to configuration before new work',()=>fixture(({base,job,spec,put,accept})=>{
  spec.status='draft';job.quality_spec=put('draft.json',spec);persist(base,job,{type:'fixture'});
  assert.deepEqual(inspectNext(base,job).blocked_by,['quality_spec_draft']);
  spec.status='active';spec.engine_required=true;spec.gates.engine=['identity'];spec.gates.final=['error'];spec.criteria.error.limit=null;
  job.requirements.engine={required:true,name:'Unity',version:'test',project:'test-project'};
  // Final-only unresolved metric does not block earlier stages.
  spec.gates.polish=['shape'];job.quality_spec=put('final-unknown.json',spec);
  accept('base_model');accept('polish');accept('motion');
  assert.deepEqual(inspectNext(base,job).blocked_by,['unresolved_limit:error']);
}));


test('completed diagnostics preserve conclusions and do not stop repair strategies',()=>fixture(({base,job,put,evidence,plan})=>{
  job.local_revisions.max_started=6;
  for(const [i,conclusion] of ['supported','refuted','inconclusive'].entries()){
    const doc=JSON.parse(fs.readFileSync(path.join(base,plan('diag-'+i,'diagnostic').path)));
    doc.defect_id='same-defect';doc.strategy_id='same-strategy';
    const round=beginIteration(base,job,put('plan-diag-'+i+'.json',doc));
    fs.writeFileSync(path.join(base,round.output_path),'synthetic diagnostic '+i);
    const result={job_id:job.job_id,iteration_id:round.id,status:'completed',summary:'diagnosis',evidence:[evidence],candidate:fileRef(base,round.output_path)};
    assert.throws(()=>finishIteration(base,job,put('missing-conclusion.json',result)),/Diagnostic conclusion/);
    finishIteration(base,job,put('diag-result-'+i+'.json',{...result,diagnostic_conclusion:conclusion}));
    assert.equal(round.outcome,'diagnostic_'+conclusion);
  }
  assert.equal(job.local_revisions.stopped_strategies.length,0);
  assert.equal(job.artifacts.candidate.path,'source.blend');
}));

test('visual fallback cannot replace unchanged metric or target unrelated visual check',()=>fixture(({base,job,put,evidence,report})=>{
  const candidate=fileRef(base,'candidate.blend'),before=report('b','polish'),after=report('a','polish',candidate);
  const c={before_report_sha256:before.sha256,after_report_sha256:after.sha256,source_sha256:job.artifacts.candidate.sha256,candidate_sha256:candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,reviewer:'user',observation:'synthetic',evidence:[evidence],decision:'improved'};
  const opts={success_checks:['error'],protected_checks:['shape']};
  assert.throws(()=>compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,after,{...opts,comparison:put('generic.json',c)}),/Per-criterion/);
  for(const name of ['error','shape'])assert.throws(()=>compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,after,{...opts,comparison:put('wrong-'+name+'.json',{...c,checks:[{name,decision:'improved',observation:'synthetic',evidence:[evidence]}]})}),/visual success/);
}));

test('comparison tolerances suppress noise but never relax final acceptance',()=>fixture(({base,job,spec,put,report})=>{
  spec.criteria.error.comparison={absolute:1e-6,relative:1e-5,minimum_improvement:0.01};job.quality_spec=put('tolerant-spec.json',spec);
  const c=fileRef(base,'candidate.blend'),before=report('b','polish',job.artifacts.candidate,0.5);
  const opts={success_checks:['error'],protected_checks:['shape']};
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,c,before,report('noise','polish',c,0.5-1e-12),opts),false);
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,c,before,report('small','polish',c,0.495),opts),false);
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,c,before,report('large','polish',c,0.45),opts),true);
  assert.equal(evaluateReport(base,job,'polish',report('over','polish',job.artifacts.candidate,1.00000001)).action,'blocked');
}));

test('local comparison retains progress without passing unknown final criteria',()=>fixture(({base,job,spec,put,evidence,plan,report})=>{
  spec.gates.polish.push('later');spec.criteria.later={kind:'assertion',description:'Deferred unrelated check'};job.quality_spec=put('local-spec.json',spec);
  const doc=JSON.parse(fs.readFileSync(path.join(base,plan('local').path)));doc.comparison_scope='local';
  const round=beginIteration(base,job,put('local-plan.json',doc));fs.writeFileSync(path.join(base,round.output_path),'synthetic partial progress');const candidate=fileRef(base,round.output_path);
  const before=report('local-b','polish',round.baseline,0.8,'later'),after=report('local-a','polish',candidate,0.2,'later');
  finishIteration(base,job,put('local-result.json',{job_id:job.job_id,iteration_id:round.id,status:'completed',summary:'partial',evidence:[evidence],candidate,baseline_report:before,candidate_report:after}));
  assert.equal(round.outcome,'improved');assert.equal(job.status,'needs_revision');assert.deepEqual(job.gates,{});
  assert.equal(evaluateReport(base,job,'polish',after).action,'blocked');
}));

test('rig-only asset requires rig gate and no invented clip',()=>fixture(({base,job,spec,put,accept,report,plan})=>{
  const template=qualityTemplate(false,{profile:'deforming-character',rig_required:true});
  assert.equal(template.rig_required,true);assert.ok(template.gates.rig.includes('weights'));assert.equal(template.motion_required,false);
  spec.motion_required=false;spec.rig_required=true;spec.gates.rig=['bones','weights'];
  spec.criteria.bones={kind:'assertion',description:'Bone structure'};spec.criteria.weights={kind:'assertion',description:'Semantic weights'};
  job.requirements={motion_required:false,rig_required:true,intent:'rig only'};job.quality_spec=put('rig-spec.json',spec);
  accept('base_model');accept('polish');assert.equal(projection(job).next_action,'rig');
  assert.throws(()=>accept('final'),/rig/);assert.throws(()=>beginIteration(base,job,plan('early-export','export')),/rig/);
  const bad=report('rig-missing','rig',job.artifacts.candidate,0.5,'weights');assert.equal(evaluateGate(base,job,'rig',bad).action,'blocked');
  accept('rig');accept('final');assert.equal(job.status,'accepted');
}));

test('weight repair is offered at rig and requires accepted predecessors and explicit weights checks',()=>fixture(({base,job,spec,put,accept,plan})=>{
  spec.rig_required=true;spec.motion_required=false;spec.gates.rig=['weights','error'];
  spec.criteria.weights={kind:'assertion',description:'Semantic weights'};
  job.requirements={rig_required:true,motion_required:false};job.quality_spec=put('weights-spec.json',spec);
  const missing=plan('missing-weights','weight_repair');
  assert.throws(()=>beginIteration(base,job,missing),/include weights/);
  const request=plan('repair-weights','weight_repair',['weights']);
  assert.throws(()=>beginIteration(base,job,request),/Prerequisite not accepted: base_model/);
  accept('base_model');
  assert.ok(!inspectNext(base,job).operation_readiness.some(x=>x.operation==='weight_repair'));
  assert.throws(()=>beginIteration(base,job,request),/Prerequisite not accepted: polish/);
  assert.equal(job.local_revisions.records.length,0);
  accept('polish');
  assert.ok(inspectNext(base,job).operation_readiness.some(x=>x.operation==='weight_repair'&&x.mode==='repair'));
  assert.equal(beginIteration(base,job,request).stage,'rig');
}));

for(const weightStatus of ['omitted','unknown','fail','pass'])test(`weight repair local comparison with improved metric and ${weightStatus} weights`,()=>fixture(({base,job,spec,put,accept,plan,report,evidence})=>{
  spec.rig_required=true;spec.motion_required=false;spec.gates.rig=['weights','error'];
  spec.criteria.weights={kind:'assertion',description:'Semantic weights'};
  job.requirements={rig_required:true,motion_required:false};job.quality_spec=put('weights-spec.json',spec);
  accept('base_model');accept('polish');
  const doc=JSON.parse(fs.readFileSync(path.join(base,plan('weight-work','weight_repair',['weights']).path)));
  doc.comparison_scope='local';const round=beginIteration(base,job,put('weight-plan.json',doc));
  fs.writeFileSync(path.join(base,round.output_path),'SYNTHETIC weight repair');const candidate=fileRef(base,round.output_path);
  const before=report('before-rig','rig',round.baseline,0.8);
  const afterDoc=JSON.parse(fs.readFileSync(path.join(base,report('after-rig','rig',candidate,0.2).path)));
  if(weightStatus==='omitted')afterDoc.checks=afterDoc.checks.filter(x=>x.name!=='weights');
  else afterDoc.checks.find(x=>x.name==='weights').status=weightStatus;
  const result={job_id:job.job_id,iteration_id:round.id,status:'completed',summary:'Synthetic weight repair',evidence:[evidence],candidate,baseline_report:before,candidate_report:put('after-weight.json',afterDoc)};
  assert.throws(()=>finishIteration(base,job,put('wrong-stage-result.json',{...result,candidate_report:report('wrong-polish','polish',candidate,0.2)})),/Report identity/);
  finishIteration(base,job,put('weight-result.json',result));
  assert.equal(round.outcome,weightStatus==='pass'?'improved':'no_improvement');
  assert.equal(job.artifacts.candidate.sha256,weightStatus==='pass'?candidate.sha256:round.baseline.sha256);
  if(weightStatus==='pass'){assert.deepEqual(job.gates,{});assert.notEqual(job.status,'accepted');}
}));

for(const legacyStage of ['motion','polish'])test(`legacy weight repair follows explicit ${legacyStage} weights without migrating the standard`,()=>fixture(({base,job,spec,put,accept,plan})=>{
  spec.motion_required=legacyStage==='motion';job.requirements.motion_required=spec.motion_required;
  spec.gates[legacyStage].push('weights');spec.criteria.weights={kind:'assertion',description:'Legacy semantic weights'};
  job.quality_spec=put('legacy-weights.json',spec);const originalSpec=job.quality_spec.sha256;
  accept('base_model');if(legacyStage==='motion')accept('polish');
  assert.ok(inspectNext(base,job).operation_readiness.some(x=>x.operation==='weight_repair'));
  assert.equal(beginIteration(base,job,plan('legacy-weight','weight_repair',['weights'])).stage,legacyStage);
  assert.equal(job.quality_spec.sha256,originalSpec);
}));

test('rigid or absent weight criteria cannot silently fall back to a weaker weight gate',()=>fixture(({base,job,spec,put,accept,plan})=>{
  spec.rig_required=true;spec.gates.rig=['clip'];spec.gates.motion.push('weights');
  spec.criteria.weights={kind:'assertion',description:'Weights'};
  job.requirements.rig_required=true;job.quality_spec=put('rigid-weights.json',spec);
  accept('base_model');accept('polish');
  assert.ok(!inspectNext(base,job).operation_readiness.some(x=>x.operation==='weight_repair'));
  assert.throws(()=>beginIteration(base,job,plan('invalid-weight','weight_repair',['weights'])),/applicable weights criterion/);
  spec.gates.rig.push('weights');spec.criteria.weights.applicable=false;spec.criteria.weights.exception_reason='Rigid parts have no skinning';
  job.quality_spec=put('exempt-weights.json',spec);
  assert.throws(()=>beginIteration(base,job,plan('exempt-weight','weight_repair',['weights'])),/applicable weights criterion/);
  assert.equal(job.local_revisions.records.length,0);
}));


test('default numerical floor ignores tiny deltas and measurement contract checks frozen conditions',()=>fixture(({base,job,spec,put,report})=>{
  const candidate=fileRef(base,'candidate.blend'),before=report('tiny-b','polish',job.artifacts.candidate,0.5),after=report('tiny-a','polish',candidate,0.5-1e-12);
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,after,{success_checks:['error'],protected_checks:['shape']}),false);
  const conditions={samples:[1,1.5,2],reference_frame:1,scale:1,regions:[{name:'test'}]};
  spec.measurement_contract={collector_sha256:'a'.repeat(64),blender_version:'test',conditions};job.quality_spec=put('provenance-spec.json',spec);
  const r=report('provenance','polish'),doc=readJSONLocal(r),raw=readJSONLocal(doc.checks.find(c=>c.name==='error').measurement.file);
  function readJSONLocal(ref){return JSON.parse(fs.readFileSync(path.join(base,ref.path)));}
  const config=put('config.json',{...conditions,source_sha256:job.artifacts.candidate.sha256,suite_id:spec.suite_id});
  raw.config=config;raw.collector_sha256='a'.repeat(64);raw.blender_version='test';
  const rawRef=put('provenance-data.json',raw);doc.checks.find(c=>c.name==='error').measurement.file=rawRef;doc.checks.find(c=>c.name==='error').evidence=[rawRef];
  assert.notEqual(evaluateReport(base,job,'polish',put('provenance-good.json',doc)).action,'blocked');
  raw.config=put('changed-config.json',{...conditions,samples:[1,2],source_sha256:job.artifacts.candidate.sha256,suite_id:spec.suite_id});
  const bad=put('bad-raw.json',raw);doc.checks.find(c=>c.name==='error').measurement.file=bad;doc.checks.find(c=>c.name==='error').evidence=[bad];
  assert.throws(()=>evaluateReport(base,job,'polish',put('bad-provenance.json',doc)),/conditions changed/);
}));


test('new templates require frozen evidence and separate rigid from mixed rig requirements',()=>{
  const rigid=qualityTemplate(false,{rig_required:true,structure:'rigid'});
  assert.equal(rigid.criteria.weights.applicable,false);
  assert.ok(rigid.gates.rig.includes('joint_ranges'));
  assert.ok(!rigid.gates.rig.includes('weights'));
  validateSpec(rigid);rigid.status='active';
  assert.throws(()=>validateSpec(rigid),/Visual capture contract/);
  const skin=qualityTemplate(false,{rig_required:true});skin.status='active';
  assert.throws(()=>validateSpec(skin),/Measurement contract/);
  const mixed=qualityTemplate(false,{rig_required:true,structure:'mixed'});mixed.status='active';
  assert.ok(mixed.gates.rig.includes('weights'));assert.ok(mixed.gates.rig.includes('rigid_attachments'));
  assert.throws(()=>validateSpec(mixed),/Mixed structure regions/);
});

test('visual capture conditions, effective settings and image hashes bind comparisons',()=>fixture(({base,job,spec,put,report})=>{
  const conditions={scene:'Scene',view_layer:'ViewLayer',views:[{name:'front'}],resolution:[64,64],samples:4,transparent:false,color:{exposure:0},display_device:'sRGB',lights:[],world_color:[0,0,0],world_strength:1};
  spec.visual_contract={collector_sha256:'b'.repeat(64),blender_version:'test',conditions};job.quality_spec=put('visual-spec.json',spec);
  function captured(name,source,effective={exposure:0},changed=conditions){
    const config=put(name+'-config.json',{source_sha256:source.sha256,suite_id:spec.suite_id,blender_version:'test',conditions:changed});
    const image=put(name+'-image.json',{synthetic:true});
    const capture=put(name+'-capture.json',{source_sha256:source.sha256,suite_id:spec.suite_id,blender_version:'test',collector_sha256:'b'.repeat(64),config,effective_conditions:effective,captures:[{name:'front',image}]});
    const ref=report(name,'polish',source,name==='b'?.8:.2),doc=JSON.parse(fs.readFileSync(path.join(base,ref.path)));
    doc.checks.find(x=>x.name==='shape').visual_capture=capture;
    return put(name+'-bound.json',doc);
  }
  const before=captured('b',job.artifacts.candidate),candidate=fileRef(base,'candidate.blend');
  const after=captured('a',candidate);
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,after),true);
  assert.throws(()=>compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,captured('bad',candidate,{exposure:1})),/Effective visual/);
  assert.throws(()=>evaluateReport(base,job,'polish',captured('changed',job.artifacts.candidate,{}, {...conditions,samples:8})),/conditions mismatch/);
  const comparison={before_report_sha256:before.sha256,after_report_sha256:after.sha256,source_sha256:job.artifacts.candidate.sha256,candidate_sha256:candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,reviewer:'user',decision:'improved',observation:'synthetic',evidence:[fileRef(base,'a-image.json')],checks:[{name:'shape',decision:'improved',observation:'synthetic',evidence:[fileRef(base,'a-image.json')]}]};
  assert.throws(()=>compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,after,{success_checks:['shape'],comparison:put('incomplete-visual.json',comparison)}),/cite frozen/);
  comparison.checks[0].evidence.push(fileRef(base,'b-image.json'));
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,candidate,before,after,{success_checks:['shape'],comparison:put('complete-visual.json',comparison)}),true);
  fs.writeFileSync(path.join(base,'a-image.json'),'changed');
  assert.throws(()=>evaluateReport(base,job,'polish',after,candidate),/File changed/);
  assert.equal(evaluateReport(base,job,'polish',report('missing-capture','polish')).action,'blocked');
}));

test('new production cannot omit or downgrade evidence policy',()=>fixture(({base,job,report})=>{
  job.evidence_policy_required=true;
  assert.throws(()=>evaluateReport(base,job,'polish',report('legacy-denied','polish')),/full evidence policy/);
}));
