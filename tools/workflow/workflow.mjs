import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {checkAssetScope,creditApproval} from './policy.mjs';
import {verifyRef,requireText,localFile} from './production-io.mjs';
import {validateTransferReview} from './remote-routing.mjs';
import {checkIntakeReference,checkSubmissionReadiness} from './submission-readiness.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function write(file, data) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data,null,2)+'\n', {flag:'wx'});
  fs.renameSync(tmp,file);
}
function local(base, relative) {
  return localFile(base,relative);
}
export function checkReference(base, ref) {
  if(ref.kind==='text'){
    verifyRef(base,ref.prompt);
    if(ref.decision?.status!=='approved'||!ref.decision?.evidence)throw Error('Reference not approved');
    return;
  }
  if (!ref.files?.length) throw Error('Reference has no files');
  for (const f of ref.files) if(hash(local(base,f.path))!==f.sha256) throw Error('Reference changed: '+f.path);
  if(ref.decision?.status!=='approved'||!ref.decision?.evidence) throw Error('Reference not approved');
}
export function checkPlan(base, plan, approval) {
  checkReference(base, read(local(base,plan.reference_manifest)));
  if (hash(local(base,plan.reference_manifest))!==plan.reference_manifest_sha256) throw Error('Reference manifest changed');
  if(plan.backend!=='tripo_studio_browser'||plan.billing_source!=='studio') throw Error('Wrong billing backend');
  if(plan.candidate_count!==1) throw Error('Only one candidate per run');
  if(!Number.isFinite(plan.quoted_credits)||plan.quoted_credits<0) throw Error('Missing quote');
  if(!approval||approval.status!=='approved'||!approval.evidence) throw Error('Production approval missing');
  if(!Number.isFinite(approval.max_credits)||approval.max_credits<plan.quoted_credits) throw Error('Budget exceeded');
  if(!plan.observed_at||Date.now()-Date.parse(plan.observed_at)>30*60*1000||!Number.isFinite(Date.parse(plan.observed_at))||Date.parse(plan.observed_at)>Date.now()+60000) throw Error('Refresh UI quote');
  if (!plan.ui_evidence || !fs.existsSync(local(base,plan.ui_evidence))) throw Error('UI evidence missing');
  if(plan.input){
    checkInput(base,plan.input);
  }else if(plan.source_file||plan.operation&&!['generate','单图生成模型'].includes(plan.operation)){
    if(!plan.source_run_id||!plan.source_asset_url||!Object.hasOwn(plan,'source_version'))throw Error('Postprocessing source identity missing');
    if(!/^[a-f0-9]{64}$/.test(plan.source_sha256||''))throw Error('Postprocessing source hash missing');
    if(hash(local(base,plan.source_file))!==plan.source_sha256)throw Error('Postprocessing source changed');
  }
}
export function checkInput(base,input){
  if(input.kind==='local_file'){
    verifyRef(base,input.file);requireText(input.format,'Input format');
  }else if(input.kind==='studio_asset'){
    requireText(input.asset_url,'Studio asset URL');requireText(input.version,'Studio source version');
    verifyRef(base,input.evidence);
  }else if(input.kind==='bridge_receipt'){
    verifyRef(base,input.receipt);verifyRef(base,input.file);
  }else throw Error('Unsupported source input type');
}
export function reconcileSubmission(base,state,record){
  if(!['submitting','submission_unknown','processing'].includes(state))throw Error('Run does not need submission reconciliation');
  if(!['failed','cancelled','not_created','processing','studio_result_ready'].includes(record.outcome))throw Error('Invalid reconciliation outcome');
  requireText(record.reason,'Reconciliation reason');
  if(!record.evidence?.length)throw Error('Reconciliation evidence required');
  record.evidence.forEach(ref=>verifyRef(base,ref));
  if(record.outcome==='not_created'){
    if(record.confirmation!=='explicit_service_confirmation')throw Error('Missing task in a list is not proof of non-creation');
  }else requireText(record.remote_identity,'Remote task identity');
  return record.outcome;
}
const transitions={
  planned:['submitting'], submitting:['processing','submission_unknown'],
  submission_unknown:['processing','studio_result_ready'],
  processing:['studio_result_ready','failed'], studio_result_ready:['qa_review'],
  qa_review:['ready_for_transfer','diagnostic_transfer'], ready_for_transfer:['exporting'], diagnostic_transfer:['exporting'], exporting:['downloaded','export_failed'], export_failed:['exporting'],
  downloaded:['awaiting_user_review'], awaiting_user_review:['accepted','needs_revision']
};
export function transition(state,next,evidence) {
  if(!transitions[state]?.includes(next)) throw Error(`Invalid transition ${state} -> ${next}`);
  if(!evidence?.trim()) throw Error('Evidence required');
  return next;
}
export function inspectGLB(file) {
  const b=fs.readFileSync(file);
  if(b.length<20||b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length) throw Error('Invalid GLB header');
  let o=12,j,binLength=0,index=0;
  while(o<b.length){
    if(o+8>b.length) throw Error('Truncated chunk header');
    const n=b.readUInt32LE(o),t=b.readUInt32LE(o+4);
    if(n%4||o+8+n>b.length) throw Error('Invalid chunk bounds');
    if(index===0&&t!==0x4e4f534a) throw Error('JSON must be first');
    if(t===0x4e4f534a){if(j)throw Error('Duplicate JSON');j=JSON.parse(b.toString('utf8',o+8,o+8+n));}
    if(t===0x004e4942)binLength+=n;
    o+=8+n;index++;
  }
  if(!j||j.asset?.version!=='2.0'||!j.meshes?.length) throw Error('Missing glTF mesh');
  const external=[...(j.buffers||[]),...(j.images||[])].filter(v=>v.uri&&!v.uri.startsWith('data:'));
  if(external.length) throw Error('External resources require separate verification');
  for(const buffer of j.buffers||[]) if(!buffer.uri&&buffer.byteLength>binLength) throw Error('Missing binary data');
  for(const view of j.bufferViews||[]){const buffer=j.buffers?.[view.buffer];if(!buffer||(view.byteOffset||0)+view.byteLength>buffer.byteLength)throw Error('Buffer view out of bounds');}
  return {sha256:hash(file),bytes:b.length,meshes:j.meshes.length,materials:j.materials?.length||0,images:j.images?.length||0,basic_structure:'passed',visual_review:'pending',engine_review:'not_performed'};
}

