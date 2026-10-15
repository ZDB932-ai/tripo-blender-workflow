import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {atomicJSON,fileRef,readJSON} from './production-io.mjs';
import {newProduction,beginIteration,finishIteration} from './production.mjs';
import {prepareExecution,reconcileExecution,abortExecution,recoverExecution,classifyToolResponse} from './execution.mjs';
import {startWork,finishWork,taskSummary} from './work.mjs';

function fixture(fn){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-execution-test-'));
  try{
    const put=(p,d)=>{atomicJSON(path.join(base,p),d);return fileRef(base,p);};
    fs.writeFileSync(path.join(base,'source.blend'),'SYNTHETIC');
    fs.writeFileSync(path.join(base,'edit.py'),'# synthetic');
    fs.writeFileSync(path.join(base,'evidence.txt'),'SYNTHETIC process reconciliation');
    const evidence=fileRef(base,'evidence.txt');
    const spec={schema_version:2,status:'active',suite_id:'test',basis:'fixture',motion_required:false,
      gates:{base_model:['shape'],polish:['shape'],final:['shape']},criteria:{shape:{kind:'visual',description:'Shape'}}};
    const job=newProduction('test',put('spec.json',spec));job.evidence_policy_required=false;job.artifacts.candidate=fileRef(base,'source.blend');
    const plan={job_id:job.job_id,source_sha256:job.artifacts.candidate.sha256,quality_spec_sha256:job.quality_spec.sha256,
      operation:'diagnostic',defect_id:'test',strategy_id:'test',hypothesis:'test',authorization_evidence:'synthetic',
      success_checks:['shape'],protected_checks:['shape'],output_path:'candidate.blend',execution:{script:fileRef(base,'edit.py')}};
    const start=()=>beginIteration(base,job,put('plan.json',plan));
    const receipt=(round,status='completed')=>{
      const request=readJSON(path.join(base,round.execution.request.path));
      fs.writeFileSync(path.join(base,round.output_path),'SYNTHETIC output');
      return {...request,request_sha256:round.execution.request.sha256,status,pid:123,blender_version:'test',output_sha256:fileRef(base,round.output_path).sha256,error:status==='failed'?'test failure':undefined};
    };
    const result=round=>({job_id:job.job_id,iteration_id:round.id,status:'completed',diagnostic_conclusion:'supported',summary:'test',candidate:fileRef(base,round.output_path),evidence:[evidence]});
    fn({base,put,job,plan,start,receipt,result,evidence});
  }finally{
    assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-execution-test-'));fs.rmSync(base,{recursive:true,force:true});
  }
}
test('new production requires script and unknown dispatch cannot replay or finish',()=>fixture(({base,put,job,plan,start,receipt,result})=>{
  assert.throws(()=>beginIteration(base,job,put('no-script.json',{...plan,execution:undefined})),/script required/);
  const round=start();prepareExecution(base,job);assert.throws(()=>prepareExecution(base,job),/already dispatched/);
  const data=receipt(round);assert.throws(()=>finishIteration(base,job,put('result.json',result(round))),/Reconcile execution/);
  put(round.execution.receipt_path,{...data,nonce:'wrong'});assert.throws(()=>reconcileExecution(base,job),/identity/);
  put(round.execution.receipt_path,data);reconcileExecution(base,job);
  finishIteration(base,job,put('result.json',result(round)));assert.equal(round.outcome,'diagnostic_supported');
}));
test('changed output or script cannot use successful execution receipt',()=>fixture(({base,put,job,start,receipt,result})=>{
  const round=start();prepareExecution(base,job);put(round.execution.receipt_path,receipt(round));reconcileExecution(base,job);
  fs.writeFileSync(path.join(base,round.output_path),'tampered');assert.throws(()=>finishIteration(base,job,put('result.json',result(round))),/output mismatch/);
  fs.writeFileSync(path.join(base,'edit.py'),'tampered');assert.throws(()=>reconcileExecution(base,job),/File changed/);
}));
test('failed worker cannot finish completed; unknown abort requires process evidence',()=>fixture(({base,put,job,start,receipt,result,evidence})=>{
  const round=start();prepareExecution(base,job);
  assert.throws(()=>abortExecution(base,job,put('bad-abort.json',{iteration_id:round.id})),/Stopped-process evidence/);
  put(round.execution.receipt_path,receipt(round,'failed'));reconcileExecution(base,job);
  assert.throws(()=>finishIteration(base,job,put('result.json',result(round))),/did not complete/);
  finishIteration(base,job,put('failed.json',{job_id:job.job_id,iteration_id:round.id,status:'failed',summary:'worker failed',evidence:[evidence]}));
  assert.equal(round.outcome,'diagnostic_execution_failed');
}));
test('isError false and success text never substitute for execution receipt',()=>{
  assert.equal(classifyToolResponse({isError:false,content:[{text:'Could not connect to Blender'}]}).transport_error,true);
  assert.equal(classifyToolResponse({isError:false,content:[{text:'Code executed successfully'}]}).state,'execution_unknown');
});

test('work facade fills identities, refuses duplicate dispatch, and completes only after a verified receipt',()=>fixture(({base,put,job,plan,receipt})=>{
  put('production.json',job);
  const request={...plan,execution:{script:'edit.py'}};delete request.job_id;delete request.source_sha256;delete request.quality_spec_sha256;
  const dispatched=startWork(base,request);assert.ok(dispatched.code);assert.throws(()=>startWork(base,request),/Unfinished/);
  assert.throws(()=>finishWork(base,{status:'completed',summary:'test',diagnostic_conclusion:'supported',evidence:['evidence.txt']}));
  const persisted=readJSON(path.join(base,'production.json')),round=persisted.local_revisions.records[0];
  put(round.execution.receipt_path,receipt(round));
  const result=finishWork(base,{status:'completed',summary:'test',diagnostic_conclusion:'supported',evidence:['evidence.txt']});
  assert.equal(result.status,'completed');assert.equal(result.diagnostic_conclusion,'supported');
  assert.throws(()=>finishWork(base,{}),/No unfinished/);assert.equal(taskSummary(base).attempts,1);
}));


test('orphan dispatch recovery does not issue replay and manual abort remains auditable',()=>fixture(({base,put,job,start,evidence})=>{
  const round=start();prepareExecution(base,job);delete round.execution;
  assert.throws(()=>prepareExecution(base,job),/Existing dispatch/);
  const recovered=recoverExecution(base,job);assert.equal(recovered.state,'execution_unknown');assert.equal(recovered.code,undefined);
  abortExecution(base,job,put('abort.json',{iteration_id:round.id,confirmed_process_stopped:true,reason:'Synthetic process exit inspection',evidence:[evidence]}));
  finishIteration(base,job,put('finish-abort.json',{job_id:job.job_id,iteration_id:round.id,status:'aborted',summary:'confirmed stopped',evidence:[evidence]}));
  assert.equal(round.status,'aborted');assert.equal(round.execution.state,'aborted');
}));
