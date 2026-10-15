import {readJSON,verifyRef,requireText} from './production-io.mjs';
import {verifyReuseChain} from './review-reuse.mjs';

export const animated = job => Boolean(job.requirements.rig_required || job.requirements.motion_required || job.requirements.animation_use === 'future_animation');
const list=(v,label)=>{if(!Array.isArray(v)||!v.length||v.some(x=>typeof x!=='string'||!x.trim())||new Set(v).size!==v.length)throw Error(label+' must be a nonempty unique list');return v;};
const evidence=(base,items)=>{if(!Array.isArray(items)||!items.length)throw Error('Animation evidence required');items.forEach(r=>verifyRef(base,r));};
export function validateAnimationPolicy(policy){
  if(!policy)return;
  if(policy.version!==1)throw Error('Animation workflow version must be 1');
  list(policy.probes,'Target probes');list(policy.clips,'Target clips');
  if(!Array.isArray(policy.protection_matrix)||!policy.protection_matrix.length)throw Error('Bidirectional protection matrix required');
  for(const p of policy.protection_matrix){requireText(p.id,'Protection pair id');requireText(p.stimulus,'Stimulus');requireText(p.region,'Protected region');requireText(p.root_removal,'Root removal');requireText(p.measurement,'Measurement and asset-specific tolerance');}
  if(new Set(policy.protection_matrix.map(p=>p.id)).size!==policy.protection_matrix.length)throw Error('Duplicate protection pair');
  // Every requested probe must have its own protected region, not only arm -> belly.
  for(const probe of policy.probes)if(!policy.protection_matrix.some(p=>p.stimulus===probe))throw Error('Uncovered protection stimulus: '+probe);
}
function identity(job,doc,source){
  if(doc.job_id!==job.job_id||doc.source_sha256!==source.sha256||doc.quality_spec_sha256!==job.quality_spec.sha256)throw Error('Animation review identity mismatch');
}
export function validateProtection(base,policy,rows){
  if(!Array.isArray(rows))throw Error('Protection results required');
  for(const pair of policy.protection_matrix){
    const matches=rows.filter(x=>x.id===pair.id);
    if(matches.length!==1||matches[0].status!=='pass')throw Error('Protection failed or missing: '+pair.id);
    requireText(matches[0].observation,'Protection observation');evidence(base,matches[0].evidence);
  }
}
export function validatePresentation(base,policy,presentation,kind='clips'){
  if(!presentation)throw Error('Visual presentation required');
  const required=kind==='probes'?policy.probes:policy.clips;
  for(const name of required){
    const item=presentation.find?.(x=>x.name===name);
    if(!item)throw Error('Missing presentation: '+name);
    // Still poses alone cannot establish rhythm, naturalness or transient defects.
    for(const role of ['front','side','closeup','realtime','slow_motion']){
      const view=item.views?.find(x=>x.role===role);
      if(!view)throw Error('Missing presentation view: '+name+'/'+role);
      verifyRef(base,view.file);
      if(['realtime','slow_motion'].includes(role)&&(!Number.isFinite(view.speed)||view.speed<=0||(role==='realtime'?view.speed!==1:view.speed>=1)))throw Error('Explicit playback speed required');
      if(role==='closeup')requireText(view.region,'Closeup region');
    }
    if(item.status!=='pass')throw Error('Visual presentation unresolved: '+name);
    requireText(item.observation,'Visual observation');
  }
}
export function validateCheckpoint(base,job,spec,ref){
  const policy=spec.animation_workflow;if(!policy||!animated(job))throw Error('Animation workflow not enabled');
  const d=readJSON(verifyRef(base,ref));
  const reuse=job.animation_review_reuse?.[d.kind];
  const source=reuse?verifyReuseChain(base,job,spec,d.kind,reuse):job.artifacts.candidate;
  const adopted=job.diagnostic_adoptions?.find(x=>x.iteration_id===d.iteration_id&&x.output.sha256===source.sha256&&x.output.path===source.path&&x.quality_spec.sha256===job.quality_spec.sha256);
  if(adopted){verifyRef(base,adopted.request);identity(job,d,adopted.baseline);}
  else identity(job,d,source);
  if(!['preflight','rhythm'].includes(d.kind))throw Error('Unknown animation checkpoint');
  const iteration=job.local_revisions.records.find(r=>r.id===d.iteration_id);
  if(iteration?.operation!=='diagnostic'||iteration.status!=='completed'||iteration.baseline.sha256!==d.source_sha256||iteration.quality_spec.sha256!==d.quality_spec_sha256||iteration.output?.sha256!==d.artifact?.sha256||iteration.output?.path!==d.artifact?.path)throw Error('Checkpoint requires completed diagnostic on current source/spec');
  if(iteration.diagnostic_conclusion!=='supported')throw Error('Checkpoint diagnostic must support acceptance');
  verifyRef(base,d.artifact);evidence(base,d.evidence);
  if(d.decision!=='accepted')throw Error('Checkpoint not accepted');
  if(d.kind==='rhythm'&&d.reviewer!=='user')throw Error('Rhythm requires actual user review');
  if(d.kind==='preflight'&&!['user','ai'].includes(d.reviewer))throw Error('Checkpoint reviewer required');
  requireText(d.review_evidence,'Actual review evidence');
  validateProtection(base,policy,d.protection);
  validatePresentation(base,policy,d.presentation,d.kind==='preflight'?'probes':'clips');
  return d;
}
export function requireCheckpoint(base,job,spec,kind){
  const ref=job.animation_reviews?.[kind];if(!ref)throw Error('Animation '+kind+' checkpoint required');
  const d=validateCheckpoint(base,job,spec,ref);if(d.kind!==kind)throw Error('Checkpoint kind mismatch');return d;
}
export function checkAnimationPlan(base,job,spec,plan){
  if(!animated(job)||!spec.animation_workflow)return;
  if(plan.operation==='diagnostic')return; // Early proxy rig/blocking is isolated and never promoted.
  if(['rig','material','uv'].includes(plan.operation))requireCheckpoint(base,job,spec,'preflight');
  if(plan.operation==='motion')requireCheckpoint(base,job,spec,'rhythm');
  if(plan.operation!=='export'&&(plan.mode||'repair')==='repair'){
    list(plan.change_scope?.changed,'Changed selectors');list(plan.change_scope?.protected,'Protected selectors');
    if(plan.change_scope.changed.some(x=>plan.change_scope.protected.includes(x)))throw Error('Changed/protected selectors overlap');
    list(plan.change_scope.affected_clips,'Affected clips/probes');
    const names=[...spec.animation_workflow.clips,...spec.animation_workflow.probes];
    if(plan.change_scope.affected_clips.some(x=>!names.includes(x)))throw Error('Unknown affected clip/probe');
    if(plan.change_scope.changed.some(x=>/:(geometry|weights|skeleton)$/.test(x))&&spec.animation_workflow.clips.some(x=>!plan.change_scope.affected_clips.includes(x)))throw Error('Structural changes require every dependent clip');
  }
}
export function checkRegression(base,job,spec,plan,round,result){
  if(!animated(job)||!spec.animation_workflow||round.mode!=='repair'||['diagnostic','export'].includes(round.operation))return;
  const r=readJSON(verifyRef(base,result.regression));
  if(r.source_sha256!==round.baseline.sha256||r.output_sha256!==result.candidate.sha256||r.plan_sha256!==round.plan.sha256)throw Error('Regression identity mismatch');
  for(const key of ['before','after'])verifyRef(base,r[key]);
  const before=readJSON(verifyRef(base,r.before)),after=readJSON(verifyRef(base,r.after));
  if(!/^[a-f0-9]{64}$/.test(before.collector_sha256||'')||before.collector_sha256!==after.collector_sha256||!before.blender_version||before.blender_version!==after.blender_version)throw Error('Regression collector/version mismatch');
  if(before.source_sha256!==r.source_sha256||after.source_sha256!==r.output_sha256)throw Error('Regression snapshot source mismatch');
  const keys=new Set([...Object.keys(before.properties||{}),...Object.keys(after.properties||{})]);
  for(const selector of [...plan.change_scope.changed,...plan.change_scope.protected])if(!keys.has(selector))throw Error('Snapshot selector missing: '+selector);
  for(const key of keys){
    if(!/^[a-f0-9]{64}$/.test(before.properties[key]||'')||!/^[a-f0-9]{64}$/.test(after.properties[key]||''))throw Error('Complete property hashes required');
    if(before.properties[key]!==after.properties[key]&&!plan.change_scope.changed.includes(key))throw Error('Unexpected property change: '+key);
  }
  for(const name of plan.change_scope.affected_clips){const check=r.playback?.find(x=>x.name===name);if(check?.status!=='pass')throw Error('Regression playback required: '+name);evidence(base,check.evidence);requireText(check.observation,'Playback observation');}
  validateProtection(base,spec.animation_workflow,r.protection);
}
export function checkAnimationReport(base,job,spec,stage,report,source,purpose){
  if(!animated(job)||!spec.animation_workflow||purpose!=='gate'&&purpose!=='export_roundtrip')return;
  if(!['rig','motion','final'].includes(stage))return;
  const r=readJSON(verifyRef(base,report.animation_review));identity(job,r,source);
  validateProtection(base,spec.animation_workflow,r.protection);
  validatePresentation(base,spec.animation_workflow,r.presentation,stage==='rig'?'probes':'clips');
}
