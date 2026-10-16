import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {root} from './workflow.mjs';
test('scaffold creates pending handoff and refuses to overwrite',()=>{
  const id=`scaffold-test-${Date.now()}`, target=path.join(root,'assets',id);
  const run=value=>spawnSync(process.execPath,[path.join(root,'tools/workflow/scaffold.mjs'),value],{encoding:'utf8'});
  try{
    assert.equal(run(id).status,0);
    const f=path.join(target,'brief.json'),before=fs.readFileSync(f,'utf8');
    assert.equal(JSON.parse(fs.readFileSync(path.join(target,'handoff.json'),'utf8')).stage,'reference');
    assert.equal(JSON.parse(fs.readFileSync(path.join(target,'reference-contract.json'),'utf8')).input_contract,'adaptive_reference_v1');
    assert.equal(JSON.parse(fs.readFileSync(path.join(target,'workflow-policy.json'),'utf8')).reference_input_contract,'adaptive_reference_v1');
    assert.equal(JSON.parse(fs.readFileSync(path.join(target,'production.json'),'utf8')).local_revisions.iteration_policy.mode,'progress_guarded');
    assert.notEqual(run(id).status,0);
    assert.equal(fs.readFileSync(f,'utf8'),before);
    assert.notEqual(run('../escape').status,0);
    assert.match(run('--help').stdout,/Usage:/);
  }finally{
    const resolved=path.resolve(target);
    if(path.dirname(resolved)!==path.resolve(root,'assets')||!path.basename(resolved).startsWith('scaffold-test-'))throw Error('Unsafe cleanup');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
