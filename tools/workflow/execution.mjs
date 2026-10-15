import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readJSON,verifyRef,localFile,fileRef,sha256,atomicJSON,requireText} from './production-io.mjs';

const worker=fileURLToPath(new URL('./blender-execution.py',import.meta.url));
export function validateExecutionPlan(base,plan,required){
  if(!plan.execution){if(required)throw Error('Execution script required for new production');return;}
  verifyRef(base,plan.execution.script);
  if(!plan.execution.script.path.endsWith('.py'))throw Error('Python execution script required');
  if(plan.execution.blender_version!==undefined)requireText(plan.execution.blender_version,'Blender version');
}
export function prepareExecution(base,job){
  const round=job.local_revisions.records.find(r=>r.status==='started');
  if(!round)throw Error('Begin an iteration first');
  if(round.execution)throw Error('Execution already dispatched; reconcile, do not replay');
  const plan=readJSON(verifyRef(base,round.plan));validateExecutionPlan(base,plan,true);
  const source=verifyRef(base,round.baseline),script=verifyRef(base,plan.execution.script);
  const output=localFile(base,round.output_path);
  if(fs.existsSync(output))throw Error('Reserved output already exists');
  // Resolve a missing output's nearest existing parent, including symlinks.
  let parent=path.dirname(output);while(!fs.existsSync(parent))parent=path.dirname(parent);
  if(parent!==path.resolve(base))localFile(base,path.relative(base,parent));
  const directory=`work/executions/${round.id}`;
  const folder=localFile(base,directory);fs.mkdirSync(folder,{recursive:true});
  const requestPath=`${directory}/request.json`,receiptPath=`${directory}/receipt.json`;
  if(fs.existsSync(localFile(base,requestPath)))throw Error('Existing dispatch files require reconciliation');
  const request={schema_version:1,job_id:job.job_id,iteration_id:round.id,nonce:crypto.randomUUID(),
    source,source_sha256:round.baseline.sha256,script,script_sha256:plan.execution.script.sha256,
    worker,worker_sha256:sha256(worker),output,receipt:localFile(base,receiptPath),
    blender_version:plan.execution.blender_version||null};
  atomicJSON(localFile(base,requestPath),request);
  round.execution={state:'execution_unknown',request:fileRef(base,requestPath),receipt_path:receiptPath,dispatched_at:new Date().toISOString()};
  const absolute=localFile(base,requestPath);
  const code=`import pathlib, hashlib, runpy\np = pathlib.Path(${JSON.stringify(worker)})\nassert hashlib.sha256(p.read_bytes()).hexdigest() == ${JSON.stringify(request.worker_sha256)}, 'Worker changed'\nrunpy.run_path(str(p))['run'](${JSON.stringify(absolute)})`;
  return {iteration_id:round.id,state:round.execution.state,request:absolute,code,
    native_arguments:['--background','--factory-startup',source,'--python-exit-code','1','--python',worker,'--',absolute]};
}
function verifiedReceipt(base,job,round){
  const execution=round.execution;
  const req=readJSON(verifyRef(base,execution.request));
  verifyRef(base,round.baseline);
  const plan=readJSON(verifyRef(base,round.plan));validateExecutionPlan(base,plan,true);
  const ref=fileRef(base,execution.receipt_path),receipt=readJSON(verifyRef(base,ref));
  if(receipt.request_sha256!==execution.request.sha256||receipt.nonce!==req.nonce||receipt.job_id!==job.job_id||receipt.iteration_id!==round.id||receipt.source_sha256!==round.baseline.sha256||receipt.script_sha256!==plan.execution.script.sha256)throw Error('Execution receipt identity mismatch');
  if(!['completed','failed'].includes(receipt.status))throw Error('Unknown receipt status');
  if(!Number.isInteger(receipt.pid)||receipt.pid<=0)throw Error('Execution process identity required');
  requireText(receipt.blender_version,'Actual Blender version');
  if(req.blender_version&&req.blender_version!==receipt.blender_version)throw Error('Execution Blender version mismatch');
  if(receipt.status==='completed'){
    const output=fileRef(base,round.output_path);
    if(path.resolve(receipt.output)!==localFile(base,round.output_path)||receipt.output_sha256!==output.sha256)throw Error('Execution output mismatch');
  }else requireText(receipt.error,'Execution failure detail');
  return {ref,receipt};
}
export function reconcileExecution(base,job){
  const round=job.local_revisions.records.find(r=>r.status==='started');
  if(!round?.execution)throw Error('No dispatched execution');
  if(round.execution.state==='aborted')throw Error('Execution already manually resolved');
  const {ref,receipt}=verifiedReceipt(base,job,round);
  round.execution={...round.execution,state:receipt.status,receipt:ref,reconciled_at:new Date().toISOString()};
  return {iteration_id:round.id,state:receipt.status};
}
export function recoverExecution(base,job){
  const round=job.local_revisions.records.find(r=>r.status==='started');
  if(!round||round.execution)throw Error('Recovery requires an unfinished iteration without dispatch state');
  const requestPath=`work/executions/${round.id}/request.json`;
  const ref=fileRef(base,requestPath),req=readJSON(verifyRef(base,ref));
  const plan=readJSON(verifyRef(base,round.plan));validateExecutionPlan(base,plan,true);
  const receiptPath=`work/executions/${round.id}/receipt.json`;
  if(req.job_id!==job.job_id||req.iteration_id!==round.id||req.source_sha256!==round.baseline.sha256||req.script_sha256!==plan.execution.script.sha256||path.resolve(req.source)!==verifyRef(base,round.baseline)||path.resolve(req.output)!==localFile(base,round.output_path)||path.resolve(req.receipt)!==localFile(base,receiptPath))throw Error('Orphan dispatch identity mismatch');
  round.execution={state:'execution_unknown',request:ref,receipt_path:receiptPath,recovered_at:new Date().toISOString()};
  return {iteration_id:round.id,state:'execution_unknown',action:'reconcile_receipt_or_confirm_process_stopped'};
}
export function abortExecution(base,job,recordRef){
  const round=job.local_revisions.records.find(r=>r.status==='started');
  if(round?.execution?.state!=='execution_unknown')throw Error('Only unknown execution can be manually reconciled');
  const record=readJSON(verifyRef(base,recordRef));
  if(record.iteration_id!==round.id||record.confirmed_process_stopped!==true||!record.evidence?.length)throw Error('Stopped-process evidence required');
  requireText(record.reason,'Reconciliation reason');record.evidence.forEach(r=>verifyRef(base,r));
  round.execution={...round.execution,state:'aborted',resolution:recordRef};
  return {iteration_id:round.id,state:'aborted'};
}
export function assertExecutionFinished(base,job,round,result){
  const plan=readJSON(verifyRef(base,round.plan));
  if(round.adopted_diagnostic_id){
    const trial=job.local_revisions.records.find(r=>r.id===round.adopted_diagnostic_id);
    if(trial?.operation!=='diagnostic'||trial.adopted_diagnostic_id||trial.status!=='completed'||!trial.receipt_required||trial.baseline.sha256!==round.baseline.sha256||trial.quality_spec.sha256!==round.quality_spec.sha256)throw Error('Invalid reused diagnostic execution');
    const original=readJSON(verifyRef(base,trial.result)),originalPlan=readJSON(verifyRef(base,trial.plan));
    if(result.candidate?.sha256!==trial.output?.sha256||result.candidate?.path!==trial.output?.path||plan.execution?.script?.sha256!==originalPlan.execution?.script?.sha256)throw Error('Reused execution output/script mismatch');
    assertExecutionFinished(base,job,trial,original);return;
  }
  if(!round.receipt_required&&!plan.execution&&!round.execution)return; // Unchanged historical records only.
  const state=round.execution?.state;
  if(!state||state==='execution_unknown')throw Error('Reconcile execution receipt before finish');
  if(result.status==='completed'&&state!=='completed')throw Error('Execution did not complete');
  if(state==='aborted'){verifyRef(base,round.execution.resolution);return;}
  const {ref}=verifiedReceipt(base,job,round);
  if(ref.sha256!==round.execution.receipt?.sha256)throw Error('Execution receipt changed after reconciliation');
}

// MCP envelopes may report isError=false while their text contains a failure.
// This helper never treats a transport response as proof of a completed edit.
export function classifyToolResponse(response){
  const body=JSON.stringify(response);
  return {state:'execution_unknown',transport_error:Boolean(response?.isError)||/could not connect|error executing|error getting|traceback|timed?\s*out/i.test(body),requires_receipt:true};
}
