import fs from 'node:fs';
import path from 'node:path';
import {animated,requireCheckpoint} from './animation-review.mjs';
import {isDeepStrictEqual} from 'node:util';
import {readJSON,verifyRef,requireText} from './production-io.mjs';
import {verifyPreflightInput} from './input-binding.mjs';

// Separate texture panels share the same animation geometry-preflight requirement.
// These are operation aliases, not permission to submit or claims of UI support.
export const studioTextureOperations=new Set(['texture','retexture','texture_edit','texturing','texture_generate','texture_upscale','upscale','texture_pbr','pbr','pbr_generate','texture_style','remove_lighting']);

export function checkIntakeReference(base,reference){
  const intake=readJSON(verifyRef(base,reference.intake));
  const animation=intake.animation;
  if(animation?.status!=='confirmed'||!['static','future_animation','rig_only','animated'].includes(animation.use))throw Error('Animation intent must be explicitly resolved before reference approval/submission');
  requireText(animation.evidence,'Existing user animation intent evidence');
  requireText(intake.intent,'Asset intent');
  if(animation.use==='animated')requireText(animation.motion_intent,'Requested motion intent');
  if(animation.use!=='static')requireText(animation.design_implications,'Animation implications for reference pose/parts');
  const preparation=reference.preparation;
  const policyFile=path.join(base,'workflow-policy.json');
  const contractFile=path.join(base,'reference-contract.json');
  const requiredContract=fs.existsSync(contractFile)?readJSON(contractFile).input_contract:(fs.existsSync(policyFile)?readJSON(policyFile).reference_input_contract:null);
  if(requiredContract==='adaptive_reference_v1'){
    const exception=preparation?.input_exception;
    if(exception?.requested_by==='user'&&['single_image','three_views','text','other_explicit'].includes(exception.mode))requireText(exception.evidence,'Actual user input exception evidence');
    else if(preparation?.input_contract==='single_image_v1'){
      if(animation.use!=='static'||!['simple_static','concept'].includes(intake.reference_profile))throw Error('Single image requires explicit static simple/concept profile');
      requireText(intake.reference_profile_reason,'Reference complexity rationale');
      const files=reference.files?.filter(f=>f.role!=='qa-only');
      if(reference.kind==='text'||files?.length!==1)throw Error('Single image contract requires exactly one approved image');
      verifyRef(base,files[0]);
    }else if(preparation?.input_contract!=='four_independent_views_v1')throw Error('Adaptive reference requires single-image or four-view contract');
  }
  if(requiredContract==='four_independent_views_v1'&&preparation?.input_contract!==requiredContract){
    const exception=preparation?.input_exception;
    if(exception?.requested_by!=='user'||!['single_image','three_views','text','other_explicit'].includes(exception.mode))throw Error('New asset requires four-view contract or explicit user input exception');
    requireText(exception.evidence,'Actual user input exception evidence');
  }

  if(!preparation||!['original','replacement','generated_single_view','generated_three_view','generated_four_view','text_explicit'].includes(preparation.route))throw Error('Reference preparation route required');
  if(preparation.intake_sha256!==reference.intake.sha256)throw Error('Reference preparation uses stale animation intent');
  requireText(preparation.animation_considerations,'Animation-aware reference assessment');
  if(preparation.assessment!=='usable')throw Error('Reference problems must be resolved before submission');
  if(!preparation.checks?.length)throw Error('Reference assessment evidence required');
  for(const item of preparation.checks){requireText(item.name,'Reference check name');requireText(item.observation,'Reference check observation');if(item.status!=='pass')throw Error('Reference assessment contains unresolved checks');}
  if(preparation.route!=='original')requireText(preparation.user_choice_evidence,'User choice of reference preparation');
  if(reference.kind==='text'&&preparation.route!=='text_explicit')throw Error('Text-only path requires explicit user choice');
  if(preparation.route==='text_explicit'&&reference.kind!=='text')throw Error('Text route/input mismatch');
  if(['generated_single_view','generated_three_view','generated_four_view'].includes(preparation.route)){
    const prompt=readJSON(verifyRef(base,preparation.generation_brief));
    if(prompt.intake_sha256!==reference.intake.sha256||prompt.animation_use!==animation.use)throw Error('Image generation brief uses stale animation intent');
    for(const key of ['prompt','preserve','pose_and_separation','view_consistency','inferred_details'])requireText(prompt[key],'Image generation '+key);
    const uploads=(reference.files||[]).filter(f=>f.role!=='qa-only');
    if(preparation.route==='generated_single_view'&&(reference.kind==='text'||uploads.length!==1||preparation.input_contract!=='single_image_v1'))throw Error('Generated single image requires one reviewed image and single-image contract');
    if(preparation.route==='generated_single_view')verifyRef(base,uploads[0]);
    const independent=['front','side','back'].every(role=>uploads.some(f=>f.role===role));
    const sheet=uploads.some(f=>f.role==='three_view_sheet'&&['front','side','back'].every(v=>f.views?.includes(v)));
    if(preparation.route==='generated_three_view'&&!independent&&!sheet)throw Error('Generated reference must contain reviewed front/side/back views');
  }
  if(preparation.route==='generated_four_view'&&preparation.input_contract!=='four_independent_views_v1')throw Error('Generated four views require four-view input contract');
  if(preparation.input_contract==='four_independent_views_v1')checkFourViews(base,reference);
  if(reference.decision?.status!=='approved')throw Error('Current reference version not approved');
  requireText(reference.decision.evidence,'Actual user reference approval');
  return intake;
}

