import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {atomicJSON,fileRef,readJSON} from './production-io.mjs';
import {newProduction,persist,beginIteration,finishIteration,evaluateGate,recordDecision,configure,inspectProduction,budgetBlockers,setIterationPolicy,simplifyWorkflow} from './production.mjs';
import {evaluateReport,assertAccepted} from './quality.mjs';
import {checkAssetScope} from './policy.mjs';
import {checkPlan,hash} from './workflow.mjs';

function fixture(fn){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-production-test-'));
  try{
    const put=(p,obj)=>{atomicJSON(path.join(base,p),obj);return fileRef(base,p);};
    fs.writeFileSync(path.join(base,'source.blend'),'synthetic source');
    fs.writeFileSync(path.join(base,'view.png'),'synthetic evidence');
    const spec={schema_version:2,status:'active',suite_id:'fixed-pose-v1',motion_required:true,basis:'synthetic test',
      gates:{base_model:['identity'],polish:['shape','strain'],motion:['shape','strain'],final:['shape','strain']},
      criteria:{identity:{kind:'assertion',description:'Identity'},shape:{kind:'visual',description:'Shape'},strain:{kind:'metric',description:'Strain',operator:'lte',unit:'ratio',limit:1.5}}};
    const job=newProduction('fixture',put('spec.json',spec));job.evidence_policy_required=false;
    job.execution_required=false;
    job.requirements={motion_required:true,intent:'forward run',evidence:'test'};
    job.artifacts.candidate=fileRef(base,'source.blend');job.local_revisions.max_started=5;
    const report=(name,stage,source=job.artifacts.candidate,value=1.2)=>{
      const raw=put(`${name}-raw.json`,{source_sha256:source.sha256,suite_id:spec.suite_id,units:{strain:'ratio'},strain:value});
      return put(name+'.json',{schema_version:2,job_id:job.job_id,stage,source_sha256:source.sha256,quality_spec_sha256:job.quality_spec.sha256,suite_id:spec.suite_id,
        checks:spec.gates[stage].map(n=>n==='strain'?{name:n,status:'pass',evidence:[raw],measurement:{file:raw,pointer:'/strain'}}:{name:n,status:'pass',evidence:[fileRef(base,'view.png')],observation:'test visual observation'}),
        ...(stage==='final'?{deliverables:[source]}:{})});
    };
    const decide=(stage,r,reviewer='user')=>put(`decision-${stage}.json`,{job_id:job.job_id,stage,decision:'accepted',reviewer,evidence:'synthetic test decision',source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:r.sha256});
    const accept=(stage)=>{const r=report('report-'+stage,stage);evaluateGate(base,job,stage,r);recordDecision(base,job,stage,decide(stage,r));};
    const plan=(name='plan',strategy='local-interface',operation='geometry_repair')=>put(name+'.json',{job_id:job.job_id,quality_spec_sha256:job.quality_spec.sha256,source_sha256:job.artifacts.candidate.sha256,operation,format:'glb',defect_id:'hip',strategy_id:strategy,hypothesis:'specific interface experiment',authorization_evidence:'synthetic test scope',success_checks:['strain'],protected_checks:['shape'],output_path:name+'.blend'});
    persist(base,job,{type:'fixture'});
    fn({base,job,spec,put,report,decide,accept,plan});
  }finally{
    const resolved=path.resolve(base);
    if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('tripo-production-test-'))throw Error('Unsafe cleanup');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}
