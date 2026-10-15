import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fileRef} from './production-io.mjs';
import {validateAnimationPolicy,validateCheckpoint,checkAnimationPlan,checkRegression,checkAnimationReport} from './animation-review.mjs';
import {extendReuse} from './review-reuse.mjs';

function fixture(t){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'animation-review-'));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const put=(name,value)=>{fs.writeFileSync(path.join(base,name),JSON.stringify(value));return fileRef(base,name);};
  const media=put('evidence.json',{fixture:true});
  const policy={version:1,probes:['arm','leg'],clips:['Run','Wave'],protection_matrix:['arm','leg'].map(id=>({id,stimulus:id,region:id+' opposite body',root_removal:'hips transform',measurement:'fixture tolerance'}))};
  const spec={animation_workflow:policy},source=put('source.blend','baseline'),artifact=put('draft.blend','draft');
  const job={job_id:'test',requirements:{motion_required:true},quality_spec:put('spec.json',spec),artifacts:{candidate:source},local_revisions:{records:[{id:'trial',operation:'diagnostic',status:'completed',diagnostic_conclusion:'supported',baseline:source,quality_spec:null,output:artifact}]}};
  job.local_revisions.records[0].quality_spec=job.quality_spec;
  const protection=policy.protection_matrix.map(p=>({id:p.id,status:'pass',observation:'fixture observation',evidence:[media]}));
  const presentation=names=>names.map(name=>({name,status:'pass',observation:'fixture observation',views:['front','side','closeup','realtime','slow_motion'].map(role=>({role,file:media,region:'shoulder',speed:role==='slow_motion'?0.5:1}))}));
  const checkpoint=kind=>({job_id:job.job_id,source_sha256:source.sha256,quality_spec_sha256:job.quality_spec.sha256,kind,iteration_id:'trial',artifact,decision:'accepted',reviewer:kind==='rhythm'?'user':'ai',review_evidence:'Fixture user review, not production acceptance',evidence:[media],protection,presentation:presentation(kind==='preflight'?policy.probes:policy.clips)});
  return {base,put,media,policy,spec,source,artifact,job,protection,presentation,checkpoint};
}

test('each motion stimulus must protect a region',t=>{
  const f=fixture(t);validateAnimationPolicy(f.policy);
  f.policy.protection_matrix.pop();assert.throws(()=>validateAnimationPolicy(f.policy),/Uncovered/);
});

test('animation checkpoint reuse binds dependencies and preserves the original user decision',t=>{
  const f=fixture(t),h='a'.repeat(64);
  f.spec.reuse_contract={version:1,collector_sha256:h,blender_version:'test',dependencies:{rhythm:['geometry','rig','animation','scene']}};
  f.job.quality_spec=f.put('spec.json',f.spec);f.job.local_revisions.records[0].quality_spec=f.job.quality_spec;
  const ref=f.put('rhythm.json',f.checkpoint('rhythm')),target=f.put('material-change.blend','material only');
  const snap=source=>({schema_version:1,source_sha256:source.sha256,collector_sha256:h,blender_version:'test',domains:{geometry:h,rig:h,animation:h,scene:h}});
  const before=f.put('domain-before.json',snap(f.source)),after=f.put('domain-after.json',snap(target));
  const proof=f.put('proof.json',{source_sha256:f.source.sha256,output_sha256:target.sha256,before,after});
  f.job.animation_review_reuse={rhythm:extendReuse(null,f.source,target,proof,f.job.quality_spec)};
  f.job.artifacts.candidate=target;
  assert.equal(validateCheckpoint(f.base,f.job,f.spec,ref).reviewer,'user');
  const changed=snap(target);changed.domains.animation='b'.repeat(64);f.put('domain-after.json',changed);
  assert.throws(()=>validateCheckpoint(f.base,f.job,f.spec,ref),/File changed/);
});

