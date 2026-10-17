import fs from 'node:fs';
import path from 'node:path';
import {readJSON,verifyRef,requireText} from './production-io.mjs';

export const unresolvedRemote=['submitting','submission_unknown','processing'];
export const pendingRemote=[...unresolvedRemote,'planned','studio_result_ready','qa_review','ready_for_transfer','diagnostic_transfer','exporting','export_failed','downloaded'];
export function validateContinuation(base,request){
  if(request.reviewer!=='user'||request.decision!=='continue_with_replacement'||request.budget_release!==false)throw Error('Explicit user continuation required; budget must remain reserved');
  requireText(request.authorization,'Actual user authorization');
  for(const id of [request.unknown_run_id,request.replacement_run_id])if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Invalid continuation run');
  if(request.unknown_run_id===request.replacement_run_id)throw Error('Replacement must differ');
  for(const [key,expected] of [['unknown_state',`runs/${request.unknown_run_id}/state.json`],['unknown_plan',`runs/${request.unknown_run_id}/plan.json`],['replacement_plan',`runs/${request.replacement_run_id}/plan.json`]]){
    if(request[key]?.path!==expected)throw Error('Continuation identity mismatch');verifyRef(base,request[key]);
  }
  if(readJSON(verifyRef(base,request.unknown_state)).status!=='submission_unknown')throw Error('Only unknown submission may be retained');
  const replacement=readJSON(path.join(base,'runs',request.replacement_run_id,'state.json'));
  if(!['studio_result_ready','qa_review','ready_for_transfer','diagnostic_transfer','exporting','downloaded','accepted'].includes(replacement.status))throw Error('Replacement result not ready');
  const evidence=readJSON(verifyRef(base,request.replacement_evidence));
  if(evidence.run_id!==request.replacement_run_id||evidence.plan_sha256!==request.replacement_plan.sha256)throw Error('Replacement evidence identity mismatch');
  requireText(evidence.source_identity,'Confirmed remote identity');
  if(!evidence.evidence?.length)throw Error('Replacement evidence missing');evidence.evidence.forEach(ref=>verifyRef(base,ref));
  return request;
}
export function continuedUnknown(base,job,run){
  if(run.status!=='submission_unknown')return false;
  const ref=job.remote_continuations?.[run.id];if(!ref)return false;
  try{return validateContinuation(base,readJSON(verifyRef(base,ref))).unknown_run_id===run.id;}catch{return false;}
}
export function remoteRuns(base){
  const folder=path.join(base,'runs');
  if(!fs.existsSync(folder))return [];
  return fs.readdirSync(folder,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>({id:d.name,...readJSON(path.join(folder,d.name,'state.json'))}));
}
export function remoteChoice(base,job,runs){
  const decisions=job.remote_dispositions||{};
  const pending=runs.filter(r=>!(job.interaction_policy?.mode==='concise'&&job.artifacts.candidate&&r.status==='planned')&&pendingRemote.includes(r.status)&&r.id!==job.source_run_id&&decisions[r.id]?.status!=='deferred'&&!continuedUnknown(base,job,r));
  const selected=job.active_remote_run;
  if(selected){
    const run=runs.find(r=>r.id===selected.run_id);
    if(!run)return {action:'repair_records',skill:'tripo-studio-pipeline',blocked_by:['active_remote_run_missing']};
    if(selected.source_sha256!==(job.artifacts.candidate?.sha256||null))return {action:'resolve_remote_source',skill:'tripo-studio-pipeline',run:run.id,blocked_by:['candidate_changed_since_remote_selection']};
    if(pendingRemote.includes(run.status))return routeRun(base,run);
    return {action:'resolve_remote_result',skill:'tripo-studio-pipeline',run:run.id,remote_status:run.status,blocked_by:['remote_task_finished_without_attachment']};
  }
  if(!pending.length)return null;
  if(job.artifacts.candidate||pending.length>1)return {action:'select_source_run',skill:'tripo-studio-pipeline',runs:pending,blocked_by:['remote_selection_required'],options:['select-remote','defer-remote']};
  return routeRun(base,pending[0]);
}
export function routeRun(base,run){
  let skill=['studio_result_ready','qa_review'].includes(run.status)?'tripo-studio-refine':run.status==='planned'?'tripo-studio-preflight':'tripo-studio-deliver';
  if(['ready_for_transfer','diagnostic_transfer'].includes(run.status))validateTransferReview(base,run.id,run);
  return {action:run.status,skill,run:run.id,blocked_by:[]};
}
export function validateTransferReview(base,runId,state){
  const report=readJSON(verifyRef(base,state.transfer_review));
  if(report.run_id!==runId||report.disposition!==(state.transfer_disposition||state.status)||!['ready_for_transfer','diagnostic_transfer'].includes(report.disposition)||report.plan_sha256!==state.transfer_plan_sha256)throw Error('Transfer review identity mismatch');
  const plan=path.join(base,'runs',runId,'plan.json');
  // plan identity must still be current, not merely agree with the state.
  verifyRef(base,{path:path.relative(base,plan),sha256:report.plan_sha256});
  for(const key of ['source_identity','observation','reason'])requireText(report[key],'Transfer review '+key);
  if(!report.evidence?.length)throw Error('Transfer review evidence required');
  report.evidence.forEach(ref=>verifyRef(base,ref));
  return report;
}
