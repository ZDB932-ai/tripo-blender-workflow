import {readJSON,verifyRef,requireText} from './production-io.mjs';

// Count by defect, not strategy label. Diagnostics/export never consume a
// repair streak; a verified improvement ends it.
export function repairStreak(job,defect){
  const streak=[];
  for(const r of [...job.local_revisions.records].reverse()){
    if(r.defect_id!==defect||['diagnostic','export'].includes(r.operation)||r.status==='started')continue;
    if(r.outcome==='improved')break;
    streak.push(r);
  }
  return streak;
}
export function repairRouting(job){
  return [...new Set(job.local_revisions.records.map(r=>r.defect_id).filter(Boolean))].flatMap(defect=>{
    const streak=repairStreak(job,defect);
    return streak.length>=job.local_revisions.stop_after_no_improvement?[{defect_id:defect,attempts:streak.map(r=>r.id),action:'diagnose_or_change_approach',required:'strategy_review with current source/spec, prior attempts, root cause, changed approach and evidence; no automatic retry'}]:[];
  });
}
export function validateStrategyReview(base,job,plan){
  if(['diagnostic','export'].includes(plan.operation))return;
  const streak=repairStreak(job,plan.defect_id);
  if(streak.length<job.local_revisions.stop_after_no_improvement)return;
  if(!plan.strategy_review)throw Error('Repeated defect without improvement: strategy_review required before another repair');
  const review=readJSON(verifyRef(base,plan.strategy_review));
  if(review.job_id!==job.job_id||review.defect_id!==plan.defect_id||review.source_sha256!==plan.source_sha256||review.quality_spec_sha256!==plan.quality_spec_sha256)throw Error('Strategy review identity mismatch');
  const ids=streak.map(r=>r.id);
  if(!Array.isArray(review.previous_attempts)||review.previous_attempts.length!==ids.length||new Set(review.previous_attempts).size!==ids.length||ids.some(id=>!review.previous_attempts.includes(id)))throw Error('Strategy review must cover the current failed attempts');
  for(const key of ['root_cause','changed_approach','expected_improvement'])requireText(review[key],'Strategy review '+key);
  if(review.strategy_id!==plan.strategy_id||review.hypothesis!==plan.hypothesis)throw Error('Strategy review does not describe this plan');
  if(!Array.isArray(review.evidence)||!review.evidence.length)throw Error('Strategy diagnosis evidence required');
  review.evidence.forEach(ref=>verifyRef(base,ref));
  for(const r of streak){
    const prior=readJSON(verifyRef(base,r.plan));
    if(prior.hypothesis?.trim()===plan.hypothesis.trim())throw Error('Renamed strategy repeats the same hypothesis');
    if(prior.execution?.script?.sha256&&prior.execution.script.sha256===plan.execution?.script?.sha256)throw Error('Renamed strategy repeats the same script');
  }
}
