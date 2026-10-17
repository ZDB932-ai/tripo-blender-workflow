// Small operator-facing facade. Production/execution remain the sole state writers.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readProduction,inspectNext,beginIteration,finishIteration,persist,setIterationPolicy,simplifyWorkflow} from './production.mjs';
import {prepareExecution,reconcileExecution} from './execution.mjs';
import {fileRef,readJSON,localFile} from './production-io.mjs';
import {loadSpec} from './quality.mjs';
import {requiredDomains} from './review-reuse.mjs';
import {repairRouting} from './iteration-routing.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const asRef=(base,value)=>typeof value==='string'?fileRef(base,value):value;
function saveRequest(base,name,value){
  const p=localFile(base,'work/requests/'+name);fs.mkdirSync(path.dirname(p),{recursive:true});
  fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return fileRef(base,path.relative(base,p));
}
export function taskSummary(base){
  const job=readProduction(base),next=inspectNext(base,job);
  let reuse;
  try{
    const spec=loadSpec(base,job);
    reuse={contract_configured:Boolean(spec.reuse_contract),note:'Dependency configuration is not proof of collected or unchanged attributes',gates:Object.fromEntries(Object.keys(job.gates).filter(k=>!['engine','final'].includes(k)).map(k=>[k,{required_domains:requiredDomains(spec,k),configured_domains:spec.reuse_contract?.dependencies?.[k]||[],retained:Boolean(job.gates[k].reuse)}]))};
  }catch(e){reuse={available:false,reason:e.message};}
  return {job_id:job.job_id,requirements:job.requirements,review_mode:job.review_mode,
    source:job.artifacts.candidate,display_master:job.artifacts.display_master,
    phase:next.action==='complete'?'交付完成':!job.artifacts.candidate?'需求与参考':['engine','final','export_for_engine'].includes(next.action)?'交付验收':'制作与核验',
    next,operator:operatorGuidance(base,job,next),quality_spec:job.quality_spec,iteration_policy:job.local_revisions.iteration_policy||{mode:'explicit_budget'},local_budgets:job.local_revisions.iteration_policy?.mode==='progress_guarded'?null:job.local_revisions.budgets||{total:job.local_revisions.max_started},
    attempts:job.local_revisions.records.length,repair_routing:repairRouting(job),review_reuse:reuse,
    gates:Object.fromEntries(Object.entries(job.gates).map(([k,v])=>[k,{status:v.status,reused:Boolean(v.reuse)}])),
    reading:next.skill?['docs/workflow/skill-runtime.md','skills/'+next.skill+'/SKILL.md']:[]};
}
function operatorGuidance(base,job,next){
  const id=path.basename(base),active=job.local_revisions.records.find(r=>r.status==='started');
  const hints={
    repair_records:'Repair the named record or evidence from verified sources; never fabricate a pass or delete an unknown run.',
    reference_or_existing_source:'Resolve brief/intake and approve the reference, or attach a verified existing source. See operator-guide.md.',
    configure_quality:'Configure versioned quality criteria with actual requirements; unresolved thresholds are not passes.',
    reconcile_remote:'Read the current Studio task identity and outcome; do not resubmit.',
    reconcile_transfer:'Verify the same source in Blender and transfer evidence; do not resend.',
    select_source_run:'Explicitly select or defer the intended ready run; do not assume the latest run.',
    resolve_budget:'Reuse existing authorization. If the user requested progress-based retries, use iteration-policy with that existing evidence once; never repeatedly ask for more attempts.',
    resolve_plateau:'Preserve the best candidate and report the concrete unresolved requirement and tried routes. Do not ask for more attempts or weaken quality.',
    review:'Show current evidence and record the actual reviewer decision.',
    complete:'Verified recorded delivery is complete; preserve its files and acceptance.'
  };
  let instruction=hints[next.action]||'Follow the returned skill and operation readiness; preserve required evidence and review.';
  let recovery=null;
  if(active){
    const orphan=fs.existsSync(localFile(base,`work/executions/${active.id}/request.json`));
    const receipt=active.execution?.receipt_path&&fs.existsSync(localFile(base,active.execution.receipt_path));
    recovery={iteration_id:active.id,execution_state:active.execution?.state||'not_dispatched',receipt_present:Boolean(receipt),
      command:orphan||receipt?`node tools/workflow/run-local.mjs resume ${id}`:null};
    instruction='Reconcile this existing iteration. A missing receipt is not proof it never ran; never replay start. See RECOVERY.md and PRODUCTION.md.';
  }
  const userReview=next.action==='review'&&(job.stage==='final'||job.review_mode==='guided');
  if(next.action==='review'&&!userReview)instruction='Inspect the current evidence and record an honest AI review; continue without asking for intermediate approval.';
  const responsibility=userReview?'user':next.action==='complete'?'none':'agent';
  return {responsibility,ask_user:userReview,escalation:'Ask only for missing design intent, a real access/login requirement, a scope change, or final acceptance after exhausting relevant internal recovery.',instruction,recovery,lock_present:fs.existsSync(path.join(base,'.workflow.lock')),guide:'docs/workflow/operator-guide.md'};
}
export function listTasks(projectRoot=root){
  const folder=path.join(projectRoot,'assets');
  if(!fs.existsSync(folder))return [];
  return fs.readdirSync(folder,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>{
    const base=path.join(folder,d.name);
    if(!fs.existsSync(path.join(base,'production.json')))return {asset:d.name,action:'legacy_or_uninitialized',instruction:'Inspect existing brief/runs; do not scaffold over this directory.'};
    try{const s=taskSummary(base);return {asset:d.name,phase:s.phase,status:readProduction(base).status,next:s.next,operator:s.operator};}
    catch(e){return {asset:d.name,next:{action:'repair_records',blocked_by:[e.message]}};}
  });
}
export function startWork(base,request){
  const job=readProduction(base);
  if(job.local_revisions.records.some(r=>r.status==='started'))throw Error('Unfinished work: reconcile, do not replay start');
  const next=inspectNext(base,job);
  if(['repair_records','reconcile_remote','reconcile_transfer','select_source_run'].includes(next.action))throw Error('Resolve current task first: '+next.action);
  const n=job.local_revisions.records.length+1;
  if(!request.execution?.script)throw Error('Execution script required');
  const plan={...request,job_id:job.job_id,source_sha256:job.artifacts.candidate?.sha256,quality_spec_sha256:job.quality_spec.sha256,
    execution:{...request.execution,script:asRef(base,request.execution.script)}};
  if(plan.capability)plan.capability=asRef(base,plan.capability);
  if(plan.strategy_review)plan.strategy_review=asRef(base,plan.strategy_review);
  if(plan.rig_origin)plan.rig_origin=asRef(base,plan.rig_origin);
  const ref=saveRequest(base,`start-${n}-${Date.now()}.json`,plan);
  const round=beginIteration(base,job,ref);
  // begin is already persisted. If dispatch fails, resume its state, never begin again.
  const execution=prepareExecution(base,job);persist(base,job,{type:'execution_dispatched',iteration_id:round.id});
  return {iteration_id:round.id,...execution,next:'Execute the returned native_arguments or MCP code once, then work finish. Unknown execution must be reconciled.'};
}
export function finishWork(base,request){
  const job=readProduction(base),round=job.local_revisions.records.find(r=>r.status==='started');
  if(!round)throw Error('No unfinished work');
  // Persist receipt reconciliation before validating quality. Quality failures can be corrected without replaying execution.
  if(round.execution?.state!=='aborted'){
    const receipt=reconcileExecution(base,job);persist(base,job,{type:'execution_reconciled',...receipt});
  }
  const result={...request,job_id:job.job_id,iteration_id:round.id};
  if(result.status==='completed')result.candidate=asRef(base,result.candidate||round.output_path);
  for(const key of ['baseline_report','candidate_report','comparison','regression','capability_report','reuse_proof'])if(result[key])result[key]=asRef(base,result[key]);
  if(result.evidence)result.evidence=result.evidence.map(x=>asRef(base,x));
  return finishIteration(base,job,saveRequest(base,`finish-${round.id}-${Date.now()}.json`,result));
}
export function main(args){
  const [command,id,input]=args;
  if(!command||['help','--help','-h'].includes(command))return {usage:['work.mjs list','work.mjs summary ASSET','work.mjs iteration-policy ASSET POLICY.json','work.mjs simplify ASSET POLICY.json','run-local.mjs run ASSET REQUEST.json --blender PATH [--result FILE]','run-local.mjs resume ASSET [--result FILE]','work.mjs start ASSET REQUEST.json','work.mjs finish ASSET RESULT.json'],guide:'docs/workflow/operator-guide.md'};
  if(command==='list')return listTasks();
  if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Usage: work.mjs summary|start|finish ASSET [REQUEST.json]');
  const base=path.join(root,'assets',id);
  if(command==='summary')return taskSummary(base);
  if(!['start','finish','iteration-policy','simplify'].includes(command))throw Error('Unknown work command');
  const lock=path.join(base,'.workflow.lock'),fd=fs.openSync(lock,'wx');
  try{const request=readJSON(localFile(base,input));return command==='simplify'?simplifyWorkflow(base,readProduction(base),request):command==='iteration-policy'?setIterationPolicy(base,readProduction(base),request):command==='start'?startWork(base,request):finishWork(base,request);}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}
}