test('missing policy rejects new submissions; source mutation rejects postprocessing',()=>fixture(({base,put})=>{
  assert.throws(()=>checkAssetScope(base,'001',{}),/policy missing/);
  fs.writeFileSync(path.join(base,'ref.png'),'reference');
  put('ref.json',{files:[fileRef(base,'ref.png')],decision:{status:'approved',evidence:'test'}});
  const p={operation:'rig',reference_manifest:'ref.json',reference_manifest_sha256:hash(path.join(base,'ref.json')),backend:'tripo_studio_browser',billing_source:'studio',candidate_count:1,quoted_credits:20,observed_at:new Date().toISOString(),ui_evidence:'view.png',source_file:'source.blend',source_sha256:hash(path.join(base,'source.blend')),source_run_id:'001',source_asset_url:'test',source_version:null};
  const a={status:'approved',evidence:'test',max_credits:20};checkPlan(base,p,a);
  fs.writeFileSync(path.join(base,'source.blend'),'changed');assert.throws(()=>checkPlan(base,p,a),/source changed/);
}));
test('gate verifies identity, evidence, numeric values and frozen applicability',()=>fixture(({base,job,put,report})=>{
  const r=report('bad','polish',job.artifacts.candidate,9);
  assert.equal(evaluateReport(base,job,'polish',r).action,'blocked');
  const doc=readJSON(path.join(base,r.path));doc.checks[1]={name:'strain',status:'not_applicable',reason:'skip'};
  assert.equal(evaluateReport(base,job,'polish',put('waive.json',doc)).action,'blocked');
  doc.source_sha256='0'.repeat(64);assert.throws(()=>evaluateReport(base,job,'polish',put('stale.json',doc)),/identity/);
  const good=report('good','polish');fs.writeFileSync(path.join(base,'view.png'),'changed evidence');
  assert.throws(()=>evaluateReport(base,job,'polish',good),/File changed/);
}));
test('prerequisite gates and reviewer identity prevent premature motion; full chain accepts final',()=>fixture(({base,job,accept,report,decide,plan})=>{
  assert.throws(()=>beginIteration(base,job,plan('early','strategy','motion')),/Prerequisite/);
  accept('base_model');const r=report('polish','polish');evaluateGate(base,job,'polish',r);
  assert.throws(()=>recordDecision(base,job,'polish',decide('polish',r,'ai')),/Reviewer/);
  recordDecision(base,job,'polish',decide('polish',r));accept('motion');accept('final');
  assert.equal(job.status,'accepted');assertAccepted(base,job,'final');assert.equal(inspectProduction(base,job).valid,true);
}));
test('started batch survives reload, blocks duplicate and counts failure; strategy stops after two',()=>fixture(({base,job,put,plan})=>{
  for(let i=0;i<2;i++){
    const r=beginIteration(base,job,plan('try'+i));
    assert.equal(readJSON(path.join(base,'production.json')).local_revisions.records.at(-1).status,'started');
    assert.throws(()=>beginIteration(base,job,plan('parallel')),/still started/);
    finishIteration(base,job,put('result'+i+'.json',{job_id:job.job_id,iteration_id:r.id,status:'failed',summary:'test no improvement',evidence:[fileRef(base,'view.png')]}));
  }
  assert.throws(()=>beginIteration(base,job,plan('third')),/Strategy stopped/);
  job.local_revisions.max_started=2;
  assert.throws(()=>beginIteration(base,job,plan('different','different')),/limit reached/);
}));
test('candidate improvement invalidates gates; local regression cannot be promoted',()=>fixture(({base,job,put,report,plan,accept})=>{
  accept('base_model');accept('polish');const beforeSource=job.artifacts.candidate;
  const r=beginIteration(base,job,plan('better'));
  fs.writeFileSync(path.join(base,'better.blend'),'better candidate');const candidate=fileRef(base,'better.blend');
  const result=put('result.json',{job_id:job.job_id,iteration_id:r.id,status:'completed',summary:'test improved',evidence:[fileRef(base,'view.png')],candidate,baseline_report:report('before','polish',beforeSource,1.4),candidate_report:report('after','polish',candidate,1.2)});
  finishIteration(base,job,result);assert.deepEqual(job.artifacts.candidate,candidate);assert.deepEqual(job.gates,{});
  const r2=beginIteration(base,job,plan('worse','second-strategy'));
  fs.writeFileSync(path.join(base,'worse.blend'),'worse candidate');const worse=fileRef(base,'worse.blend');
  finishIteration(base,job,put('worse-result.json',{job_id:job.job_id,iteration_id:r2.id,status:'completed',summary:'regression',evidence:[fileRef(base,'view.png')],candidate:worse,baseline_report:report('before2','polish',candidate,1.2),candidate_report:report('after2','polish',worse,2)}));
  assert.deepEqual(job.artifacts.candidate,candidate);assert.equal(job.local_revisions.records.at(-1).outcome,'no_improvement');
}));
test('spec changes invalidate decisions without resetting attempts; draft/unknown limits cannot pass',()=>fixture(({base,job,spec,put,report,accept})=>{
  accept('base_model');const next=structuredClone(spec);next.criteria.strain.limit=null;
  configure(base,job,put('configure.json',{reason:'test new requirements',evidence:'test user scope',quality_spec:put('spec-v2.json',next),requirements:job.requirements,max_started:job.local_revisions.max_started,review_mode:'guided'}));
  assert.deepEqual(job.gates,{});assert.equal(evaluateReport(base,job,'polish',report('unknown','polish')).action,'blocked');
}));
test('legacy review CLI fails closed',()=>{
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('./review.mjs',import.meta.url)),'autonomous','motion','fake.json','spec.json'],{encoding:'utf8'});
  assert.notEqual(cli.status,0);assert.match(cli.stderr,/legacy declaration-only review is disabled/);
});
test('export roundtrip preserves master and requires final user decision',()=>fixture(({base,job,put,plan,report,accept,decide})=>{
  accept('base_model');accept('polish');accept('motion');const master=job.artifacts.candidate;
  const batch=beginIteration(base,job,plan('export','export-format','export'));
  fs.writeFileSync(path.join(base,'export.blend'),'synthetic exported data');const exported=fileRef(base,'export.blend');
  const reportRef=report('export-review','final');const doc=readJSON(path.join(base,reportRef.path));doc.deliverables=[exported];doc.export_iteration_id=batch.id;const finalReport=put('export-review.json',doc);
  finishIteration(base,job,put('export-result.json',{job_id:job.job_id,iteration_id:batch.id,status:'completed',summary:'verified',evidence:[fileRef(base,'view.png')],candidate:exported,candidate_report:finalReport}));
  assert.deepEqual(job.artifacts.candidate,master);assert.equal(job.local_revisions.records.at(-1).outcome,'export_verified');assert.notEqual(job.status,'accepted');
  evaluateGate(base,job,'final',finalReport);recordDecision(base,job,'final',decide('final',finalReport));assert.deepEqual(job.artifacts.final_files,[exported]);
}));
test('existing approved cap is honored and stale accepted evidence cannot authorize mutation',()=>fixture(({base,job,put,plan,accept})=>{
  put('workflow-policy.json',{status:'approved',max_local_revision_rounds:0});
  assert.throws(()=>beginIteration(base,job,plan()),/limit reached/);
  put('workflow-policy.json',{status:'approved',max_local_revision_rounds:5});accept('base_model');accept('polish');
  fs.writeFileSync(path.join(base,'view.png'),'modified view');
  assert.throws(()=>beginIteration(base,job,plan('motion','motion-strategy','motion')),/File changed/);
}));


