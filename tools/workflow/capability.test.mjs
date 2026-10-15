import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {atomicJSON,fileRef} from './production-io.mjs';
import {properties,validateCapability,verifyCapabilityResult} from './capability.mjs';

test('operation contracts require version, formats, retained properties and output evidence',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-capability-'));
  try{
    const put=(name,data)=>{atomicJSON(path.join(base,name),data);return fileRef(base,name);};
    const evidence=put('evidence.json',{synthetic:true});
    const spec={evidence_policy:{capability_required:true}};
    const plan={operation:'export',format:'glb',output_path:'model.glb',execution:{blender_version:'test'}};
    assert.throws(()=>validateCapability(base,plan,spec),/contract required/);
    const c={operation:'export',method:'glTF export',route:'blender',runtime:'Blender',version:'test',input_format:'blend',output_format:'glb',basis:'fixture',evidence:[evidence],properties:Object.fromEntries(properties.map(name=>[name,{disposition:'preserve',reason:'fixture requirement',verification:'compare exported/reimported data'}]))};
    plan.capability=put('contract.json',c);assert.ok(validateCapability(base,plan,spec));
    plan.format='fbx';assert.throws(()=>validateCapability(base,plan,spec),/format mismatch/);plan.format='glb';
    plan.execution.blender_version='other';assert.throws(()=>validateCapability(base,plan,spec),/execution version/);plan.execution.blender_version='test';
    const source=put('source.json',{}),output=put('output.json',{output:true});
    const report={contract_sha256:plan.capability.sha256,source_sha256:source.sha256,output_sha256:output.sha256,runtime:'Blender',version:'test',input_format:'blend',output_format:'glb',checks:properties.map(name=>({name,status:'pass',observation:'synthetic verification',evidence:[evidence]}))};
    const result={candidate:output,capability_report:put('result.json',report)},round={baseline:source};
    assert.equal(verifyCapabilityResult(base,plan,spec,round,result),true);
    report.checks[0].status='unknown';result.capability_report=put('unknown.json',report);
    assert.equal(verifyCapabilityResult(base,plan,spec,round,result),false);
    report.output_sha256='wrong';result.capability_report=put('wrong.json',report);
    assert.throws(()=>verifyCapabilityResult(base,plan,spec,round,result),/identity mismatch/);
    delete c.properties.uv;plan.capability=put('missing.json',c);
    assert.throws(()=>validateCapability(base,plan,spec),/disposition/);
    assert.equal(validateCapability(base,{operation:'diagnostic'},spec),null);
  }finally{
    assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(base).startsWith('tripo-capability-'));fs.rmSync(base,{recursive:true,force:true});
  }
});