export function checkSubmissionReadiness(base,plan,reference){
  requireText(plan.operation,'Concrete Studio operation');
  const production=path.join(base,'production.json');
  const intake=checkIntakeReference(base,reference);
  let preflightJob=null;
  if(studioTextureOperations.has(plan.operation)&&fs.existsSync(production)){
    const job=readJSON(production),spec=readJSON(verifyRef(base,job.quality_spec));
    if(job.animation_workflow_required&&intake.animation.use!=='static'&&(!animated(job)||!spec.animation_workflow))throw Error('Configure animation workflow before texture processing');
    if(animated(job)&&spec.animation_workflow){requireCheckpoint(base,job,spec,'preflight');preflightJob=job;}
  }
  if(plan.intake_sha256!==reference.intake.sha256)throw Error('Plan animation intent differs from approved reference');
  const observation=readJSON(verifyRef(base,plan.ui_verification));
  if(preflightJob)verifyPreflightInput(base,preflightJob,plan,observation);
  if(observation.reference_manifest_sha256!==plan.reference_manifest_sha256||observation.intake_sha256!==reference.intake.sha256||observation.operation!==plan.operation)throw Error('UI verification identity mismatch');
  if(observation.observed_at!==plan.observed_at||observation.quoted_credits!==plan.quoted_credits)throw Error('UI verification quote/time mismatch');
  for(const key of ['page_url','target_description','selection_reason'])requireText(observation[key],'UI verification '+key);
  if(observation.unique_target!==true||observation.settings_match!==true)throw Error('Ambiguous target or UI settings mismatch');
  if(!plan.settings||!Object.keys(plan.settings).length||!isDeepStrictEqual(observation.actual_settings,plan.settings))throw Error('Actual settings differ from frozen plan');
  if(!['generate','单图生成模型'].includes(plan.operation)&&!plan.input&&!plan.source_file)throw Error('Postprocessing source required');
  if(['generate','单图生成模型'].includes(plan.operation))for(const key of ['mode','model'])requireText(plan.settings[key],'Observed generation '+key);
  if(observation.animation_use!==intake.animation.use)throw Error('UI selection did not account for animation intent');
  if(!observation.evidence?.length)throw Error('Observed UI evidence required');
  observation.evidence.forEach(ref=>verifyRef(base,ref));
  if(reference.kind!=='text'&&['generate','单图生成模型'].includes(plan.operation)){
    if(!observation.uploaded_files?.length)throw Error('Verified uploaded reference inputs required');
    for(const input of observation.uploaded_files){
      verifyRef(base,input);
      if(!reference.files?.some(f=>f.path===input.path&&f.sha256===input.sha256&&f.role!=='qa-only'))throw Error('Upload is outside approved reference files');
    }
    if(reference.preparation.input_contract==='four_independent_views_v1')checkFourViews(base,reference,observation.uploaded_files);
    requireText(observation.input_layout,'Observed input slot/layout compatibility');
  }
  return {animation_use:intake.animation.use,reference_route:reference.preparation.route};
}

export function checkFourViews(base,reference,uploaded){
  const views=['front','left','right','back'];
  const files=(reference.files||[]).filter(f=>f.role!=='qa-only');
  if(files.length!==4||!views.every(v=>files.filter(f=>f.view===v).length===1))throw Error('Four independent front/left/right/back files required');
  const paths=files.map(f=>verifyRef(base,f));
  if(new Set(paths).size!==4||new Set(files.map(f=>f.sha256)).size!==4)throw Error('Four views must have distinct files and contents');
  if(uploaded!==undefined){
    if(uploaded.length!==4||!views.every(v=>uploaded.filter(f=>f.slot===v).length===1))throw Error('Four verified upload slots required');
    for(const input of uploaded){
      const approved=files.find(f=>f.view===input.slot);
      if(input.path!==approved.path||input.sha256!==approved.sha256)throw Error('Uploaded view does not match approved slot');
      verifyRef(base,input);
    }
  }
}