test('adopted exact diagnostic artifact retains its rhythm, but unrelated output cannot borrow it',t=>{
  const f=fixture(t),ref=f.put('rhythm.json',f.checkpoint('rhythm'));
  f.job.diagnostic_adoptions=[{iteration_id:'trial',baseline:f.source,output:f.artifact,quality_spec:f.job.quality_spec,request:f.put('adopt.json',{iteration_id:'trial'})}];
  f.job.artifacts.candidate=f.artifact;
  validateCheckpoint(f.base,f.job,f.spec,ref);
  f.job.artifacts.candidate=f.put('different.blend','different');
  assert.throws(()=>validateCheckpoint(f.base,f.job,f.spec,ref),/identity/);
});
test('checkpoints reject failed diagnostics, stale sources and AI rhythm acceptance',t=>{
  const f=fixture(t),d=f.checkpoint('rhythm');
  const validate=()=>validateCheckpoint(f.base,f.job,f.spec,f.put('checkpoint.json',d));
  validate();d.reviewer='ai';assert.throws(validate,/user review/);d.reviewer='user';
  f.job.local_revisions.records[0].diagnostic_conclusion='inconclusive';assert.throws(validate,/support acceptance/);
  f.job.local_revisions.records[0].diagnostic_conclusion='supported';d.source_sha256='a'.repeat(64);assert.throws(validate,/identity/);
});
test('visual gates require closeups, slow playback, observations and untampered files',t=>{
  const f=fixture(t),d=f.checkpoint('preflight');
  const validate=()=>validateCheckpoint(f.base,f.job,f.spec,f.put('checkpoint.json',d));
  d.presentation[0].views.pop();assert.throws(validate,/slow_motion/);
  d.presentation=f.presentation(f.policy.probes);d.presentation[0].views[2].region='';assert.throws(validate,/Closeup/);
  d.presentation=f.presentation(f.policy.probes);d.presentation[0].views[4].speed=1;assert.throws(validate,/speed/);
  d.presentation=f.presentation(f.policy.probes);fs.appendFileSync(path.join(f.base,f.media.path),' ');assert.throws(validate,/File changed/);
});
test('diagnostic trials avoid circular gates; formal work requires reviews and declared scope',t=>{
  const f=fixture(t),plan={operation:'motion',change_scope:{changed:['action:Run'],protected:['object:Body:weights'],affected_clips:['Run']}};
  checkAnimationPlan(f.base,f.job,f.spec,{operation:'diagnostic'});
  assert.throws(()=>checkAnimationPlan(f.base,f.job,f.spec,plan),/rhythm/);
  assert.throws(()=>checkAnimationPlan(f.base,f.job,f.spec,{...plan,operation:'rig'}),/preflight/);
  f.job.animation_reviews={rhythm:f.put('rhythm.json',f.checkpoint('rhythm')),preflight:f.put('preflight.json',f.checkpoint('preflight'))};
  checkAnimationPlan(f.base,f.job,f.spec,plan);
  plan.change_scope.affected_clips=['typo'];assert.throws(()=>checkAnimationPlan(f.base,f.job,f.spec,plan),/Unknown/);
  plan.change_scope.affected_clips=['Run'];plan.change_scope.changed=['object:Body:geometry'];assert.throws(()=>checkAnimationPlan(f.base,f.job,f.spec,plan),/every dependent/);
});
test('regression rejects undeclared changes, missing playback and mismatched collectors',t=>{
  const f=fixture(t),a='a'.repeat(64),b='b'.repeat(64);
  const plan={change_scope:{changed:['action:Run'],protected:['weights'],affected_clips:['Run']}};
  const planRef=f.put('plan.json',plan),candidate=f.put('output.blend','output');
  const round={mode:'repair',operation:'motion',baseline:f.source,plan:planRef};
  const before={source_sha256:f.source.sha256,collector_sha256:a,blender_version:'5.2',properties:{'action:Run':a,weights:a}};
  const after={...before,source_sha256:candidate.sha256,properties:{'action:Run':b,weights:a}};
  const r={source_sha256:f.source.sha256,output_sha256:candidate.sha256,plan_sha256:planRef.sha256,protection:f.protection,playback:[{name:'Run',status:'pass',observation:'fixture',evidence:[f.media]}]};
  const validate=()=>{r.before=f.put('before.json',before);r.after=f.put('after.json',after);checkRegression(f.base,f.job,f.spec,plan,round,{candidate,regression:f.put('regression.json',r)});};
  validate();after.properties.weights=b;assert.throws(validate,/Unexpected property/);after.properties.weights=a;
  after.collector_sha256=b;assert.throws(validate,/collector/);after.collector_sha256=a;
  r.playback=[];assert.throws(validate,/playback/);
});
test('final and roundtrip require visual review; static and legacy standards remain compatible',t=>{
  const f=fixture(t),report={};
  assert.throws(()=>checkAnimationReport(f.base,f.job,f.spec,'final',report,f.source,'gate'),/reference/);
  report.animation_review=f.put('visual.json',{...f.checkpoint('rhythm'),presentation:f.presentation(f.policy.clips)});
  checkAnimationReport(f.base,f.job,f.spec,'final',report,f.source,'export_roundtrip');
  checkAnimationReport(f.base,f.job,{},'final',{},f.source,'gate');
  checkAnimationPlan(f.base,{requirements:{}},f.spec,{operation:'motion'});
});

test('native Blender snapshots are repeatable, detect geometry changes and preserve sources',{skip:!process.env.BLENDER_TEST_EXE},t=>{
  const f=fixture(t),tool=name=>fileURLToPath(new URL(name,import.meta.url));
  const run=args=>{const r=spawnSync(process.env.BLENDER_TEST_EXE,args,{encoding:'utf8',timeout:45000,windowsHide:true});assert.ifError(r.error);assert.equal(r.status,0,r.stdout+r.stderr);};
  run(['--background','--factory-startup','--python-exit-code','1','--python',tool('blender-fixture.py'),'--',f.base]);
  const source=fileRef(f.base,'source.blend');
  for(const [input,output] of [['source.blend','first.json'],['source.blend','second.json'],['topology-source.blend','different.json']])run(['--background','--factory-startup',path.join(f.base,input),'--python-exit-code','1','--python',tool('blender-regression-snapshot.py'),'--',path.join(f.base,output)]);
  const read=name=>JSON.parse(fs.readFileSync(path.join(f.base,name),'utf8'));
  const a=read('first.json'),b=read('second.json'),c=read('different.json');
  assert.deepEqual(a,b);assert.equal(a.source_sha256,source.sha256);assert.deepEqual(fileRef(f.base,'source.blend'),source);
  assert.ok(Object.keys(a.properties).some(k=>k.startsWith('action:')));
  assert.ok(Object.keys(a.properties).some(k=>k.endsWith(':geometry')&&a.properties[k]!==c.properties[k]));
  assert.ok(a.not_tested.includes('visual quality'));
});