function main(args) {
  const [command,id,arg,value,evidence]=args;
  if(command==='inspect-glb'){console.log(JSON.stringify(inspectGLB(path.resolve(id)),null,2));return;}
  if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Invalid asset ID');
  const base=path.join(root,'assets',id);
  if(command==='status'){
    const runs=fs.existsSync(path.join(base,'runs'))?fs.readdirSync(path.join(base,'runs')).map(r=>({run:r,...read(path.join(base,'runs',r,'state.json'))})):[];
    console.log(JSON.stringify({brief:read(path.join(base,'brief.json')),runs},null,2));return;
  }
  if(command==='check-reference'){const ref=read(local(base,arg));checkReference(base,ref);checkIntakeReference(base,ref);console.log('Approved reference, animation intent and preparation verified');return;}
  if(!/^[a-z0-9-]+$/.test(arg||''))throw Error('Invalid run ID');
  const run=path.join(base,'runs',arg),lock=path.join(base,'.workflow.lock');
  const fd=fs.openSync(lock,'wx');
  try {
    const planFile=path.join(run,'plan.json'),stateFile=path.join(run,'state.json');
    if(command==='prepare'){
      if(fs.existsSync(planFile)||fs.existsSync(stateFile))throw Error('Run already exists; use a new run ID');
      const plan=read(local(base,value));
      checkReference(base,read(local(base,plan.reference_manifest)));
      checkIntakeReference(base,read(local(base,plan.reference_manifest)));
      plan.reference_manifest_sha256=hash(local(base,plan.reference_manifest));
      fs.mkdirSync(run,{recursive:true});
      write(planFile,plan);
      write(stateFile,{status:'planned',created_at:new Date().toISOString()});
      const approval=creditApproval(base,plan,hash(planFile));
      write(path.join(run,'approval.json'),approval||{status:'pending',plan_sha256:hash(planFile),max_credits:null,evidence:null});
      console.log(approval?'Run prepared; standing credit authorization applied; validate scope and live UI before submission':'Run prepared; production approval pending');return;
    }
    if(command==='reconcile'){
      const state=read(stateFile),record=read(local(base,value));
      const next=reconcileSubmission(base,state.status,record);
      const event={at:new Date().toISOString(),from:state.status,to:next,evidence:value,kind:'reconciliation',budget_release:false};
      write(stateFile,{status:next,updated_at:event.at,evidence:value});
      fs.appendFileSync(path.join(run,'actions.jsonl'),JSON.stringify(event)+'\n');
      console.log(JSON.stringify(event));return;
    }
    if(command==='check-plan'||command==='mark'){
      const state=read(stateFile);
      if(command==='check-plan'||value==='submitting'){
        if(state.status!=='planned')throw Error('Run already submitted or uncertain; inspect Studio history');
        const plan=read(planFile);
        const automatic=creditApproval(base,plan,hash(planFile));
        const approval=automatic||read(path.join(run,'approval.json'));
        if(approval.plan_sha256!==hash(planFile))throw Error('Plan changed since approval');
        checkPlan(base,plan,approval);
        checkSubmissionReadiness(base,plan,read(local(base,plan.reference_manifest)));
        checkAssetScope(base,arg,plan);
        if(command==='mark'&&automatic)write(path.join(run,'approval.json'),automatic);
      }
      if(command==='check-plan'){console.log('Plan valid; recheck live UI before click');return;}
      const next=transition(state.status,value,evidence);
      let transferFields=state.transfer_review?{transfer_review:state.transfer_review,transfer_plan_sha256:state.transfer_plan_sha256,transfer_disposition:state.transfer_disposition}:{};
      if(['ready_for_transfer','diagnostic_transfer'].includes(next)){
        const ref={path:evidence,sha256:hash(local(base,evidence))};
        transferFields={transfer_review:ref,transfer_plan_sha256:hash(planFile),transfer_disposition:next};
        validateTransferReview(base,arg,{status:next,...transferFields});
      }
      if(value==='exporting'&&state.transfer_review)validateTransferReview(base,arg,state);
      if(next==='downloaded'){
        const result=inspectGLB(local(base,evidence));
        write(path.join(run,'qa.json'),result);
      }
      const event={at:new Date().toISOString(),from:state.status,to:next,evidence};
      // Persist submission intent before any browser action. Crash recovery fails closed.
      write(stateFile,{status:next,updated_at:event.at,evidence,...transferFields});
      fs.appendFileSync(path.join(run,'actions.jsonl'),JSON.stringify(event)+'\n');
      console.log(JSON.stringify(event));return;
    }
    throw Error('Commands: status, check-reference, prepare, check-plan, mark, inspect-glb');
  } finally {fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
