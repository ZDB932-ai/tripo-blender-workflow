import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {hash,checkReference,checkPlan,transition,inspectGLB} from './workflow.mjs';
test('unknown submission cannot be resubmitted',()=>{
  assert.throws(()=>transition('submission_unknown','submitting','retry'));
  assert.throws(()=>transition('submitting','planned','retry'));
  assert.equal(transition('submission_unknown','processing','Studio asset found'),'processing');
  assert.throws(()=>transition('planned','submitting',''));
});
test('changed references, missing approval, stale quotes and exceeded budgets are blocked',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-workflow-'));
  try{
    fs.writeFileSync(path.join(dir,'ref.png'),'fixture');
    const ref={files:[{path:'ref.png',sha256:hash(path.join(dir,'ref.png'))}],decision:{status:'approved',evidence:'test only'}};
    fs.writeFileSync(path.join(dir,'ref.json'),JSON.stringify(ref));
    fs.writeFileSync(path.join(dir,'ui.txt'),'UI evidence fixture');
    const p={reference_manifest:'ref.json',reference_manifest_sha256:hash(path.join(dir,'ref.json')),backend:'tripo_studio_browser',billing_source:'studio',candidate_count:1,quoted_credits:55,observed_at:new Date().toISOString(),ui_evidence:'ui.txt'};
    const a={status:'approved',evidence:'test only',max_credits:55};
    checkPlan(dir,p,a);
    assert.throws(()=>checkPlan(dir,p,null));
    assert.throws(()=>checkPlan(dir,p,{...a,max_credits:54}));
    assert.throws(()=>checkPlan(dir,{...p,observed_at:'2020-01-01'},a));
    fs.writeFileSync(path.join(dir,'ref.png'),'changed');
    assert.throws(()=>checkReference(dir,ref));
    assert.throws(()=>inspectGLB(path.join(dir,'ref.png')));
  }finally{const target=path.resolve(dir);if(!target.startsWith(path.resolve(os.tmpdir())+path.sep+'tripo-workflow-'))throw Error('Unsafe cleanup path');fs.rmSync(target,{recursive:true,force:true});}
});