test('progress policy preserves records and gates while replacing old quotas',()=>fixture(({base,job,accept})=>{
  accept('base_model');const gates=structuredClone(job.gates);
  job.local_revisions.max_started=0;
  assert.ok(budgetBlockers(base,job,'geometry_repair').length);
  assert.throws(()=>setIterationPolicy(base,job,{mode:'progress_guarded'}),/instruction/);
  setIterationPolicy(base,job,{mode:'progress_guarded',evidence:'test user requested progress-based retries'});
  assert.deepEqual(budgetBlockers(base,job,'geometry_repair'),[]);
  assert.deepEqual(job.gates,gates);
  setIterationPolicy(base,job,{mode:'explicit_budget',evidence:'test user restores cap'});
  assert.ok(budgetBlockers(base,job,'geometry_repair').length);
}));
test('progress plateau spans renamed defects but leaves diagnosis and export available',()=>fixture(({base,job})=>{
  job.local_revisions.iteration_policy={mode:'progress_guarded',evidence:'test'};
  job.local_revisions.records=Array.from({length:6},(_,i)=>({id:'r'+i,operation:'geometry_repair',defect_id:'renamed'+i,status:'failed',outcome:'no_improvement'}));
  assert.match(budgetBlockers(base,job,'geometry_repair')[0],/plateau/);
  assert.deepEqual(budgetBlockers(base,job,'diagnostic'),[]);
  assert.deepEqual(budgetBlockers(base,job,'export'),[]);
  job.local_revisions.records.at(-1).outcome='improved';
  assert.deepEqual(budgetBlockers(base,job,'geometry_repair'),[]);
}));
test('diagnostic guard separates purposes and reuses completed evidence',()=>fixture(({base,job,put})=>{
  job.local_revisions.iteration_policy={mode:'progress_guarded',evidence:'test'};
  const a={defect_id:'head',hypothesis:'inspect head',execution:{script:{sha256:'a'}}};
  const b={defect_id:'foot',hypothesis:'inspect foot',execution:{script:{sha256:'b'}}};
  job.local_revisions.records=[{operation:'diagnostic',baseline:job.artifacts.candidate,status:'completed',plan:put('diag-a.json',a)}];
  assert.deepEqual(budgetBlockers(base,job,'diagnostic'),[]);
  assert.deepEqual(budgetBlockers(base,job,'diagnostic','repair',b),[]);
  assert.match(budgetBlockers(base,job,'diagnostic','repair',a)[0],/Reuse completed/);
  job.local_revisions.records[0].status='failed';job.local_revisions.records.push({...job.local_revisions.records[0]});
  assert.match(budgetBlockers(base,job,'diagnostic','repair',a)[0],/Repeated execution failure/);
}));
test('successful export resets same-format failures without blocking another format',()=>fixture(({base,job,put})=>{
  job.local_revisions.iteration_policy={mode:'progress_guarded',evidence:'test'};
  const plan={format:'glb'},ref=put('export-plan.json',plan);
  job.local_revisions.records=Array.from({length:2},()=>({operation:'export',baseline:job.artifacts.candidate,status:'failed',plan:ref}));
  assert.match(budgetBlockers(base,job,'export','repair',plan)[0],/Repeated execution failure/);
  assert.deepEqual(budgetBlockers(base,job,'export','repair',{format:'fbx'}),[]);
  assert.deepEqual(budgetBlockers(base,job,'export','repair',{format:'glb',execution:{script:{sha256:'corrected-script'}}}),[]);
  job.local_revisions.records.push({operation:'export',baseline:job.artifacts.candidate,status:'completed',outcome:'export_verified',plan:ref});
  assert.deepEqual(budgetBlockers(base,job,'export','repair',plan),[]);
}));
test('concise migration retains human evidence, source and attempt records, final still needs user',()=>fixture(({base,job,accept,report,put})=>{
  accept('base_model');accept('polish');accept('motion');const gates=structuredClone(job.gates),source=structuredClone(job.artifacts.candidate);
  simplifyWorkflow(base,job,{evidence:'test user requests concise workflow'});
  assert.deepEqual(job.gates,gates);assert.deepEqual(job.artifacts.candidate,source);
  assertAccepted(base,job,'motion');
  const r=report('concise-final','final');evaluateGate(base,job,'final',r);
  assert.throws(()=>recordDecision(base,job,'final',put('ai-final.json',{job_id:job.job_id,stage:'final',decision:'accepted',reviewer:'ai',evidence:'test',source_sha256:source.sha256,quality_spec_sha256:job.quality_spec.sha256,report_sha256:r.sha256})),/Reviewer/);
}));
test('progress policy cannot change during an unfinished execution and retains strategy stop',()=>fixture(({base,job,plan,put})=>{
  setIterationPolicy(base,job,{mode:'progress_guarded',evidence:'test scoped authorization'});
  for(let i=0;i<2;i++){
    const r=beginIteration(base,job,plan('progress'+i));
    assert.throws(()=>setIterationPolicy(base,job,{mode:'progress_guarded',evidence:'test'}),/still started/);
    finishIteration(base,job,put('progress-result'+i+'.json',{job_id:job.job_id,iteration_id:r.id,status:'failed',summary:'no improvement',evidence:[fileRef(base,'view.png')]}));
  }
  assert.throws(()=>beginIteration(base,job,plan('progress-third')),/Strategy stopped/);
}));
