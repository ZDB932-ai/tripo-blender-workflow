import {animated,validateCheckpoint,checkAnimationPlan,checkRegression} from './animation-review.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomicJSON, readJSON, localFile, fileRef, verifyRef, requireText} from './production-io.mjs';
import {STAGES, stageChain, loadSpec, validateSpec, evaluateReport, predecessors, assertAccepted, validateDecision, compareReports,assertEvidencePolicy} from './quality.mjs';
import {remoteRuns,remoteChoice,unresolvedRemote,continuedUnknown,validateContinuation} from './remote-routing.mjs';
import {currentExport,sameFile} from './export-chain.mjs';

import {validateExecutionPlan,prepareExecution,reconcileExecution,abortExecution,recoverExecution,assertExecutionFinished} from './execution.mjs';
import {validateCapability,verifyCapabilityResult} from './capability.mjs';
import {verifyUnchanged,extendReuse,reuseDependencyProblems} from './review-reuse.mjs';
import {validateStrategyReview} from './iteration-routing.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const operations={diagnostic:'polish',geometry_repair:'polish',weight_repair:null,material:'polish',uv:'polish',rig:'rig',motion:'motion',export:'final'};
function operationStage(spec,operation){
  if(operation!=='weight_repair')return operations[operation];
  // New rigs own weights; legacy standards may keep weights in motion or polish.
  // Never select a weaker stage when the applicable rig gate omits skinning.
  const stages=spec.rig_required?['rig']:[...(spec.motion_required?['motion']:[]),'polish'];
  return stages.find(stage=>spec.gates[stage]?.includes('weights')&&spec.criteria.weights?.applicable!==false)||null;
}
export const budgetClass=(operation,mode='repair')=>operation==='diagnostic'?'diagnostic':operation==='export'?'export':mode==='create'?'creation':'repair';
const recordBudget=r=>r.budget_class||budgetClass(r.operation,r.mode);
export function newProduction(assetId,specRef){
  return {schema_version:2,asset_id:assetId,job_id:`${assetId}-production-001`,revision:0,
    stage:'reference',status:'needs_configuration',review_mode:'guided',source_run_id:null,
    requirements:{motion_required:false,rig_required:false,intent:null,evidence:null},quality_spec:specRef,
    artifacts:{candidate:null,display_master:null,repair_baseline:null,best_motion_draft:null,latest_diagnostic:null,final_files:[]},
    execution_required:true,evidence_policy_required:true,gates:{},local_revisions:{max_started:2,stop_after_no_improvement:2,limit_basis:'Project conservative default, not additional user authorization',records:[],stopped_strategies:[],historical_count:null},
    unresolved:['Configure current requirements, quality criteria and source candidate'],events:[],updated_at:new Date().toISOString()};
}
export function readProduction(base){
  const job=readJSON(path.join(base,'production.json'));
  if(job.schema_version!==2||!job.job_id||!['guided','autonomous'].includes(job.review_mode))throw Error('Production v2 migration required');
  if(!Array.isArray(job.local_revisions?.records)||!Array.isArray(job.local_revisions?.stopped_strategies)||!Number.isInteger(job.local_revisions.max_started)||job.local_revisions.max_started<0||!Number.isInteger(job.local_revisions.stop_after_no_improvement)||job.local_revisions.stop_after_no_improvement<1)throw Error('Invalid revision policy');
  if(job.local_revisions.iteration_policy&&(!['progress_guarded','explicit_budget'].includes(job.local_revisions.iteration_policy.mode)||!job.local_revisions.iteration_policy.evidence?.trim()))throw Error('Invalid iteration policy');
  if(!job.gates||!job.artifacts||!Array.isArray(job.events))throw Error('Invalid production state');
  return job;
}
export function projection(job){
  const next=nextAction(job);
  return {schema_version:2,derived_from:'production.json',production_revision:job.revision,asset_id:job.asset_id,job_id:job.job_id,stage:job.stage,status:job.status,run_id:job.source_run_id,
    inputs:job.artifacts.candidate?[job.artifacts.candidate.path]:[],outputs:job.artifacts.final_files.map(r=>r.path),
    next_skill:next.skill,next_action:next.action,blocked_by:next.blocked_by,unresolved:job.unresolved,updated_at:job.updated_at};
}
export function nextAction(job){
  const result=(action,skill,blocked_by=[])=>({action,skill,blocked_by});
  if(active(job))return result('reconcile_local','tripo-studio-pipeline',['unfinished_iteration']);
  if(job.status==='accepted')return result('complete',null);
  if(job.gates[job.stage]?.status==='awaiting_review')return result('review','tripo-studio-pipeline',['review_decision']);
  if(!job.artifacts.candidate)return result('resolve_source','tripo-studio-pipeline',['source_candidate']);
  const chain=STAGES.filter(s=>(s!=='rig'||job.requirements.rig_required)&&(s!=='motion'||job.requirements.motion_required)&&(s!=='engine'||job.requirements.engine?.required));
  const stage=chain.find(s=>job.gates[s]?.status!=='accepted');
  const skills={base_model:job.artifacts.candidate?.path.endsWith('.blend')?'tripo-blender-polish':'tripo-studio-refine',polish:'tripo-blender-polish',rig:'tripo-blender-rig-motion',motion:'tripo-blender-rig-motion',engine:'tripo-studio-engine',final:'tripo-studio-deliver'};
  return result(stage||'complete',skills[stage]||null);
}
export function inspectNext(base,job=readProduction(base)){
  try{return inspectNextVerified(base,job);}
  catch(e){return {action:'repair_records',skill:'tripo-studio-pipeline',blocked_by:[e.message]};}
}
function inspectNextVerified(base,job){
  const result=inspectNextCore(base,job);
  const warnings=inspectProduction(base,job).warnings;
  for(const run of remoteRuns(base))if(continuedUnknown(base,job,run))warnings.push(`Retained unknown submission ${run.id}: user authorized continuation; outcome unresolved and budget reserved`);
  return warnings.length?{...result,warnings}:result;
}
function inspectNextCore(base,job){
  const inspection=inspectProduction(base,job);
  if(!inspection.valid)return {action:'repair_records',skill:'tripo-studio-pipeline',blocked_by:inspection.problems};
  if(job.transfer&&['sending','unknown'].includes(job.transfer.status))return {action:'reconcile_transfer',skill:'tripo-studio-deliver',blocked_by:['transfer_outcome']};
  if(active(job))return nextAction(job);
  {
    const pending=remoteRuns(base);
    // Historical Bridge runs used 'exporting' without a downloaded file. They must
    // be reconciled before reuse, but do not block unrelated local work on a known candidate.
    const bridgeReceived=r=>{try{verifyReceipt(base,fileRef(base,`runs/${r.id}/transfer-result.json`),{run_id:r.id});return true;}catch{return false;}};
    const unresolved=pending.filter(r=>(unresolvedRemote.includes(r.status)&&!continuedUnknown(base,job,r))||(r.status==='exporting'&&(!job.artifacts.candidate||r.id===job.source_run_id||r.id===job.active_remote_run?.run_id)&&!bridgeReceived(r)));
    if(unresolved.length)return {action:'reconcile_remote',skill:unresolved.some(r=>r.status==='exporting')?'tripo-studio-deliver':'tripo-studio-generate',runs:unresolved,blocked_by:['remote_outcome']};
    const choice=remoteChoice(base,job,pending.filter(r=>!(r.status==='exporting'&&bridgeReceived(r)&&r.id!==job.active_remote_run?.run_id)));
    if(choice)return choice;
  }
  if(!job.artifacts.candidate)return {action:'reference_or_existing_source',skill:'tripo-studio-reference',blocked_by:['source_candidate']};
  const spec=loadSpec(base,job),next=nextAction(job);
  if(spec.status!=='active')return {action:'configure_quality',skill:'tripo-studio-pipeline',blocked_by:['quality_spec_draft']};
  if(['review','complete'].includes(next.action))return next;
  const limits=(spec.gates[next.action]||[]).filter(n=>spec.criteria[n].kind==='metric'&&spec.criteria[n].applicable!==false&&spec.criteria[n].limit===null);
  if(limits.length)return {action:'configure_quality',skill:'tripo-studio-pipeline',blocked_by:limits.map(n=>`unresolved_limit:${n}`)};
  if(job.requirements.engine?.required&&job.gates[job.requirements.motion_required?'motion':job.requirements.rig_required?'rig':'polish']?.status==='accepted'){
    try{currentExport(base,job);}catch(e){
      const exportLimits=spec.gates.final.filter(n=>spec.criteria[n].kind==='metric'&&spec.criteria[n].applicable!==false&&spec.criteria[n].limit===null);
      if(exportLimits.length)return {action:'configure_quality',skill:'tripo-studio-pipeline',blocked_by:exportLimits.map(n=>`unresolved_limit:${n}`)};
      const blocked=budgetBlockers(base,job,'export');
      return {action:blocked.length?(job.local_revisions.iteration_policy?.mode==='progress_guarded'?'resolve_plateau':'resolve_budget'):'export_for_engine',skill:blocked.length?'tripo-studio-pipeline':'tripo-studio-deliver',blocked_by:blocked.length?blocked:[],reason:e.message};
    }
  }
  // Evidence collection/review remains possible with no edit budget. Expose the
  // allowed operations instead of incorrectly blocking the whole stage.
  const choices=Object.keys(operations).filter(operation=>operationStage(spec,operation)===next.action).flatMap(operation=>
    (['motion','rig','material','uv'].includes(operation)?['repair','create']:['repair']).map(mode=>({operation,mode,blocked_by:budgetBlockers(base,job,operation,mode)})));
  const animation_checkpoints=spec.animation_workflow&&animated(job)?['preflight',...(job.requirements.motion_required?['rhythm']:[])].map(kind=>{try{const ref=job.animation_reviews?.[kind];if(!ref)throw Error('not recorded');validateCheckpoint(base,job,spec,ref);return {kind,status:'current'};}catch(e){return {kind,status:'required',reason:e.message};}}):[];
  return {...next,animation_checkpoints,operation_readiness:choices,stopped_strategies:job.local_revisions.stopped_strategies};
}
export function verifyReceipt(base,ref,{run_id,candidate,source_identity}={}){
  let receipt=readJSON(verifyRef(base,ref));
  if(receipt.status==='completed_via_bridge')receipt=readJSON(localFile(base,receipt.manifest));
  if(!['received','received_and_audited'].includes(receipt.status))throw Error('Received transfer receipt required');
  const received=receipt.candidate||{path:receipt.file,sha256:receipt.sha256};
  verifyRef(base,received);
  if(run_id&&receipt.run_id!==run_id)throw Error('Receipt source run mismatch');
  if(source_identity&&receipt.source_identity!==source_identity)throw Error('Receipt source identity mismatch');
  if(candidate&&!sameFile(received,candidate))throw Error('Receipt candidate mismatch');
  return received;
}
export function attachSource(base,job,requestRef){
  checkMutable(job);const request=readJSON(verifyRef(base,requestRef));requireText(request.reason,'Source attachment reason');
  verifyRef(base,request.candidate);
  if(request.run_id){
    if(!/^[a-z0-9-]+$/.test(request.run_id))throw Error('Invalid source run');
    const s=readJSON(path.join(base,'runs',request.run_id,'state.json'));
    if(s.status==='exporting'){
      verifyReceipt(base,request.receipt||fileRef(base,`runs/${request.run_id}/transfer-result.json`),request);
    }else if(!['studio_result_ready','qa_review','ready_for_transfer','diagnostic_transfer','downloaded','accepted'].includes(s.status))throw Error('Source run not ready');
  }
  if(request.receipt){
    if(!request.run_id)requireText(request.source_identity,'Receipt source identity');
    verifyReceipt(base,request.receipt,request);
  }
  if(job.active_remote_run&&request.run_id!==job.active_remote_run.run_id)throw Error('Resolve selected remote run before attaching another source');
  if(job.active_remote_run&&job.active_remote_run.source_sha256!==(job.artifacts.candidate?.sha256||null))throw Error('Remote selection source changed');
  job.active_remote_run=null;
  job.source_run_id=request.run_id||null;job.artifacts.candidate=request.candidate;job.stage='base_model';invalidate(job,'Source attached; validate candidate');
  persist(base,job,{type:'source_attached',request:requestRef});return nextAction(job);
}
export function selectCandidate(base,job,requestRef){
  checkMutable(job);const request=readJSON(verifyRef(base,requestRef));requireText(request.reason,'Selection reason');
  verifyRef(base,request.candidate);job.artifacts.candidate=request.candidate;invalidate(job,'Selected candidate is unreviewed');
  persist(base,job,{type:'candidate_selected',request:requestRef});return {selected:request.candidate};
}
export function selectRemote(base,job,requestRef,defer=false){
  checkMutable(job);
  const request=readJSON(verifyRef(base,requestRef));
  requireText(request.reason,'Remote selection reason');requireText(request.purpose,'Remote selection purpose');
  const run=remoteRuns(base).find(r=>r.id===request.run_id);
  if(!run)throw Error('Remote run missing');
  if(remoteRuns(base).some(r=>unresolvedRemote.includes(r.status)&&!continuedUnknown(base,job,r)))throw Error('Reconcile remote submission before selection/defer');
  if(unresolvedRemote.includes(run.status))throw Error('Unknown or active run cannot be selected/deferred');
  if(run.status==='exporting')throw Error('Reconcile remote export before selection/defer');
  if(request.source_sha256!==(job.artifacts.candidate?.sha256||null))throw Error('Remote selection source mismatch');
  if(!defer&&job.active_remote_run&&job.active_remote_run.run_id!==run.id)throw Error('Defer current selected run before replacing it');
  job.remote_dispositions??={};
  job.remote_dispositions[run.id]={status:defer?'deferred':'selected',request:requestRef};
  if(defer){if(job.active_remote_run?.run_id===run.id)job.active_remote_run=null;}
  else job.active_remote_run={run_id:run.id,source_sha256:request.source_sha256,purpose:request.purpose,request:requestRef};
  persist(base,job,{type:defer?'remote_deferred':'remote_selected',request:requestRef});
  return inspectNext(base,job);
}
export function recordContinuation(base,job,requestRef){
  checkMutable(job);
  const request=validateContinuation(base,readJSON(verifyRef(base,requestRef)));
  if(request.source_sha256!==(job.artifacts.candidate?.sha256||null))throw Error('Continuation source changed');
  if(job.active_remote_run&&job.active_remote_run.run_id!==request.replacement_run_id)throw Error('Resolve selected remote run first');
  job.remote_continuations??={};job.remote_continuations[request.unknown_run_id]=requestRef;
  persist(base,job,{type:'user_authorized_remote_continuation',request:requestRef,budget_release:false});
  return inspectNext(base,job);
}
export function recordTransfer(base,job,requestRef){
  checkIdle(job);
  const r=readJSON(verifyRef(base,requestRef));
  requireText(r.id,'Transfer identity');requireText(r.source_identity,'Transfer source identity');
  if(!['bridge','file'].includes(r.route)||!['sending','unknown','received','failed'].includes(r.status))throw Error('Invalid transfer route/status');
  if(!r.evidence?.length)throw Error('Transfer evidence required');r.evidence.forEach(ref=>verifyRef(base,ref));
  const old=job.transfer;
  if(old&&['sending','unknown'].includes(old.status)){
    if(r.id!==old.id||r.source_identity!==old.source_identity||r.route!==old.route||r.status==='sending')throw Error('Reconcile existing transfer before sending again');
  }else if(r.status!=='sending')throw Error('Transfer intent required before receipt');
  if(r.status==='received')verifyRef(base,r.candidate);
  job.transfer={...r,request:requestRef};persist(base,job,{type:'transfer_recorded',request:requestRef});return job.transfer;
}
export function persist(base,job,event){
  job.revision++;job.updated_at=new Date().toISOString();
  job.events.push({at:job.updated_at,revision:job.revision,...event});
  // Canonical state is one atomic commit; projection is disposable and may be regenerated.
  atomicJSON(path.join(base,'production.json'),job);
  atomicJSON(path.join(base,'handoff.json'),projection(job));
}
function invalidate(job,reason){
  job.gates={};job.artifacts.final_files=[];job.status='needs_revision';job.unresolved=[reason];
  job.animation_review_reuse={};
}
export function changeCandidate(base,job,candidate,proof){
  const spec=loadSpec(base,job),source=job.artifacts.candidate,kept={},reviews={},reasons={};
  if(proof){
    // Validate originals against the old source before carrying any evidence forward.
    for(const stage of ['base_model','polish','rig','motion'])if(job.gates[stage]?.status==='accepted'){
      try{assertAccepted(base,job,stage,new Set(),true);verifyUnchanged(base,spec,stage,proof,source,candidate);
        kept[stage]={...job.gates[stage],reuse:extendReuse(job.gates[stage].reuse,source,candidate,proof,job.quality_spec)};
      }catch(e){reasons[stage]=e.message;}
    }
    for(const kind of ['preflight','rhythm'])if(job.animation_reviews?.[kind]){
      try{validateCheckpoint(base,job,spec,job.animation_reviews[kind]);verifyUnchanged(base,spec,kind,proof,source,candidate);
        reviews[kind]=extendReuse(job.animation_review_reuse?.[kind],source,candidate,proof,job.quality_spec);
      }catch(e){reasons[kind]=e.message;}
    }
  }
  job.artifacts.candidate=candidate;invalidate(job,'Candidate changed; affected or unproven checks require review');
  job.gates=kept;job.animation_review_reuse=reviews;
  return {retained_gates:Object.keys(kept),retained_checkpoints:Object.keys(reviews),recheck_reasons:reasons};
}
export function adoptDiagnostic(base,job,requestRef){
  checkMutable(job);
  const r=readJSON(verifyRef(base,requestRef)),spec=loadSpec(base,job);
  requireText(r.reason,'Diagnostic adoption reason');requireText(r.evidence,'Existing production scope evidence');
  const trial=job.local_revisions.records.find(x=>x.id===r.iteration_id);
  if(trial?.operation!=='diagnostic'||trial.status!=='completed'||trial.diagnostic_conclusion!=='supported'||trial.baseline.sha256!==job.artifacts.candidate.sha256||trial.quality_spec.sha256!==job.quality_spec.sha256)throw Error('Adoption requires supported diagnostic on current source/spec');
  const result=readJSON(verifyRef(base,trial.result));
  if(!trial.receipt_required)throw Error('Diagnostic adoption requires a verified execution receipt');
  assertExecutionFinished(base,job,trial,result);verifyRef(base,trial.output);
  if(result.candidate?.sha256!==trial.output.sha256||result.candidate?.path!==trial.output.path)throw Error('Diagnostic output identity mismatch');
  const formalPlan=readJSON(verifyRef(base,r.plan)),trialPlan=readJSON(verifyRef(base,trial.plan));
  if(!trialPlan.adoption_operation||formalPlan.operation!==trialPlan.adoption_operation||['diagnostic','export'].includes(formalPlan.operation))throw Error('Formal operation must match the diagnostic adoption intent');
  if(formalPlan.defect_id!==trial.defect_id||formalPlan.strategy_id!==trial.strategy_id)throw Error('Adoption cannot rename the diagnostic defect/strategy');
  if(formalPlan.execution?.script?.sha256!==trialPlan.execution?.script?.sha256||formalPlan.execution?.script?.path!==trialPlan.execution?.script?.path)throw Error('Adoption must reuse the executed diagnostic script');
  const draft=structuredClone(job);
  // Reuse the same production checks, including scope, prior gates, budget and stopped strategies.
  const formal=beginIterationInternal(base,draft,r.plan,trial);
  const submitted=readJSON(verifyRef(base,r.result));
  const resultPath=`work/adoptions/${formal.id}-${Date.now()}.json`;
  const formalResult={...submitted,job_id:job.job_id,iteration_id:formal.id,status:'completed',candidate:trial.output};
  const target=localFile(base,resultPath);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(formalResult,null,2)+'\n',{flag:'wx'});
  finishIterationInternal(base,draft,fileRef(base,resultPath),false);
  if(formal.outcome!=='improved')throw Error('Diagnostic does not satisfy formal improvement/protection checks');
  const retained=[];
  for(const kind of ['preflight','rhythm'])if(job.animation_reviews?.[kind]){
    try{const d=validateCheckpoint(base,job,spec,job.animation_reviews[kind]);if(d.iteration_id===trial.id&&d.artifact.sha256===trial.output.sha256)retained.push(kind);}catch{}
  }
  draft.diagnostic_adoptions??=[];
  draft.diagnostic_adoptions.push({iteration_id:trial.id,formal_iteration_id:formal.id,baseline:trial.baseline,output:trial.output,quality_spec:trial.quality_spec,request:requestRef});
  for(const kind of ['preflight','rhythm'])if(retained.includes(kind))delete draft.animation_review_reuse?.[kind];
  draft.stage='base_model';
  persist(base,draft,{type:'diagnostic_adopted',request:requestRef,formal_iteration_id:formal.id,retained_checkpoints:retained});
  Object.assign(job,draft);
  return {candidate:trial.output,formal_iteration_id:formal.id,charged_budget_class:formal.budget_class,retained_checkpoints:retained,formal_acceptance:false};
}
function active(job){return job.local_revisions.records.find(r=>r.status==='started');}
function checkIdle(job){if(active(job))throw Error('An iteration is still started; reconcile/finish it first');}
function checkMutable(job){
  checkIdle(job);
  if(job.transfer&&['sending','unknown'].includes(job.transfer.status))throw Error('Reconcile transfer before changing production context');
}
// Progress mode replaces numeric attempt quotas, never quality or execution gates.
export function progressBlockers(job,operation){
  const records=job.local_revisions.records;
  if(operation==='diagnostic'||operation==='export'){
    const same=records.filter(r=>r.operation===operation&&r.baseline?.sha256===job.artifacts.candidate?.sha256&&(operation!=='export'||r.outcome!=='export_verified'));
    if(same.length>=2)return ['Local route exhausted: reuse existing evidence or report the concrete blocker; do not request more attempts'];
    return [];
  }
  let stagnant=0;
  for(const r of [...records].reverse()){
    if(['diagnostic','export'].includes(r.operation)||r.status==='started')continue;
    if(r.outcome==='improved')break;
    stagnant++;
  }
  return stagnant>=6?['Local repair plateau: preserve best candidate, diagnose or report unresolved requirements; do not request more attempts']:[];
}
export function setIterationPolicy(base,job,request){
  checkMutable(job);
  if(!['progress_guarded','explicit_budget'].includes(request.mode))throw Error('Invalid iteration mode');
  requireText(request.evidence,'Actual iteration policy instruction');
  const previous=job.local_revisions.iteration_policy||{mode:'explicit_budget'};
  job.local_revisions.iteration_policy={mode:request.mode,evidence:request.evidence};
  persist(base,job,{type:'iteration_policy_changed',previous,policy:job.local_revisions.iteration_policy,retained_attempts:job.local_revisions.records.length});
  return {mode:request.mode,retained_attempts:job.local_revisions.records.length,invalidated_reviews:false};
}
export function budgetBlockers(base,job,operation,mode='repair'){
  if(job.local_revisions.iteration_policy?.mode==='progress_guarded')return progressBlockers(job,operation);
  const blocked=[],bucket=budgetClass(operation,mode),budgets=job.local_revisions.budgets;
  if(budgets){
    if(!Number.isInteger(budgets[bucket])||budgets[bucket]<0)blocked.push('Operation budget not configured');
    else if(job.local_revisions.records.filter(r=>recordBudget(r)===bucket).length>=budgets[bucket])blocked.push('Operation budget limit reached');
  }
  if(totalLimitApplies(base,job)&&job.local_revisions.records.length>=revisionLimit(base,job))blocked.push('Local revision limit reached');
  return blocked;
}
function totalLimitApplies(base,job){
  if(job.local_revisions.iteration_policy?.mode==='progress_guarded')return false;
  const p=path.join(base,'workflow-policy.json');
  return !job.local_revisions.budgets||job.local_revisions.enforce_total!==false||(fs.existsSync(p)&&readJSON(p).status==='approved');
}
function revisionLimit(base,job){
  const file=path.join(base,'workflow-policy.json');
  if(!fs.existsSync(file))return job.local_revisions.max_started;
  const policy=readJSON(file);
  if(policy.status!=='approved')return job.local_revisions.max_started;
  if(!Number.isInteger(policy.max_local_revision_rounds)||policy.max_local_revision_rounds<0)throw Error('Approved local revision limit invalid');
  return Math.min(job.local_revisions.max_started,policy.max_local_revision_rounds);
}
function stopped(job,defect,strategy){
  if(job.local_revisions.stopped_strategies.some(s=>s.defect_id===defect&&s.strategy_id===strategy))return true;
  const history=job.local_revisions.records.filter(r=>r.defect_id===defect&&r.strategy_id===strategy&&r.operation!=='diagnostic'&&r.status!=='started');
  let failures=0;
  for(const r of history.toReversed()){if(['improved','export_verified'].includes(r.outcome))break;failures++;}
  return failures>=job.local_revisions.stop_after_no_improvement;
}
function verifyArtifacts(base,job){
  for(const [key,value] of Object.entries(job.artifacts)){
    if(key==='final_files'){value.forEach(ref=>verifyRef(base,ref));continue;}
    if(value)verifyRef(base,value);
  }
}
export function inspectProduction(base,job=readProduction(base)){
  const problems=[],warnings=[];
  try{loadSpec(base,job);}catch(e){problems.push(e.message);}
  try{verifyArtifacts(base,job);}catch(e){problems.push(e.message);}
  for(const stage of STAGES)if(job.gates[stage]?.status==='accepted'){
    try{assertAccepted(base,job,stage,new Set(),Boolean(job.gates[stage].reuse));}catch(e){problems.push(e.message);}
  }
  if(job.status==='accepted'&&job.gates.final?.status!=='accepted')problems.push('Final acceptance missing');
  const handoff=path.join(base,'handoff.json');
  try{if(!fs.existsSync(handoff)||JSON.stringify(readJSON(handoff))!==JSON.stringify(projection(job)))warnings.push('Derived handoff stale; run sync');}
  catch{warnings.push('Derived handoff unreadable; run sync');}
  const spec=(()=>{try{return loadSpec(base,job);}catch{return null;}})();
  let effectiveLimit=job.local_revisions.max_started;
  try{effectiveLimit=totalLimitApplies(base,job)?revisionLimit(base,job):null;}catch(e){problems.push(e.message);}
  const applicable=spec?new Set(stageChain(spec).flatMap(s=>spec.gates[s])):new Set();
  const unresolvedLimits=spec?Object.entries(spec.criteria).filter(([k,r])=>applicable.has(k)&&r.kind==='metric'&&r.applicable!==false&&r.limit===null).map(([k])=>k):[];
  return {valid:problems.length===0,problems,warnings,job_id:job.job_id,stage:job.stage,status:job.status,candidate:job.artifacts.candidate,artifacts:job.artifacts,
    quality_spec:job.quality_spec,unresolved_limits:unresolvedLimits,started:job.local_revisions.records.length,effective_limit:effectiveLimit,remaining:effectiveLimit===null?null:Math.max(0,effectiveLimit-job.local_revisions.records.length),budgets:job.local_revisions.budgets||null,budget_usage:Object.fromEntries(['repair','diagnostic','creation','export'].map(k=>[k,job.local_revisions.records.filter(r=>recordBudget(r)===k).length])),active_iteration:active(job)?.id||null,
    stopped_strategies:job.local_revisions.stopped_strategies,unresolved:job.unresolved};
}
export function beginIteration(base,job,planRef){
  return beginIterationInternal(base,job,planRef);
}
function beginIterationInternal(base,job,planRef,adoption=null){
  checkMutable(job);
  const spec=loadSpec(base,job);
  if(spec.status!=='active')throw Error('Quality spec is draft');
  const plan=readJSON(verifyRef(base,planRef));
  validateExecutionPlan(base,plan,job.execution_required!==false);
  const capability=validateCapability(base,plan,spec);
  if(capability&&capability.input_format.toLowerCase()!==path.extname(job.artifacts.candidate?.path||'').slice(1).toLowerCase())throw Error('Capability source format mismatch');
  if(!Object.hasOwn(operations,plan.operation))throw Error('Unsupported local operation');
  requireText(plan.authorization_evidence,'authorization_evidence');
  if(plan.operation==='export')requireText(plan.format,'Export format');
  else for(const key of ['defect_id','strategy_id','hypothesis'])requireText(plan[key],key);
  if(plan.job_id!==job.job_id||plan.quality_spec_sha256!==job.quality_spec.sha256||plan.source_sha256!==job.artifacts.candidate?.sha256)throw Error('Iteration identity/spec mismatch');
  verifyRef(base,job.artifacts.candidate);
  checkAnimationPlan(base,job,spec,plan);
  if(!Array.isArray(plan.success_checks)||!plan.success_checks.length||plan.success_checks.some(n=>!spec.criteria[n]))throw Error('Known success checks required');
  if(!Array.isArray(plan.protected_checks)||!plan.protected_checks.length||plan.protected_checks.some(n=>!spec.criteria[n]))throw Error('Known protected checks required');
  const bucket=budgetClass(plan.operation,plan.mode),blocked=budgetBlockers(base,job,plan.operation,plan.mode);
  if(blocked.length)throw Error(blocked.join('; '));
  if(!['export','diagnostic'].includes(plan.operation)&&stopped(job,plan.defect_id,plan.strategy_id))throw Error('Strategy stopped after no improvement; use a materially different hypothesis');
  validateStrategyReview(base,job,plan);
  const target=localFile(base,plan.output_path);
  if(adoption){
    if(plan.output_path!==adoption.output.path||fileRef(base,plan.output_path).sha256!==adoption.output.sha256)throw Error('Adoption output must be the exact diagnostic artifact');
  }else if(fs.existsSync(target))throw Error('Output already exists; preserve previous versions');
  // Resolve existing parent to prevent writing through a symlink outside the asset.
  let parent=path.dirname(target);
  while(!fs.existsSync(parent))parent=path.dirname(parent);
  if(parent!==path.resolve(base))localFile(base,path.relative(base,parent));
  const stage=operationStage(spec,plan.operation);
  if(plan.operation==='weight_repair'){
    if(!stage)throw Error('Weight repair requires an applicable weights criterion in the frozen rig, motion or polish gate');
    if(![...plan.success_checks,...plan.protected_checks].includes('weights'))throw Error('Weight repair must include weights in success_checks or protected_checks');
    for(const prior of predecessors(stage,spec))assertAccepted(base,job,prior);
  }
  if(plan.operation==='rig'){if(!spec.rig_required)throw Error('Configure rig_required before rig creation/repair');assertAccepted(base,job,'polish');}
  if(plan.operation==='motion')assertAccepted(base,job,spec.rig_required?'rig':'polish');
  if(plan.operation==='export')assertAccepted(base,job,spec.motion_required?'motion':spec.rig_required?'rig':'polish');
  const mode=plan.mode||'repair';
  if(!['repair','create'].includes(mode)||mode==='create'&&!['motion','rig','material','uv'].includes(plan.operation))throw Error('Unsupported creation mode');
  const round={id:`local-${String(job.local_revisions.records.length+1).padStart(3,'0')}`,status:'started',receipt_required:job.execution_required!==false||Boolean(plan.execution),operation:plan.operation,stage,mode,budget_class:bucket,
    defect_id:plan.defect_id,strategy_id:plan.strategy_id,plan:planRef,baseline:job.artifacts.candidate,quality_spec:job.quality_spec,output_path:plan.output_path,started_at:new Date().toISOString()};
  if(plan.operation==='export'){
    round.previous_delivery_reviews={engine:job.gates.engine,final:job.gates.final};
    delete job.gates.engine;delete job.gates.final;
    job.artifacts.final_files=[];
  }
  job.local_revisions.records.push(round);job.stage=stage;job.status='working';
  if(adoption)round.adopted_diagnostic_id=adoption.id;
  else persist(base,job,{type:'iteration_started',id:round.id,plan:planRef});
  return round;
}
export function finishIteration(base,job,resultRef){
  return finishIterationInternal(base,job,resultRef);
}
function finishIterationInternal(base,job,resultRef,commit=true){
  const round=active(job);
  if(!round)throw Error('No started iteration');
  const result=readJSON(verifyRef(base,resultRef));
  if(result.iteration_id!==round.id||result.job_id!==job.job_id||!['completed','failed','aborted'].includes(result.status))throw Error('Iteration result mismatch');
  requireText(result.summary,'Iteration summary');
  if(!Array.isArray(result.evidence)||!result.evidence.length)throw Error('Result evidence required');
  result.evidence.forEach(ref=>verifyRef(base,ref));
  verifyRef(base,round.baseline);verifyRef(base,round.quality_spec);
  assertExecutionFinished(base,job,round,result);
  let improved=false,candidate=null,exportVerified=false;
  if(result.status==='completed'){
    candidate=result.candidate;
    if(candidate?.path!==round.output_path)throw Error('Output does not match reserved path');
    verifyRef(base,candidate);
    const completedPlan=readJSON(verifyRef(base,round.plan));
    checkRegression(base,job,loadSpec(base,job),completedPlan,round,result);
    const compatible=verifyCapabilityResult(base,completedPlan,loadSpec(base,job),round,result);
    if(round.operation==='export'){
      if(!result.candidate_report)throw Error('Export roundtrip report required');
      const plan=readJSON(verifyRef(base,round.plan));
      const evaluation=evaluateReport(base,job,'final',result.candidate_report,round.baseline,[...plan.success_checks,...plan.protected_checks],'export_roundtrip');
      const report=readJSON(verifyRef(base,result.candidate_report));
      if(!report.deliverables?.some(r=>r.path===candidate.path&&r.sha256===candidate.sha256))throw Error('Reserved export missing from final report');
      exportVerified=evaluation.action!=='blocked'&&compatible;
    }else if(round.operation!=='diagnostic'){
      if(!result.baseline_report||!result.candidate_report)throw Error('Independent before/after reports required');
      const plan=readJSON(verifyRef(base,round.plan));
      improved=compareReports(base,job,round.stage,round.baseline,candidate,result.baseline_report,result.candidate_report,{...plan,mode:round.mode,comparison:result.comparison})&&compatible;
    }
  }
  let diagnosticOutcome=null;
  if(round.operation==='diagnostic'){
    diagnosticOutcome=result.diagnostic_conclusion;
    if(result.status==='completed'&&!['supported','refuted','inconclusive'].includes(diagnosticOutcome))throw Error('Diagnostic conclusion required');
    if(result.status!=='completed')diagnosticOutcome='execution_failed';
  }
  round.status=result.status;round.outcome=diagnosticOutcome?'diagnostic_'+diagnosticOutcome:improved?'improved':exportVerified?'export_verified':'no_improvement';
  if(diagnosticOutcome)round.diagnostic_conclusion=diagnosticOutcome;round.result=resultRef;round.finished_at=new Date().toISOString();
  if(candidate){round.output=candidate;if(round.operation!=='export')job.artifacts.latest_diagnostic=candidate;}
  if(improved)round.review_reuse=changeCandidate(base,job,candidate,result.reuse_proof);
  else{job.status=exportVerified?'ready':'needs_revision';job.unresolved=exportVerified?[]:[result.summary];}
  if(!['export','diagnostic'].includes(round.operation)&&stopped(job,round.defect_id,round.strategy_id)&&!job.local_revisions.stopped_strategies.some(s=>s.defect_id===round.defect_id&&s.strategy_id===round.strategy_id))job.local_revisions.stopped_strategies.push({defect_id:round.defect_id,strategy_id:round.strategy_id,reason:'Consecutive started attempts without verified overall improvement',evidence:resultRef});
  if(commit)persist(base,job,{type:'iteration_finished',id:round.id,outcome:round.outcome,result:resultRef});
  return round;
}
export function evaluateGate(base,job,stage,reportRef){
  checkMutable(job);
  const spec=loadSpec(base,job);
  for(const prior of predecessors(stage,spec))assertAccepted(base,job,prior);
  const result=evaluateReport(base,job,stage,reportRef);
  // A new evaluation also invalidates decisions dependent on the previous review.
  for(const s of STAGES.slice(STAGES.indexOf(stage)))if(s===stage||!job.gates[s]?.reuse)delete job.gates[s];
  job.gates[stage]={status:result.action==='blocked'?'blocked':'awaiting_review',report:reportRef,result};
  job.stage=stage;job.status=result.action==='blocked'?'needs_revision':'awaiting_review';
  job.unresolved=result.checks.filter(c=>!['pass','not_applicable'].includes(c.status)).map(c=>`${c.name}: ${c.reason||c.status}`);
  persist(base,job,{type:'gate_evaluated',stage,report:reportRef,action:result.action});
  return result;
}
export function recordDecision(base,job,stage,decisionRef){
  checkMutable(job);
  const gate=job.gates[stage];
  if(gate?.status!=='awaiting_review')throw Error('No technical gate awaiting review');
  const spec=loadSpec(base,job);
  for(const prior of predecessors(stage,spec))assertAccepted(base,job,prior);
  const result=evaluateReport(base,job,stage,gate.report), decision=readJSON(verifyRef(base,decisionRef));
  validateDecision(job,stage,gate.report,result.action,decision);
  gate.status=decision.decision;gate.decision=decisionRef;
  job.status=decision.decision==='rejected'?'needs_revision':stage==='final'?'accepted':'ready';
  if(decision.decision==='accepted'){
    if(stage==='polish')job.artifacts.repair_baseline=job.artifacts.candidate;
    if(stage==='motion')job.artifacts.best_motion_draft=job.artifacts.candidate;
    if(stage==='final')job.artifacts.final_files=readJSON(verifyRef(base,gate.report)).deliverables;
  }
  persist(base,job,{type:'review_decision',stage,decision:decisionRef});
  return {stage,status:gate.status};
}
// Preview all technical reports without inventing earlier user decisions. Commit
// one explicitly reviewed bundle atomically, retaining a decision per gate.
export function reviewBundle(base,job,requestRef,commit=false){
  checkMutable(job);
  const request=readJSON(verifyRef(base,requestRef)),spec=loadSpec(base,job),chain=stageChain(spec);
  if(request.job_id!==job.job_id||request.source_sha256!==job.artifacts.candidate?.sha256||request.quality_spec_sha256!==job.quality_spec.sha256)throw Error('Review bundle identity mismatch');
  if(!request.items?.length)throw Error('Review bundle items required');
  const stages=request.items.map(x=>x.stage),start=chain.indexOf(stages[0]);
  if(start<0||JSON.stringify(stages)!==JSON.stringify(chain.slice(start,start+stages.length)))throw Error('Review bundle must contain consecutive applicable gates');
  for(const prior of chain.slice(0,start))assertAccepted(base,job,prior);
  const draft=structuredClone(job),results=[];
  for(const item of request.items){
    const result=evaluateReport(base,draft,item.stage,item.report);
    results.push({stage:item.stage,...result});
    if(commit){
      if(result.action==='blocked')throw Error('Review bundle contains technical failures');
      const decision=readJSON(verifyRef(base,item.decision));
      validateDecision(draft,item.stage,item.report,result.action,decision);
      if(decision.decision!=='accepted')throw Error('Bundle commit accepts only explicitly accepted gates; record rejection separately');
      draft.gates[item.stage]={status:'accepted',report:item.report,result,decision:item.decision};
    }
  }
  if(!commit)return {action:results.some(r=>r.action==='blocked')?'blocked':'bundle_review',results,committed:false};
  for(const s of chain.slice(start+stages.length))if(!draft.gates[s]?.reuse)delete draft.gates[s];
  draft.artifacts.final_files=[];
  if(stages.includes('polish'))draft.artifacts.repair_baseline=draft.artifacts.candidate;
  if(stages.includes('motion'))draft.artifacts.best_motion_draft=draft.artifacts.candidate;
  if(stages.includes('final'))draft.artifacts.final_files=readJSON(verifyRef(base,request.items.at(-1).report)).deliverables;
  draft.stage=stages.at(-1);draft.status=draft.stage==='final'?'accepted':'ready';draft.unresolved=[];
  persist(base,draft,{type:'review_bundle_accepted',request:requestRef,stages});
  Object.assign(job,draft);
  return {committed:true,stages,status:job.status};
}
export function configure(base,job,configRef){
  checkMutable(job);
  const c=readJSON(verifyRef(base,configRef));
  requireText(c.reason,'Configuration change reason');requireText(c.evidence,'Existing scope/requirements evidence');
  const spec=validateSpec(readJSON(verifyRef(base,c.quality_spec)));
  const dependencyProblems=reuseDependencyProblems(spec);
  if(dependencyProblems.length)throw Error('Reuse dependencies omit mandatory domains: '+JSON.stringify(dependencyProblems));
  if(spec.delivery_tier){
    if(c.requirements?.delivery_tier!==spec.delivery_tier)throw Error('Delivery tier mismatch');
    requireText(c.requirements.delivery_tier_evidence,'Actual delivery tier scope evidence');
  }
  assertEvidencePolicy(job,spec);
  if((job.animation_workflow_required||loadSpec(base,job).animation_workflow)&&animated({requirements:c.requirements})&&!spec.animation_workflow)throw Error('Animation workflow policy required; cannot silently disable');
  if(Boolean(c.requirements?.rig_required)!==Boolean(spec.rig_required))throw Error('Rig applicability mismatch');
  if(c.requirements?.motion_required!==spec.motion_required)throw Error('Requirements applicability mismatch');
  if(Boolean(c.requirements.engine?.required)!==Boolean(spec.engine_required))throw Error('Engine applicability mismatch');
  if(spec.engine_required)for(const key of ['name','version','project'])requireText(c.requirements.engine[key],`Engine ${key}`);
  requireText(c.requirements.intent,'Current intent');
  const progressMode=job.local_revisions.iteration_policy?.mode==='progress_guarded';
  if(progressMode&&c.max_started===undefined)c.max_started=job.local_revisions.max_started;
  if(!Number.isInteger(c.max_started)||c.max_started<0||(!progressMode&&c.max_started<job.local_revisions.records.length))throw Error('Limit cannot erase consumed rounds');
  if(!progressMode&&c.max_started>job.local_revisions.max_started)requireText(c.limit_extension_evidence,'Explicit limit extension evidence');
  if(!['guided','autonomous'].includes(c.review_mode))throw Error('Review mode required');
  if(c.budgets){
    for(const key of ['repair','diagnostic','creation','export'])if(!Number.isInteger(c.budgets[key])||c.budgets[key]<job.local_revisions.records.filter(r=>recordBudget(r)===key).length)throw Error('Invalid classified budget');
    requireText(c.budget_evidence,'Budget scope evidence');
    if(!job.local_revisions.budgets||job.local_revisions.records.length||job.local_revisions.historical_count!==null)requireText(c.limit_extension_evidence,'Existing budget migration evidence');
  }
  const previous={quality_spec:job.quality_spec,requirements:job.requirements,max_started:job.local_revisions.max_started,review_mode:job.review_mode};
  job.quality_spec=c.quality_spec;job.requirements=c.requirements;job.local_revisions.max_started=c.max_started;job.review_mode=c.review_mode;
  if(c.budgets){job.local_revisions.budgets=c.budgets;job.local_revisions.enforce_total=c.enforce_total!==false;job.local_revisions.budget_evidence=c.budget_evidence;}
  invalidate(job,'Configuration changed; review evidence must be regenerated');
  persist(base,job,{type:'configuration_changed',config:configRef,previous});
  return {quality_spec:job.quality_spec,invalidated_reviews:true};
}
function main(args){
  const [command,id,arg]=args;
  if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Usage: production.mjs COMMAND ASSET [FILE|STAGE] [FILE]');
  const base=path.join(root,'assets',id);
  if(command==='next'){console.log(JSON.stringify(inspectNext(base),null,2));return;}
  if(command==='review-bundle'){console.log(JSON.stringify(reviewBundle(base,readProduction(base),fileRef(base,arg)),null,2));return;}
  if(['status','check'].includes(command)){
    const report=inspectProduction(base);console.log(JSON.stringify(report,null,2));if(!report.valid)process.exitCode=1;return;
  }
  const lock=path.join(base,'.workflow.lock'),fd=fs.openSync(lock,'wx');
  try{
    const job=readProduction(base);let result;
    if(command==='sync'){atomicJSON(path.join(base,'handoff.json'),projection(job));result={synchronized:true};}
    else if(command==='begin')result=beginIteration(base,job,fileRef(base,arg));
    else if(command==='dispatch'){result=prepareExecution(base,job);persist(base,job,{type:'execution_dispatched',iteration_id:result.iteration_id});}
    else if(command==='recover-execution'){result=recoverExecution(base,job);persist(base,job,{type:'execution_recovered',...result});}
    else if(command==='reconcile-execution'){result=reconcileExecution(base,job);persist(base,job,{type:'execution_reconciled',...result});}
    else if(command==='abort-execution'){result=abortExecution(base,job,fileRef(base,arg));persist(base,job,{type:'execution_aborted',...result});}
    else if(command==='finish')result=finishIteration(base,job,fileRef(base,arg));
    else if(command==='evaluate')result=evaluateGate(base,job,arg,fileRef(base,args[3]));
    else if(command==='decide')result=recordDecision(base,job,arg,fileRef(base,args[3]));
    else if(command==='accept-bundle')result=reviewBundle(base,job,fileRef(base,arg),true);
    else if(command==='animation-review'){checkMutable(job);const ref=fileRef(base,arg),draft={...job,animation_review_reuse:{}},d=validateCheckpoint(base,draft,loadSpec(base,job),ref);job.animation_reviews??={};job.animation_reviews[d.kind]=ref;delete job.animation_review_reuse?.[d.kind];persist(base,job,{type:'animation_review',kind:d.kind,report:ref});result={kind:d.kind,decision:d.decision};}
    else if(command==='adopt-diagnostic')result=adoptDiagnostic(base,job,fileRef(base,arg));
    else if(command==='configure')result=configure(base,job,fileRef(base,arg));
    else if(command==='transfer')result=recordTransfer(base,job,fileRef(base,arg));
    else if(command==='attach-source')result=attachSource(base,job,fileRef(base,arg));
    else if(command==='select')result=selectCandidate(base,job,fileRef(base,arg));
    else if(command==='continue-remote')result=recordContinuation(base,job,fileRef(base,arg));
    else if(['select-remote','defer-remote'].includes(command))result=selectRemote(base,job,fileRef(base,arg),command==='defer-remote');
    else throw Error('Commands: next, status, check, sync, animation-review, configure, transfer, attach-source, select, select-remote, defer-remote, begin, dispatch, recover-execution, reconcile-execution, abort-execution, finish, evaluate, decide, review-bundle, accept-bundle');
    console.log(JSON.stringify(result,null,2));if(result.action==='blocked')process.exitCode=1;
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
