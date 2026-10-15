import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkIntakeReference,checkSubmissionReadiness} from './submission-readiness.mjs';
import {submissionFixture} from './submission-fixture.mjs';
import {fileRef,readJSON} from './production-io.mjs';
import {root} from './workflow.mjs';

function fixture(fn){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-intake-test-'));
  try{fn({base,...submissionFixture(base)});}
  finally{assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-intake-test-'));fs.rmSync(base,{recursive:true,force:true});}
}
test('new animated texture jobs require configured policy and early motion review',()=>fixture(({base,put,reference,plan})=>{
  reference.intake=put('animated.json',{intent:'bear',animation:{status:'confirmed',use:'future_animation',evidence:'fixture request',design_implications:'movable arms'}});
  reference.preparation.intake_sha256=reference.intake.sha256;
  const job={animation_workflow_required:true,requirements:{},quality_spec:put('spec.json',{})};
  put('production.json',job);
  for(const operation of ['texture','retexture','texture_edit','texturing','texture_generate','texture_upscale','upscale','texture_pbr','pbr','pbr_generate','texture_style','remove_lighting'])assert.throws(()=>checkSubmissionReadiness(base,{...plan,operation},reference),/Configure animation/);
  job.requirements={rig_required:true};job.quality_spec=put('spec.json',{animation_workflow:{version:1}});put('production.json',job);
  for(const operation of ['texture','texture_upscale','texture_pbr','pbr','pbr_generate','texture_style','remove_lighting'])assert.throws(()=>checkSubmissionReadiness(base,{...plan,operation},reference),/preflight/);
}));

test('static texture postprocessing remains usable with its actual panel and typed source',()=>fixture(({base,put,reference,plan,ui})=>{
  put('production.json',{animation_workflow_required:false,requirements:{},quality_spec:put('static-spec.json',{})});
  for(const operation of ['texture_upscale','texture_pbr']){
    const actual_settings={panel:operation,resolution:'observed fixture value'};
    const p={...plan,operation,settings:actual_settings,input:{kind:'local_file',file:fileRef(base,'ref.png'),format:'fixture'}};
    p.ui_verification=put(operation+'-ui.json',{...ui,operation,actual_settings,uploaded_files:undefined,input_layout:undefined});
    assert.equal(checkSubmissionReadiness(base,p,reference).animation_use,'static');
  }
}));

test('texture readiness integrates preflight input binding and refuses another source despite a valid checkpoint',()=>fixture(({base,put,reference,plan,ui})=>{
  const candidate=put('candidate.blend','fixture source'),artifact=put('trial.blend','fixture trial'),media=put('media.json','synthetic evidence');
  const spec=put('animated-spec.json',{animation_workflow:{version:1,probes:['bend'],clips:['bend'],protection_matrix:[{id:'protected'}]}});
  const checkpoint=put('preflight.json',{job_id:'animated',source_sha256:candidate.sha256,quality_spec_sha256:spec.sha256,kind:'preflight',iteration_id:'trial',artifact,decision:'accepted',reviewer:'ai',review_evidence:'Synthetic diagnostic review',evidence:[media],protection:[{id:'protected',status:'pass',observation:'synthetic',evidence:[media]}],presentation:[{name:'bend',status:'pass',observation:'synthetic',views:['front','side','closeup','realtime','slow_motion'].map(role=>({role,file:media,region:'joint',speed:role==='slow_motion'?0.5:1}))}]});
  put('production.json',{job_id:'animated',requirements:{rig_required:true},quality_spec:spec,artifacts:{candidate},animation_reviews:{preflight:checkpoint},local_revisions:{records:[{id:'trial',operation:'diagnostic',status:'completed',diagnostic_conclusion:'supported',baseline:candidate,quality_spec:spec,output:artifact}]}});
  const p={...plan,operation:'texture_pbr',input:{kind:'local_file',file:candidate,format:'blend'}};
  p.ui_verification=put('bound-ui.json',{...ui,operation:p.operation,source_input:p.input,uploaded_files:undefined});
  checkSubmissionReadiness(base,p,reference);
  p.input={kind:'local_file',file:put('different.blend','different source'),format:'blend'};
  p.ui_verification=put('different-ui.json',{...ui,operation:p.operation,source_input:p.input,uploaded_files:undefined});
  assert.throws(()=>checkSubmissionReadiness(base,p,reference),/reference/);
}));
test('animation use must be resolved; existing explicit static intent is sufficient',()=>fixture(({base,put,reference,plan})=>{
  assert.equal(checkSubmissionReadiness(base,plan,reference).animation_use,'static');
  for(const use of [null,'unknown']){
    const r=structuredClone(reference);r.intake=put('unresolved.json',{intent:'prop',animation:{status:'unresolved',use}});
    assert.throws(()=>checkIntakeReference(base,r),/explicitly resolved/);
  }
  const r=structuredClone(reference);r.intake=put('no-evidence.json',{intent:'prop',animation:{status:'confirmed',use:'static'}});
  assert.throws(()=>checkIntakeReference(base,r),/evidence/);
}));
test('rejected references, unsuitable images and changed animation identity cannot enter generation',()=>fixture(({base,put,reference,plan})=>{
  for(const status of ['pending','rejected'])assert.throws(()=>checkIntakeReference(base,{...reference,decision:{status,evidence:'test'}}),/not approved/);
  const bad=structuredClone(reference);bad.preparation.assessment='needs_reference_rework';assert.throws(()=>checkIntakeReference(base,bad),/problems/);
  const stale={...reference,intake:put('new-intake.json',{intent:'prop',animation:{status:'confirmed',use:'future_animation',evidence:'test future use',design_implications:'movable limbs'}})};
  assert.throws(()=>checkIntakeReference(base,stale),/stale animation/);
  assert.throws(()=>checkSubmissionReadiness(base,{...plan,intake_sha256:'0'.repeat(64)},reference),/differs/);
}));
test('generated three views require user choice, matching animation brief, and front/side/back coverage',()=>fixture(({base,put,reference})=>{
  const r=structuredClone(reference);
  r.intake=put('animated-intake.json',{intent:'character',animation:{status:'confirmed',use:'animated',evidence:'test wave request',motion_intent:'wave',design_implications:'shoulder and elbow readable'}});
  r.preparation={...r.preparation,intake_sha256:r.intake.sha256,route:'generated_three_view',user_choice_evidence:'test user requests imagegen'};
  const brief={intake_sha256:r.intake.sha256,animation_use:'animated',prompt:'Same character front side back, neutral pose',preserve:'identity',pose_and_separation:'clear arms for wave',view_consistency:'same pose and scale',inferred_details:'back is inferred'};
  r.preparation.generation_brief=put('generation-brief.json',brief);
  assert.throws(()=>checkIntakeReference(base,r),/front\/side\/back/);
  r.files=[{...reference.files[0],role:'three_view_sheet',views:['front','side','back']}];
  assert.equal(checkIntakeReference(base,r).animation.use,'animated');
  const noChoice=structuredClone(r);delete noChoice.preparation.user_choice_evidence;assert.throws(()=>checkIntakeReference(base,noChoice),/User choice/);
  r.preparation.generation_brief=put('wrong-brief.json',{...brief,animation_use:'static'});assert.throws(()=>checkIntakeReference(base,r),/stale animation/);
}));
test('UI mismatch, ambiguous target and unapproved or QA-only uploads fail closed',()=>fixture(({base,put,reference,plan,ui})=>{
  for(const change of [{unique_target:false},{actual_settings:{...plan.settings,model:'other'}},{quoted_credits:99},{animation_use:'animated'}]){
    assert.throws(()=>checkSubmissionReadiness(base,{...plan,ui_verification:put('changed-ui.json',{...ui,...change})},reference));
  }
  fs.writeFileSync(path.join(base,'unapproved.png'),'other');
  assert.throws(()=>checkSubmissionReadiness(base,{...plan,ui_verification:put('other-upload.json',{...ui,uploaded_files:[fileRef(base,'unapproved.png')]})},reference),/outside approved/);
  const qa=structuredClone(reference);qa.files[0].role='qa-only';assert.throws(()=>checkSubmissionReadiness(base,plan,qa),/outside approved/);
}));
test('model postprocessing uses typed source without requiring a second reference-image upload',()=>fixture(({base,put,reference,plan,ui})=>{
  const p={...plan,operation:'retexture',input:{kind:'local_file',file:fileRef(base,'ref.png'),format:'fixture'}};
  p.ui_verification=put('postprocess-ui.json',{...ui,operation:'retexture',uploaded_files:undefined,input_layout:undefined});
  assert.equal(checkSubmissionReadiness(base,p,reference).animation_use,'static');
}));

test('adaptive single image accepts simple static tasks but rejects animated, complex and unapproved inputs',()=>fixture(({base,put,reference})=>{
  put('reference-contract.json',{input_contract:'adaptive_reference_v1'});
  const r=structuredClone(reference),intake=readJSON(path.join(base,r.intake.path));
  r.preparation.input_contract='single_image_v1';
  const set=(profile,use='static')=>{
    r.intake=put('adaptive-intake.json',{...intake,reference_profile:profile,reference_profile_reason:'Simple isolated symmetric prop',animation:{...intake.animation,use,design_implications:'fixture'}});
    r.preparation.intake_sha256=r.intake.sha256;
  };
  set('simple_static');assert.equal(checkIntakeReference(base,r).animation.use,'static');
  set('concept');checkIntakeReference(base,r);
  for(const profile of ['character','complex',undefined]){set(profile);assert.throws(()=>checkIntakeReference(base,r),/static simple/);}
  set('simple_static','future_animation');assert.throws(()=>checkIntakeReference(base,r),/static simple/);
  set('simple_static');r.decision.status='pending';assert.throws(()=>checkIntakeReference(base,r),/not approved/);
  r.decision.status='approved';r.files.push({...r.files[0]});assert.throws(()=>checkIntakeReference(base,r),/exactly one/);
}));

test('generated single reference binds generation brief, user choice, and reviewed image count',()=>fixture(({base,put,reference})=>{
  put('reference-contract.json',{input_contract:'adaptive_reference_v1'});
  const r=structuredClone(reference),intake=readJSON(path.join(base,r.intake.path));
  r.intake=put('single-intake.json',{...intake,reference_profile:'concept',reference_profile_reason:'Static concept scope'});
  const brief={intake_sha256:r.intake.sha256,animation_use:'static',prompt:'one isolated prop',preserve:'identity',pose_and_separation:'static',view_consistency:'one view',inferred_details:'back unseen'};
  r.preparation={...r.preparation,intake_sha256:r.intake.sha256,input_contract:'single_image_v1',route:'generated_single_view',user_choice_evidence:'Synthetic user imagegen request',generation_brief:put('single-brief.json',brief)};
  checkIntakeReference(base,r);
  const noBrief=structuredClone(r);delete noBrief.preparation.generation_brief;assert.throws(()=>checkIntakeReference(base,noBrief));
  const noChoice=structuredClone(r);delete noChoice.preparation.user_choice_evidence;assert.throws(()=>checkIntakeReference(base,noChoice),/User choice/);
  r.preparation.generation_brief=put('stale-brief.json',{...brief,intake_sha256:'0'.repeat(64)});assert.throws(()=>checkIntakeReference(base,r),/stale/);
}));
test('CLI prepare and submitting enforce intake while old task status stays readable',()=>{
  const id='intake-cli-'+Date.now(),base=path.join(root,'assets',id);
  const cli=(...args)=>spawnSync(process.execPath,[path.join(root,'tools/workflow/workflow.mjs'),...args],{encoding:'utf8',windowsHide:true});
  try{
    const {put,reference,plan,ui}=submissionFixture(base);
    put('brief.json',{title:'synthetic'});
    const missing=structuredClone(reference);delete missing.intake;put('ref.json',missing);put('draft.json',plan);
    assert.notEqual(cli('prepare',id,'missing','draft.json').status,0);
    assert.ok(!fs.existsSync(path.join(base,'runs/missing')));
    put('runs/missing/state.json',{status:'accepted'});put('runs/missing/plan.json',{quoted_credits:0});
    put('ref.json',reference);assert.equal(cli('prepare',id,'001','draft.json').status,0);
    const stored=fileRef(base,'runs/001/plan.json');
    put('runs/001/approval.json',{status:'approved',plan_sha256:stored.sha256,evidence:'synthetic scope',max_credits:45});
    const broken=put('bad-ui.json',{...ui,unique_target:false});
    put('runs/001/plan.json',{...readJSON(path.join(base,stored.path)),ui_verification:broken});
    put('runs/001/approval.json',{status:'approved',plan_sha256:fileRef(base,stored.path).sha256,evidence:'synthetic scope',max_credits:45});
    assert.match(cli('mark',id,'001','submitting','must not click').stderr,/Ambiguous/);
    assert.equal(readJSON(path.join(base,'runs/001/state.json')).status,'planned');
    assert.equal(cli('status',id).status,0);
  }finally{assert.equal(path.dirname(path.resolve(base)),path.join(root,'assets'));assert.ok(path.basename(base).startsWith('intake-cli-'));fs.rmSync(base,{recursive:true,force:true});}
});

test('four-view contract rejects missing, duplicate and swapped inputs and accepts exact slots',()=>fixture(({base,put,reference,plan,ui})=>{
  const r=structuredClone(reference);
  r.preparation.input_contract='four_independent_views_v1';
  r.files=['front','left','right','back'].map(view=>{
    fs.writeFileSync(path.join(base,view+'.png'),'synthetic '+view);
    return {...fileRef(base,view+'.png'),role:view,view};
  });
  const check=(uploads)=>checkSubmissionReadiness(base,{...plan,ui_verification:put('four-ui.json',{...ui,uploaded_files:uploads})},r);
  const uploads=r.files.map(f=>({...f,slot:f.view}));
  assert.equal(check(uploads).animation_use,'static');
  assert.throws(()=>check(uploads.slice(0,3)),/Four verified upload/);
  const swap=structuredClone(uploads);swap[1].slot='right';swap[2].slot='left';
  assert.throws(()=>check(swap),/approved slot/);
  const duplicate=structuredClone(r);duplicate.files[2]={...r.files[1],view:'right'};
  assert.throws(()=>checkIntakeReference(base,duplicate),/distinct/);
  const missing=structuredClone(r);missing.files.pop();
  assert.throws(()=>checkIntakeReference(base,missing),/Four independent/);
  const sheet=structuredClone(r);sheet.files=[{...r.files[0],role:'four_view_sheet',views:['front','left','right','back']}];
  assert.throws(()=>checkIntakeReference(base,sheet),/Four independent/);
  const post={...plan,operation:'rig',input:{kind:'studio_asset'}};
  post.ui_verification=put('four-post-ui.json',{...ui,operation:'rig',uploaded_files:undefined});
  assert.equal(checkSubmissionReadiness(base,post,r).animation_use,'static');
}));

test('new asset required contract cannot be omitted or renamed; explicit user exception and legacy remain supported',()=>fixture(({base,put,reference,plan})=>{
  assert.equal(checkSubmissionReadiness(base,plan,reference).animation_use,'static');
  put('reference-contract.json',{input_contract:'four_independent_views_v1'});
  assert.throws(()=>checkSubmissionReadiness(base,plan,reference),/New asset requires/);
  const changed=structuredClone(reference);changed.preparation.input_contract='typo';
  assert.throws(()=>checkSubmissionReadiness(base,plan,changed),/New asset requires/);
  changed.preparation.input_exception={requested_by:'ai',mode:'single_image',evidence:'synthetic'};
  assert.throws(()=>checkSubmissionReadiness(base,plan,changed),/New asset requires/);
  changed.preparation.input_exception={requested_by:'user',mode:'single_image',evidence:'Synthetic explicit single-image request'};
  assert.equal(checkSubmissionReadiness(base,plan,changed).animation_use,'static');
}));
