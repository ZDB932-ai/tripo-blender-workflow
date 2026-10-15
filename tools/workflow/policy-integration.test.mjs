import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,hash} from './workflow.mjs';
import {submissionFixture} from './submission-fixture.mjs';
test('CLI reserves one submission and blocks second run over asset budget',()=>{
  const id=`policy-test-${Date.now()}`,base=path.join(root,'assets',id);
  const cli=(...args)=>spawnSync(process.execPath,[path.join(root,'tools/workflow/workflow.mjs'),...args],{encoding:'utf8'});
  const put=(name,value)=>fs.writeFileSync(path.join(base,name),JSON.stringify(value));
  try{
    fs.mkdirSync(base,{recursive:true});
    const fixture=submissionFixture(base);
    put('draft.json',fixture.plan);
    put('quality-spec.json',{status:'approved',evidence:'test only',gates:{reference:['identity']}});
    put('workflow-policy.json',{review_mode:'autonomous',status:'approved',evidence:'test scope only',allowed_backends:['tripo_studio_browser'],allowed_operations:['generate'],studio_credit_cap:45,max_paid_runs:2,max_local_revision_rounds:1,reference_manifest_sha256:hash(path.join(base,'ref.json')),quality_spec_sha256:hash(path.join(base,'quality-spec.json'))});
    for(const run of ['001','002']){
      assert.equal(cli('prepare',id,run,'draft.json').status,0);
      put(`runs/${run}/approval.json`,{status:'approved',plan_sha256:hash(path.join(base,'runs',run,'plan.json')),max_credits:45,evidence:'test scope only'});
    }
    const first=cli('mark',id,'001','submitting','test without browser');
    assert.equal(first.status,0,first.stderr);
    const second=cli('mark',id,'002','submitting','must fail');
    assert.notEqual(second.status,0);
    assert.match(second.stderr,/Cumulative budget/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(base,'runs/002/state.json'))).status,'planned');
    assert.notEqual(cli('mark',id,'001','submitting','duplicate').status,0);
    put('quality-spec.json',{status:'approved',evidence:'test only',gates:{reference:[]}});
    assert.match(cli('check-plan',id,'002').stderr,/Quality requirements changed/);
  }finally{
    const resolved=path.resolve(base);
    if(path.dirname(resolved)!==path.resolve(root,'assets')||!path.basename(resolved).startsWith('policy-test-'))throw Error('Unsafe cleanup');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
