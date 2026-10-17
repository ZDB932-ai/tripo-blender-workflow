import {validateAnimationPolicy,checkAnimationReport} from './animation-review.mjs';
import {isDeepStrictEqual} from 'node:util';
import {readJSON, verifyRef, requireText} from './production-io.mjs';
import {currentExport,sameFiles} from './export-chain.mjs';
import {validateRegionVariants,verifyMeasurementContract} from './measurement-contract.mjs';
import {validateReuseContract,verifyReuseChain} from './review-reuse.mjs';

export const STAGES=['base_model','polish','rig','motion','engine','final'];
export const stageChain=spec=>STAGES.filter(s=>(s!=='rig'||spec.rig_required)&&(s!=='motion'||spec.motion_required)&&(s!=='engine'||spec.engine_required));
export function validateSpec(spec){
  validateReuseContract(spec.reuse_contract);
  if(spec.delivery_tier!==undefined){
    if(!['concept_preview','static_asset','animated_asset','engine_asset'].includes(spec.delivery_tier))throw Error('Unknown delivery tier');
    if(['concept_preview','static_asset'].includes(spec.delivery_tier)&&(spec.motion_required||spec.rig_required||spec.engine_required))throw Error('Static delivery tier cannot hide animation/engine requirements');
    if(spec.delivery_tier==='animated_asset'&&!spec.motion_required&&!spec.rig_required)throw Error('Animated tier requires rig/motion');
    if(spec.delivery_tier==='engine_asset'&&!spec.engine_required)throw Error('Engine tier requires target');
  }
  validateAnimationPolicy(spec.animation_workflow);
  if(spec.schema_version!==2||!['draft','active'].includes(spec.status))throw Error('Quality spec v2 required');
  requireText(spec.suite_id,'Test suite identity');
  requireText(spec.basis,'Quality requirements basis');
  if(typeof spec.motion_required!=='boolean')throw Error('Explicit motion applicability required');
  if(spec.structure!==undefined&&!['skinned','rigid','mixed'].includes(spec.structure))throw Error('Unknown rig structure');
  if(spec.evidence_policy)for(const key of ['measurement_required','visual_required','capability_required'])if(typeof spec.evidence_policy[key]!=='boolean')throw Error('Explicit evidence policy required: '+key);
  const applicable=stageChain(spec).flatMap(s=>spec.gates?.[s]||[]).map(n=>spec.criteria?.[n]).filter(r=>r&&r.applicable!==false);
  if(spec.status==='active'){
    if(spec.structure==='mixed'&&spec.rig_required)for(const key of ['skinned','rigid'])if(!Array.isArray(spec.structure_regions?.[key])||!spec.structure_regions[key].length||spec.structure_regions[key].some(x=>typeof x!=='string'||!x.trim()))throw Error('Mixed structure regions required: '+key);
    if(spec.evidence_policy?.measurement_required&&applicable.some(r=>r.kind==='metric')&&!spec.measurement_contract)throw Error('Measurement contract required for active standard');
    if(spec.evidence_policy?.visual_required&&applicable.some(r=>r.kind==='visual')&&!spec.visual_contract)throw Error('Visual capture contract required for active standard');
  }
  if(spec.visual_contract){
    const c=spec.visual_contract;
    if(!/^[a-f0-9]{64}$/.test(c.collector_sha256||''))throw Error('Frozen visual collector hash required');
    requireText(c.blender_version,'Visual Blender version');
    for(const key of ['scene','view_layer','views','resolution','samples','transparent','color','display_device','lights','world_color','world_strength'])if(c.conditions?.[key]===undefined)throw Error('Frozen visual condition required: '+key);
    if(!Array.isArray(c.conditions.views)||!c.conditions.views.length)throw Error('Frozen views required');
  }
  for(const flag of ['rig_required','engine_required'])if(spec[flag]!==undefined&&typeof spec[flag]!=='boolean')throw Error('Boolean applicability required: '+flag);
  if(spec.measurement_contract){
    const c=spec.measurement_contract;
    if(!/^[a-f0-9]{64}$/.test(c.collector_sha256||''))throw Error('Frozen collector hash required');
    requireText(c.blender_version,'Measurement Blender version');
    for(const key of ['samples','regions','reference_frame','scale'])if(c.conditions?.[key]===undefined)throw Error('Frozen measurement condition required: '+key);
    validateRegionVariants(c);
  }
  for(const stage of stageChain(spec)){
    const names=spec.gates?.[stage];
    if(!Array.isArray(names)||!names.length||new Set(names).size!==names.length)throw Error(`Quality requirements missing/duplicated: ${stage}`);
    for(const name of names){
      const rule=spec.criteria?.[name];
      if(!rule||!['metric','visual','assertion'].includes(rule.kind))throw Error(`Invalid criterion: ${name}`);
      requireText(rule.description,`Description ${name}`);
      if(rule.applicable===false)requireText(rule.exception_reason,`Frozen exception ${name}`);
      if(rule.kind==='metric'){
        if(!['lte','gte','eq'].includes(rule.operator))throw Error(`Invalid operator ${name}`);
        requireText(rule.unit,`Unit ${name}`);
        if(rule.limit!==null&&!Number.isFinite(rule.limit))throw Error(`Invalid limit ${name}`);
      }
    }
  }
  for(const [name,rule] of Object.entries(spec.criteria||{})){
    if(rule.comparison){
      if(rule.kind!=='metric')throw Error('Comparison tolerance requires metric: '+name);
      for(const k of ['absolute','relative','minimum_improvement'])if(rule.comparison[k]!==undefined&&(!Number.isFinite(rule.comparison[k])||rule.comparison[k]<0))throw Error('Invalid comparison tolerance: '+name);
    }
  }
  return spec;
}
export function assertEvidencePolicy(job,spec){
  if(job.evidence_policy_required&&['measurement_required','visual_required','capability_required'].some(k=>spec.evidence_policy?.[k]!==true))throw Error('New production requires full evidence policy');
}
export function loadSpec(base,job){
  const spec=validateSpec(readJSON(verifyRef(base,job.quality_spec)));
  assertEvidencePolicy(job,spec);
  if(spec.delivery_tier&&(job.requirements.delivery_tier!==spec.delivery_tier||!job.requirements.delivery_tier_evidence?.trim()))throw Error('Delivery tier must match current user scope');
  if(Boolean(spec.rig_required)!==Boolean(job.requirements.rig_required))throw Error('Rig requirements/spec mismatch');
  if(spec.motion_required!==job.requirements.motion_required)throw Error('Motion requirements/spec mismatch');
  if(Boolean(spec.engine_required)!==Boolean(job.requirements.engine?.required))throw Error('Engine requirements/spec mismatch');
  return spec;
}
export function predecessors(stage,spec){
  const chain=stageChain(spec);
  const index=chain.indexOf(stage);
  if(index<0)throw Error('Stage not applicable');
  return chain.slice(0,index);
}
function pointer(object,p){
  if(typeof p!=='string'||!p.startsWith('/'))throw Error('JSON pointer required');
  return p.slice(1).split('/').reduce((v,k)=>v?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],object);
}
export function validateVisualCapture(base,spec,source,ref){
  const raw=readJSON(verifyRef(base,ref)),contract=spec.visual_contract;
  if(!contract)throw Error('Visual capture contract required');
  if(raw.source_sha256!==source.sha256||raw.suite_id!==spec.suite_id||raw.blender_version!==contract.blender_version||raw.collector_sha256!==contract.collector_sha256)throw Error('Visual capture identity/runtime mismatch');
  const config=readJSON(verifyRef(base,raw.config));
  if(config.source_sha256!==source.sha256||config.suite_id!==spec.suite_id||config.blender_version!==contract.blender_version||!isDeepStrictEqual(config.conditions,contract.conditions))throw Error('Visual capture conditions mismatch');
  if(!raw.effective_conditions||!Array.isArray(raw.captures)||!raw.captures.length)throw Error('Effective capture evidence required');
  if(!isDeepStrictEqual(raw.captures.map(x=>x.name),contract.conditions.views.map(x=>x.name)))throw Error('Capture views missing or reordered');
  raw.captures.forEach(x=>verifyRef(base,x.image));
  return raw;
}
export function evaluateReport(base,job,stage,reportRef,source=job.artifacts.candidate,extraChecks=[],purpose='gate'){
  const spec=loadSpec(base,job);
  if(spec.status!=='active')throw Error('Quality spec is draft');
  predecessors(stage,spec);
  verifyRef(base,source);
  const report=readJSON(verifyRef(base,reportRef));
  if(report.schema_version!==2||report.stage!==stage||report.job_id!==job.job_id||report.source_sha256!==source.sha256||report.quality_spec_sha256!==job.quality_spec.sha256||report.suite_id!==spec.suite_id)throw Error('Report identity/spec/test suite mismatch');
  checkAnimationReport(base,job,spec,stage,report,source,purpose);
  if(!Array.isArray(report.checks)||new Set(report.checks.map(c=>c.name)).size!==report.checks.length)throw Error('Checks missing/duplicated');
  const required=[...new Set([...spec.gates[stage],...extraChecks])];
  if(required.some(n=>!spec.criteria[n]))throw Error('Unknown operation criterion');
  // Known supplemental checks may travel with a report across gate evaluation.
  // Only the gate/operation's required set controls this evaluation.
  if(report.checks.some(c=>!Object.hasOwn(spec.criteria,c.name)))throw Error('Unknown check in report');
  const results=required.map(name=>{
    const rule=spec.criteria[name], check=report.checks.find(c=>c.name===name);
    if(rule.applicable===false)return {name,status:'not_applicable',reason:rule.exception_reason};
    if(!check)return {name,status:'unknown',reason:'Required check omitted'};
    if(check.status==='not_applicable')return {name,status:'fail',reason:'Exception not frozen in quality spec'};
    if(!Array.isArray(check.evidence)||!check.evidence.length)return {name,status:'unknown',reason:'Evidence missing'};
    check.evidence.forEach(ref=>verifyRef(base,ref));
    if(rule.kind==='metric'){
      if(!check.measurement)return {name,status:'unknown',reason:'Measurement missing'};
      const raw=readJSON(verifyRef(base,check.measurement.file));
      if(raw.source_sha256!==source.sha256||raw.suite_id!==spec.suite_id||raw.units?.[name]!==rule.unit)throw Error(`Measurement identity/suite/unit mismatch: ${name}`);
      if(spec.measurement_contract){
        verifyMeasurementContract(base,spec.measurement_contract,raw,source.sha256);
      }
      const value=pointer(raw,check.measurement.pointer);
      if(!Number.isFinite(value))throw Error(`Finite measurement required: ${name}`);
      if(rule.limit===null)return {name,status:'unknown',value,reason:'Asset-specific limit unresolved'};
      const pass=rule.operator==='lte'?value<=rule.limit:rule.operator==='gte'?value>=rule.limit:value===rule.limit;
      return {name,status:pass?'pass':'fail',value,limit:rule.limit,operator:rule.operator,unit:rule.unit};
    }
    if(!['pass','fail','unknown','not_performed'].includes(check.status))throw Error(`Invalid check status: ${name}`);
    let capture;
    if(rule.kind==='visual'&&(spec.visual_contract||spec.evidence_policy?.visual_required)&&['pass','fail'].includes(check.status)){
      if(!check.visual_capture)return {name,status:'unknown',reason:'Visual capture missing'};
      capture=validateVisualCapture(base,spec,source,check.visual_capture);
    }
    requireText(check.observation,`Observation ${name}`);
    return {name,status:check.status,reason:check.observation,kind:rule.kind,...(capture?{capture_conditions:capture.effective_conditions,capture_images:capture.captures.map(x=>x.image)}:{})};
  });
  if(stage==='engine'){
    const target=job.requirements.engine;
    if(!target?.project||!target?.version||report.engine?.project!==target.project||report.engine?.version!==target.version||report.engine?.name!==target.name)throw Error('Engine target identity mismatch');
    if(!report.imported_files?.length)throw Error('Engine imported files required');
    report.imported_files.forEach(ref=>verifyRef(base,ref));
    const exported=currentExport(base,job);
    if(report.export_iteration_id!==exported.id||!sameFiles(report.imported_files,exported.files))throw Error('Engine files differ from current verified export');
  }
  if(stage==='final'){
    if(!Array.isArray(report.deliverables)||!report.deliverables.length)results.push({name:'deliverable_files',status:'unknown',reason:'Final files missing'});
    else report.deliverables.forEach(ref=>verifyRef(base,ref));
    if(purpose!=='export_roundtrip'&&(spec.engine_required||job.local_revisions.records.some(r=>r.operation==='export'&&r.baseline?.sha256===source.sha256))){
      const exported=currentExport(base,job);
      if(report.export_iteration_id!==exported.id||!sameFiles(report.deliverables,exported.files))throw Error('Final files differ from current verified export');
    }
    if(spec.engine_required&&job.gates.engine?.report){
      const engine=job.gates.engine;
      const imported=readJSON(verifyRef(base,engine.report)).imported_files;
      const exported=currentExport(base,job);
      if(report.export_iteration_id!==exported.id||!sameFiles(imported,exported.files)||!sameFiles(report.deliverables,imported))throw Error('Final files differ from engine-tested files');
    }
  }
  return {action:results.every(c=>['pass','not_applicable'].includes(c.status))?(job.review_mode==='guided'||stage==='final'?'user_review':'ai_review'):'blocked',checks:results,report:reportRef,evidence_level:spec.evidence_policy?.measurement_required&&spec.evidence_policy?.visual_required?'contract_bound':'legacy_or_partial'};
}
export function assertAccepted(base,job,stage,seen=new Set(),independent=false){
  if(seen.has(stage))return;
  const spec=loadSpec(base,job);
  if(!independent)for(const prior of predecessors(stage,spec))assertAccepted(base,job,prior,seen);
  const gate=job.gates[stage];
  if(gate?.status!=='accepted')throw Error(`Prerequisite not accepted: ${stage}`);
  if(gate.reuse&&['engine','final'].includes(stage))throw Error('Delivery acceptance cannot be inherited');
  const source=gate.reuse?verifyReuseChain(base,job,spec,stage,gate.reuse):job.artifacts.candidate;
  const original={...job,artifacts:{...job.artifacts,candidate:source}};
  const result=evaluateReport(base,original,stage,gate.report);
  if(result.action==='blocked')throw Error(`Accepted evidence no longer valid: ${stage}`);
  const decision=readJSON(verifyRef(base,gate.decision));
  validateDecision(original,stage,gate.report,result.action,decision);
  if(decision.decision!=='accepted')throw Error('Stored decision did not accept this gate');
  seen.add(stage);
}
export function validateDecision(job,stage,report,action,decision){
  const expected=action==='user_review'?'user':'ai';
  if(!['accepted','rejected'].includes(decision.decision)||!(decision.reviewer===expected||(job.interaction_policy?.mode==='concise'&&expected==='ai'&&decision.reviewer==='user'))||decision.stage!==stage||decision.job_id!==job.job_id||decision.source_sha256!==job.artifacts.candidate.sha256||decision.quality_spec_sha256!==job.quality_spec.sha256||decision.report_sha256!==report.sha256)throw Error('Reviewer/decision identity mismatch');
  requireText(decision.evidence,'Actual reviewer evidence');
  if(action==='blocked'&&decision.decision==='accepted')throw Error('Technical failure cannot be accepted');
}
export function compareReports(base,job,stage,baseline,candidate,before,after,options={}){
  const extra=[...(options.success_checks||[]),...(options.protected_checks||[])];
  if(options.comparison_scope==='local'&&(options.mode==='create'||!extra.length))throw Error('Local comparison requires repair checks');
  if(options.comparison_scope&&!['local','gate'].includes(options.comparison_scope))throw Error('Unknown comparison scope');
  const purpose=options.comparison_scope==='local'?'local_comparison':'gate';
  const a=evaluateReport(base,job,stage,before,baseline,extra,purpose), b=evaluateReport(base,job,stage,after,candidate,extra,purpose);
  const spec=loadSpec(base,job);let improved=false;
  for(let i=0;i<a.checks.length;i++){
    const x=a.checks[i],y=b.checks[i],rule=spec.criteria[x.name];
    if(!rule)return false;
    // Local progress may leave unrelated baseline unknowns unresolved; never lose known evidence.
    if(purpose==='local_comparison'&&!extra.includes(x.name)&&['unknown','not_performed'].includes(x.status))continue;
    if(options.mode==='create'&&!options.protected_checks?.includes(x.name)){
      if(!['pass','not_applicable'].includes(y.status))return false;
      continue;
    }
    if(x.status==='unknown'||y.status==='unknown'||x.status==='not_performed'||y.status==='not_performed')return false;
    if(rule.kind==='visual'&&!isDeepStrictEqual(x.capture_conditions,y.capture_conditions))throw Error('Effective visual conditions changed');
    if(rule.kind==='metric'&&rule.applicable!==false){
      const score=v=>rule.operator==='lte'?-v:rule.operator==='gte'?v:-Math.abs(v-rule.limit);
      // Comparison tolerances never relax the absolute acceptance threshold.
      if(x.status==='pass'&&y.status==='fail')return false;
      const cfg=rule.comparison||{};
      const tolerance=Math.max(cfg.absolute??1e-9,(cfg.relative??1e-9)*Math.max(Math.abs(x.value),Math.abs(y.value)),32*Number.EPSILON*Math.max(1,Math.abs(x.value),Math.abs(y.value)));
      const delta=score(y.value)-score(x.value);
      if(delta < -tolerance)return false;
      if(delta>Math.max(tolerance,cfg.minimum_improvement||0)&&(!options.success_checks||options.success_checks.includes(x.name)))improved=true;
    }else{
      if(x.status==='pass'&&y.status!=='pass')return false;
      if(x.status==='fail'&&y.status==='pass'&&(!options.success_checks||options.success_checks.includes(x.name)))improved=true;
    }
  }
  if(options.mode==='create')return b.action!=='blocked';
  if(!improved&&options.comparison){
    const c=readJSON(verifyRef(base,options.comparison));
    if(c.before_report_sha256!==before.sha256||c.after_report_sha256!==after.sha256||c.source_sha256!==baseline.sha256||c.candidate_sha256!==candidate.sha256||c.quality_spec_sha256!==job.quality_spec.sha256)throw Error('Comparison identity mismatch');
    if(c.reviewer!==(job.review_mode==='guided'?'user':'ai'))throw Error('Comparison reviewer mismatch');
    requireText(c.observation,'Comparison observation');
    if(!c.evidence?.length)throw Error('Comparison evidence required');
    c.evidence.forEach(ref=>verifyRef(base,ref));
    const targets=options.success_checks||a.checks.map(x=>x.name);
    if(!Array.isArray(c.checks)||!c.checks.length||new Set(c.checks.map(x=>x.name)).size!==c.checks.length)throw Error('Per-criterion visual comparison required');
    for(const item of c.checks){
      if(!targets.includes(item.name)||spec.criteria[item.name]?.kind!=='visual'||spec.criteria[item.name].applicable===false)throw Error('Comparison must target an applicable visual success check');
      requireText(item.observation,'Visual criterion observation');
      if(!item.evidence?.length)throw Error('Visual criterion evidence required');
      item.evidence.forEach(ref=>verifyRef(base,ref));
      if(spec.visual_contract){
        const images=[...a.checks.find(x=>x.name===item.name).capture_images,...b.checks.find(x=>x.name===item.name).capture_images];
        if(images.some(ref=>!item.evidence.some(e=>e.path===ref.path&&e.sha256===ref.sha256)))throw Error('Visual comparison must cite frozen before/after captures');
      }
      if(item.decision!=='improved')throw Error('Visual comparison must demonstrate improvement');
      if(!a.checks.some(x=>x.name===item.name&&x.status==='pass')||!b.checks.some(x=>x.name===item.name&&x.status==='pass'))throw Error('Visual comparison requires passing before/after checks');
    }
    improved=c.decision==='improved';
  }
  return improved;
}
