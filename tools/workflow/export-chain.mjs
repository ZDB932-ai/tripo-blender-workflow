import {readJSON,verifyRef} from './production-io.mjs';

export const sameFile=(a,b)=>a?.path===b?.path&&a?.sha256===b?.sha256;
export function sameFiles(a,b){
  return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&
    new Set(a.map(f=>f.path)).size===a.length&&a.every(f=>b.some(g=>sameFile(f,g)));
}
// A later attempt supersedes an earlier export even when the later attempt failed.
// Do not fall back silently to an old successful record.
export function currentExport(base,job){
  const round=job.local_revisions.records.findLast(r=>r.operation==='export'&&
    sameFile(r.baseline,job.artifacts.candidate)&&sameFile(r.quality_spec,job.quality_spec));
  if(!round||round.status!=='completed'||round.outcome!=='export_verified')throw Error('Current verified export required');
  verifyRef(base,round.baseline);verifyRef(base,round.quality_spec);
  const result=readJSON(verifyRef(base,round.result));
  if(result.job_id!==job.job_id||result.iteration_id!==round.id||result.status!=='completed'||!sameFile(result.candidate,round.output))throw Error('Export result identity mismatch');
  verifyRef(base,round.output);
  const report=readJSON(verifyRef(base,result.candidate_report));
  if(report.job_id!==job.job_id||report.stage!=='final'||report.source_sha256!==round.baseline.sha256||report.quality_spec_sha256!==job.quality_spec.sha256)throw Error('Export report identity mismatch');
  if(!report.deliverables?.length||!report.deliverables.some(f=>sameFile(f,round.output))||!sameFiles(report.deliverables,report.deliverables))throw Error('Export manifest invalid');
  report.deliverables.forEach(f=>verifyRef(base,f));
  return {id:round.id,files:report.deliverables};
}
