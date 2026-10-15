// One-shot isolated execution. Resume reconciles existing files; it never launches.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {startWork,finishWork} from './work.mjs';
import {readProduction,persist} from './production.mjs';
import {recoverExecution,reconcileExecution} from './execution.mjs';
import {localFile,readJSON,fileRef,atomicJSON} from './production-io.mjs';

export function resumeLocal(base,resultPath){
  const job=readProduction(base),round=job.local_revisions.records.find(r=>r.status==='started');
  if(!round)return {action:'nothing_to_resume'};
  if(!round.execution){
    const orphan=localFile(base,`work/executions/${round.id}/request.json`);
    if(!fs.existsSync(orphan))return {action:'reconcile_local',iteration_id:round.id,reason:'No dispatch record; inspect existing iteration, never replay start'};
    recoverExecution(base,job);persist(base,job,{type:'execution_recovered',iteration_id:round.id});
  }
  if(round.execution.state==='aborted')return {action:'finish_aborted',iteration_id:round.id};
  if(!fs.existsSync(localFile(base,round.execution.receipt_path)))return {action:'reconcile_local',iteration_id:round.id,reason:'Receipt absent; inspect process/output. No automatic launch or replay.'};
  const receipt=reconcileExecution(base,job);persist(base,job,{type:'execution_reconciled',...receipt});
  const folder=`work/executions/${round.id}`;
  const technical={schema_version:1,job_id:job.job_id,iteration_id:round.id,source:round.baseline,quality_spec:round.quality_spec,
    receipt:round.execution.receipt,state:receipt.state,quality:'not_evaluated',
    inventory:readJSON(localFile(base,round.execution.receipt_path)).inventory||null};
  if(receipt.state==='completed')technical.output=fileRef(base,round.output_path);
  // A versioned collection avoids overwriting previously referenced evidence.
  const reportPath=`${folder}/technical-${job.revision}.json`;
  atomicJSON(localFile(base,reportPath),technical);
  const evidence=[round.execution.receipt,fileRef(base,reportPath)];
  if(receipt.state==='failed')return {action:'execution_failed',result:finishWork(base,{status:'failed',summary:'Verified worker failure; see execution receipt',evidence})};
  if(!resultPath)return {action:'awaiting_quality_result',iteration_id:round.id,technical_report:reportPath,next:'Provide actual quality result to resume --result FILE; Blender will not run again'};
  const request=readJSON(localFile(base,resultPath));
  return {action:'finished',result:finishWork(base,{...request,evidence:[...(request.evidence||[]),...evidence]})};
}
export function runLocal(base,request,{blender,resultPath,timeoutMs=300000}={}){
  if(typeof blender!=='string'||!blender.trim())throw Error('Explicit Blender executable required');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)throw Error('Invalid timeout');
  if(resultPath)localFile(base,resultPath);
  if(readProduction(base).local_revisions.records.some(r=>r.status==='started'))throw Error('Existing iteration: use resume; do not launch again');
  const probe=spawnSync(blender,['--version'],{encoding:'utf8',timeout:10000,windowsHide:true});
  if(probe.error||probe.status!==0||!/Blender\s+\d/.test(probe.stdout||''))throw Error('Blender preflight failed; no iteration started');
  const dispatch=startWork(base,request),folder=`work/executions/${dispatch.iteration_id}`;
  const log=localFile(base,`${folder}/process.log`),fd=fs.openSync(log,'wx');
  let processResult;
  try{processResult=spawnSync(blender,dispatch.native_arguments,{stdio:['ignore',fd,fd],timeout:timeoutMs,windowsHide:true});}
  finally{fs.closeSync(fd);}
  atomicJSON(localFile(base,`${folder}/process.json`),{schema_version:1,iteration_id:dispatch.iteration_id,pid:processResult.pid??null,exit_code:processResult.status,signal:processResult.signal,error:processResult.error?.message??null,log:fileRef(base,`${folder}/process.log`)});
  // A timeout, exit code or successful spawn is never proof of the mutation.
  return resumeLocal(base,resultPath);
}
export function main(args){
  const [command,id,...rest]=args;
  if(!command||['help','--help','-h'].includes(command))return {usage:['run-local.mjs run ASSET REQUEST.json --blender PATH [--result FILE] [--timeout-ms N]','run-local.mjs resume ASSET [--result FILE]'],note:'resume never launches Blender; required quality evidence is not synthesized'};
  if(!['run','resume'].includes(command)||!/^[a-z0-9-]+$/.test(id||''))throw Error('Invalid command/asset');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base=path.join(root,'assets',id);
  const get=name=>rest.includes(name)?rest[rest.indexOf(name)+1]:undefined;
  const lock=path.join(base,'.workflow.lock'),fd=fs.openSync(lock,'wx');
  try{return command==='resume'?resumeLocal(base,get('--result')):runLocal(base,readJSON(localFile(base,rest[0])),{blender:get('--blender'),resultPath:get('--result'),timeoutMs:get('--timeout-ms')?Number(get('--timeout-ms')):undefined});}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=main(process.argv.slice(2));console.log(JSON.stringify(result,null,2));if(['execution_failed','reconcile_local'].includes(result.action))process.exitCode=1;}
  catch(e){console.error(e.message);process.exitCode=1;}
}
