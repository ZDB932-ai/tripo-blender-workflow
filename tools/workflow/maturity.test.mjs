import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {atomicJSON,fileRef,readJSON} from './production-io.mjs';
import {newProduction,persist,inspectNext,inspectProduction,selectRemote,attachSource,reviewBundle} from './production.mjs';
import {transition,root} from './workflow.mjs';
import {validateTransferReview} from './remote-routing.mjs';
import {qualityTemplate} from './quality-template.mjs';
import {validateRegionVariants,verifyMeasurementContract} from './measurement-contract.mjs';
import {compareReports} from './quality.mjs';

function fixture(fn){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-maturity-test-'));
  try{
    const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
    fs.writeFileSync(path.join(base,'source.blend'),'synthetic original');
    fs.writeFileSync(path.join(base,'new.blend'),'synthetic result');
    const spec={schema_version:2,status:'active',suite_id:'fixture',motion_required:false,basis:'test',gates:{base_model:['identity'],polish:['identity'],final:['identity']},criteria:{identity:{kind:'assertion',description:'Identity'}}};
    const job=newProduction('test',put('spec.json',spec));job.evidence_policy_required=false;
    job.artifacts.candidate=fileRef(base,'source.blend');persist(base,job,{type:'fixture'});
    const request=run_id=>put('select-'+run_id+'.json',{run_id,source_sha256:job.artifacts.candidate?.sha256||null,purpose:'postprocessing',reason:'Synthetic scope'});
    fn({base,put,job,spec,request});
  }finally{
    assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-maturity-test-'));fs.rmSync(base,{recursive:true,force:true});
  }
}
test('completed remote work on an existing candidate requires explicit selection and survives reload',()=>fixture(({base,put,job,request})=>{
  for(const status of ['planned','studio_result_ready','qa_review','export_failed','downloaded']){
    put('runs/new/state.json',{status});assert.equal(inspectNext(base,job).action,'select_source_run');
  }
  put('runs/new/state.json',{status:'studio_result_ready'});
  assert.equal(selectRemote(base,job,request('new')).skill,'tripo-studio-refine');
  assert.equal(inspectNext(base,readJSON(path.join(base,'production.json'))).run,'new');
  const original=job.artifacts.candidate;
  assert.equal(inspectNext(base,job).action,'studio_result_ready');assert.deepEqual(job.artifacts.candidate,original);
  put('runs/new/state.json',{status:'exporting'});
  put('runs/new/transfer-result.json',{run_id:'new',status:'received',candidate:fileRef(base,'new.blend'),source_identity:'synthetic version'});
  assert.equal(inspectNext(base,job).action,'exporting');assert.equal(inspectNext(base,job).skill,'tripo-studio-deliver');
  attachSource(base,job,put('attach.json',{reason:'Synthetic checked import',run_id:'new',candidate:fileRef(base,'new.blend')}));
  assert.equal(job.active_remote_run,null);assert.equal(inspectNext(base,job).action,'base_model');
}));
test('multiple runs may be explicitly deferred but unresolved submission cannot be hidden',()=>fixture(({base,put,job,request})=>{
  put('runs/a/state.json',{status:'planned'});put('runs/b/state.json',{status:'studio_result_ready'});
  assert.equal(inspectNext(base,job).runs.length,2);
  selectRemote(base,job,request('a'),true);assert.equal(inspectNext(base,job).runs.length,1);
  selectRemote(base,job,request('b'));assert.throws(()=>selectRemote(base,job,request('a')),/Defer/);
  put('runs/a/state.json',{status:'processing'});assert.equal(inspectNext(base,job).action,'reconcile_remote');
  assert.throws(()=>selectRemote(base,job,request('a'),true),/Reconcile/);
}));
test('selected remote source drift is visible and never attaches automatically',()=>fixture(({base,put,job,request})=>{
  put('runs/a/state.json',{status:'studio_result_ready'});selectRemote(base,job,request('a'));
  job.artifacts.candidate=fileRef(base,'new.blend');persist(base,job,{type:'test-source-change'});
  assert.equal(inspectNext(base,job).action,'resolve_remote_source');
  assert.throws(()=>attachSource(base,job,put('attach.json',{reason:'test',run_id:'a',candidate:fileRef(base,'new.blend')})),/source changed/);
}));
test('QA in progress resumes inspection; transfer needs bound completed or diagnostic review',()=>fixture(({base,put,job})=>{
  job.artifacts.candidate=null;put('handoff.json',{});
  put('runs/a/state.json',{status:'qa_review'});assert.equal(inspectNext(base,job).skill,'tripo-studio-refine');
  assert.throws(()=>transition('qa_review','exporting','test'),/Invalid transition/);
  assert.equal(transition('qa_review','diagnostic_transfer','test'),'diagnostic_transfer');
  const plan=put('runs/a/plan.json',{operation:'generate'});
  const r={run_id:'a',plan_sha256:plan.sha256,source_identity:'studio-version-1',disposition:'diagnostic_transfer',observation:'Mesh unknown',reason:'Need internal audit',evidence:[plan]};
  const state={status:r.disposition,transfer_plan_sha256:plan.sha256,transfer_review:put('transfer-review.json',r)};
  put('runs/a/state.json',state);assert.equal(inspectNext(base,job).skill,'tripo-studio-deliver');
  put('runs/a/plan.json',{operation:'different'});assert.throws(()=>validateTransferReview(base,'a',state),/File changed/);
}));
test('stale or unreadable projection warns without hiding remote reconciliation; static unused metrics are excluded',()=>fixture(({base,put,job})=>{
  put('runs/a/state.json',{status:'processing'});fs.writeFileSync(path.join(base,'handoff.json'),'invalid json');
  const next=inspectNext(base,job);assert.equal(next.action,'reconcile_remote');assert.equal(next.warnings.length,1);
  const spec=qualityTemplate(false);job.quality_spec=put('static.json',spec);job.evidence_policy_required=true;
  assert.deepEqual(inspectProduction(base,job).unresolved_limits,[]);
  fs.writeFileSync(path.join(base,'source.blend'),'tampered');assert.equal(inspectNext(base,job).action,'repair_records');
}));
test('review bundle previews without acceptance and commits only all valid same-candidate user decisions',()=>fixture(({base,put,job,spec})=>{
  const items=['base_model','polish'].map(stage=>{
    const report=put(stage+'-report.json',{schema_version:2,job_id:job.job_id,stage,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,suite_id:spec.suite_id,checks:[{name:'identity',status:'pass',observation:'synthetic',evidence:[job.artifacts.candidate]}]});
    const decision=put(stage+'-decision.json',{job_id:job.job_id,stage,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:report.sha256,reviewer:'user',decision:'accepted',evidence:'Synthetic review covers both listed gates'});
    return {stage,report,decision};
  });
  const request={job_id:job.job_id,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,items};
  const before=fs.readFileSync(path.join(base,'production.json'),'utf8');
  assert.equal(reviewBundle(base,job,put('bundle.json',request)).action,'bundle_review');assert.deepEqual(job.gates,{});
  const bad=structuredClone(request);bad.items[1].decision=put('wrong-decision.json',{...readJSON(path.join(base,items[1].decision.path)),reviewer:'ai'});
  assert.throws(()=>reviewBundle(base,job,put('bad-bundle.json',bad),true),/Reviewer/);
  assert.equal(fs.readFileSync(path.join(base,'production.json'),'utf8'),before);assert.deepEqual(job.gates,{});
  assert.equal(reviewBundle(base,job,put('bundle.json',request),true).status,'ready');assert.equal(job.gates.polish.status,'accepted');
  assert.equal(inspectProduction(base,job).valid,true);
}));
test('frozen topology mapping retains sample semantics and validates actual reference positions',()=>fixture(({base,put,job})=>{
  const region={name:'protected',object:'Mesh',indices:[0,1],sample_ids:['left','right'],topology_sha256:'1'.repeat(64),kind:'protected',space:'world',metrics:{displacement:'error'}};
  const conditions={samples:[1,2],reference_frame:1,scale:1,regions:[region]};
  const contract={collector_sha256:'2'.repeat(64),blender_version:'fixture',conditions};
  const config={...conditions,source_sha256:job.artifacts.candidate.sha256,suite_id:'fixture',blender_version:'fixture'};
  const raw={source_sha256:config.source_sha256,suite_id:'fixture',collector_sha256:contract.collector_sha256,blender_version:'fixture',config:put('before-config.json',config),units:{error:'ratio'},values:{error:.8},regions:{protected:{object:'Mesh',space:'world',topology_sha256:region.topology_sha256,reference_positions:[[0,0,0],[1,0,0]]}}};
  const variant={id:'retopo',basis:'Known corresponding sampled points',max_reference_error:.01,evidence:[job.artifacts.candidate],baseline_source:job.artifacts.candidate,baseline_measurement:put('before-raw.json',raw),regions:[{...region,indices:[2,3],topology_sha256:'3'.repeat(64)}]};
  contract.region_variants=[variant];validateRegionVariants(contract);
  const afterConfig={...config,source_sha256:fileRef(base,'new.blend').sha256,regions:variant.regions,mapping_variant:'retopo'};
  const after={...raw,source_sha256:afterConfig.source_sha256,values:{error:.4},config:put('after-config.json',afterConfig),regions:{protected:{...raw.regions.protected,topology_sha256:'3'.repeat(64)}}};
  verifyMeasurementContract(base,contract,after,after.source_sha256);
  const spec={schema_version:2,status:'active',motion_required:false,suite_id:'fixture',basis:'synthetic',measurement_contract:contract,gates:{base_model:['error'],polish:['error'],final:['error']},criteria:{error:{kind:'metric',description:'mapped movement',operator:'lte',unit:'ratio',limit:1}}};
  job.quality_spec=put('mapped-spec.json',spec);
  const report=(name,source,data)=>{const ref=put(name+'-raw.json',data);return put(name+'-report.json',{schema_version:2,job_id:job.job_id,stage:'polish',source_sha256:source.sha256,quality_spec_sha256:job.quality_spec.sha256,suite_id:'fixture',checks:[{name:'error',evidence:[ref],measurement:{file:ref,pointer:'/values/error'}}]});};
  const candidate=fileRef(base,'new.blend');
  assert.equal(compareReports(base,job,'polish',job.artifacts.candidate,candidate,report('before',job.artifacts.candidate,raw),report('after',candidate,after),{success_checks:['error'],protected_checks:['error']}),true);
  after.regions.protected.reference_positions=[[0,0,0],[1.2,0,0]];
  assert.throws(()=>verifyMeasurementContract(base,contract,after,after.source_sha256),/reference error/);
  const changed=structuredClone(contract);changed.region_variants[0].regions[0].sample_ids=[...changed.region_variants[0].regions[0].sample_ids].reverse();assert.throws(()=>validateRegionVariants(changed),/semantics/);
  const missing=structuredClone(contract);missing.region_variants[0].regions[0].indices=[2];assert.throws(()=>validateRegionVariants(missing),/coverage/);
}));
test('CLI preserves transfer review through a failed export and refuses a changed plan on retry',()=>{
  const id='maturity-cli-'+Date.now(),base=path.join(root,'assets',id);
  const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
  const run=(state,evidence)=>spawnSync(process.execPath,[path.join(root,'tools/workflow/workflow.mjs'),'mark',id,'001',state,evidence],{encoding:'utf8',windowsHide:true});
  try{
    const plan=put('runs/001/plan.json',{operation:'generate'});put('runs/001/state.json',{status:'qa_review'});
    const report=put('review.json',{run_id:'001',plan_sha256:plan.sha256,source_identity:'synthetic asset version',disposition:'ready_for_transfer',reason:'test',observation:'synthetic checked',evidence:[plan]});
    assert.equal(run('exporting','premature').status,1);
    assert.equal(run('ready_for_transfer',report.path).status,0);
    assert.equal(run('exporting','test intent').status,0);
    assert.equal(run('export_failed','test download failure').status,0);
    const state=readJSON(path.join(base,'runs/001/state.json'));
    assert.equal(state.transfer_review.sha256,report.sha256);assert.equal(state.transfer_disposition,'ready_for_transfer');
    put('runs/001/plan.json',{operation:'changed'});assert.notEqual(run('exporting','retry').status,0);
    assert.equal(readJSON(path.join(base,'runs/001/state.json')).status,'export_failed');
  }finally{
    assert.equal(path.dirname(path.resolve(base)),path.join(root,'assets'));assert.ok(path.basename(base).startsWith('maturity-cli-'));fs.rmSync(base,{recursive:true,force:true});
  }
});
