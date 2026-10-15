import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {atomicJSON,fileRef,readJSON,sha256} from './production-io.mjs';
import {newProduction,beginIteration,finishIteration} from './production.mjs';
import {prepareExecution,reconcileExecution} from './execution.mjs';
import {evaluateReport} from './quality.mjs';
import {verifyMeasurementContract} from './measurement-contract.mjs';

const executable=process.env.BLENDER_TEST_EXE;
function pngPixels(file){
  const buffer=fs.readFileSync(file),chunks=[];
  for(let offset=8;offset<buffer.length;){const length=buffer.readUInt32BE(offset);if(buffer.toString('ascii',offset+4,offset+8)==='IDAT')chunks.push(buffer.subarray(offset+8,offset+8+length));offset+=length+12;}
  return inflateSync(Buffer.concat(chunks));
}
test('real Blender evaluated vertices, topology guard, sampling and receipted execution',{skip:!executable},()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-blender-test-'));
  const tool=name=>fileURLToPath(new URL(name,import.meta.url));
  const run=args=>{
    const result=spawnSync(executable,args,{encoding:'utf8',timeout:45000,windowsHide:true});
    assert.ifError(result.error);assert.equal(result.status,0,result.stderr+'\n'+result.stdout);return result;
  };
  try{
    run(['--background','--factory-startup','--python-exit-code','1','--python',tool('blender-fixture.py'),'--',base]);
    const source=path.join(base,'source.blend'),before=sha256(source);
    run(['--background','--factory-startup',source,'--python-exit-code','1','--python',tool('blender-measure.py'),'--',path.join(base,'measure-config.json'),path.join(base,'measured.json')]);
    const measured=readJSON(path.join(base,'measured.json'));
    run(['--background','--factory-startup',path.join(base,'topology-source.blend'),'--python-exit-code','1','--python',tool('blender-measure.py'),'--',path.join(base,'topology-config.json'),path.join(base,'topology-measured.json')]);
    const topologyMeasured=readJSON(path.join(base,'topology-measured.json'));
    const mappingConfig=readJSON(path.join(base,'topology-config.json')),baselineConfig=readJSON(path.join(base,'measure-config.json'));
    const mappingContract={collector_sha256:measured.collector_sha256,blender_version:measured.blender_version,
      conditions:Object.fromEntries(['samples','regions','reference_frame','scale'].map(k=>[k,baselineConfig[k]])),
      region_variants:[{id:'subdivided',basis:'Fixture named surface corners; explicit frozen virtual edges',max_reference_error:1e-6,
        evidence:[fileRef(base,'measure-config.json')],baseline_source:fileRef(base,'source.blend'),baseline_measurement:fileRef(base,'measured.json'),regions:mappingConfig.regions}]};
    verifyMeasurementContract(base,mappingContract,topologyMeasured,topologyMeasured.source_sha256);
    assert.notEqual(topologyMeasured.regions.protected.topology_sha256,measured.regions.protected.topology_sha256);
    assert.ok(topologyMeasured.inventory.find(x=>x.name==='Foot').vertices>measured.inventory.find(x=>x.name==='Foot').vertices);
    for(const name of Object.keys(measured.values))assert.ok(Math.abs(topologyMeasured.values[name]-measured.values[name])<1e-5);
    run(['--background','--factory-startup',path.join(base,'bone-source.blend'),'--python-exit-code','1','--python',tool('blender-measure.py'),'--',path.join(base,'bone-config.json'),path.join(base,'bone-measured.json')]);
    const boneMeasured=readJSON(path.join(base,'bone-measured.json'));
    assert.ok(boneMeasured.values.root_removed<1e-5);
    assert.ok(boneMeasured.values.rotation_retained>.1);
    for(const name of ['capture-a','capture-b'])run(['--background','--factory-startup',source,'--python-exit-code','1','--python',tool('blender-capture.py'),'--',path.join(base,'capture-config.json'),path.join(base,name+'.json')]);
    const captureA=readJSON(path.join(base,'capture-a.json')),captureB=readJSON(path.join(base,'capture-b.json'));
    assert.deepEqual(captureA.effective_conditions,captureB.effective_conditions);
    // PNG metadata includes capture time: compare raster payload, not whole-file hash.
    assert.deepEqual(pngPixels(path.join(base,captureA.captures[0].image.path)),pngPixels(path.join(base,captureB.captures[0].image.path)));
    assert.ok(measured.inventory.length>10);
    assert.ok(Math.abs(measured.values.protected_region-Math.sqrt(.05))<1e-5);
    assert.ok(Math.abs(measured.values.sole_penetration-.1)<1e-5);
    assert.ok(measured.values.sole_drift>3);
    assert.ok(Math.abs(measured.values.transition_stretch-1)<1e-5);
    assert.ok(Math.abs(measured.regions.protected.sampled_positions[1].positions[0][2]+.05)<1e-5);
    const config=readJSON(path.join(base,'measure-config.json'));config.regions[0].topology_sha256='wrong';
    atomicJSON(path.join(base,'bad-config.json'),config);
    const bad=spawnSync(executable,['--background','--factory-startup',source,'--python-exit-code','1','--python',tool('blender-measure.py'),'--',path.join(base,'bad-config.json'),path.join(base,'bad-measure.json')],{encoding:'utf8',timeout:45000,windowsHide:true});
    assert.ifError(bad.error);assert.notEqual(bad.status,0);assert.match(bad.stdout+bad.stderr,/topology identity/);assert.ok(!fs.existsSync(path.join(base,'bad-measure.json')));
    const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
    const actualConfig=readJSON(path.join(base,'measure-config.json')),actualCaptureConfig=readJSON(path.join(base,'capture-config.json'));
    const spec={schema_version:2,status:'active',motion_required:false,suite_id:measured.suite_id,basis:'fixture',gates:{base_model:['shape'],polish:['shape','protected_region'],final:['shape']},criteria:{shape:{kind:'visual',description:'Fixture shape'},protected_region:{kind:'metric',description:'Measured displacement',operator:'lte',unit:'asset_height_ratio',limit:1}},
      evidence_policy:{measurement_required:true,visual_required:true,capability_required:true},
      measurement_contract:{collector_sha256:measured.collector_sha256,blender_version:measured.blender_version,conditions:Object.fromEntries(['samples','regions','reference_frame','scale'].map(k=>[k,actualConfig[k]]))},
      visual_contract:{collector_sha256:captureA.collector_sha256,blender_version:measured.blender_version,conditions:actualCaptureConfig.conditions}};
    const job=newProduction('fixture',put('spec.json',spec));job.artifacts.candidate=fileRef(base,'source.blend');
    const boundReport=put('bound-report.json',{schema_version:2,stage:'polish',job_id:job.job_id,source_sha256:before,quality_spec_sha256:job.quality_spec.sha256,suite_id:spec.suite_id,checks:[
      {name:'shape',status:'pass',observation:'Engineering fixture only; raster inspected separately',evidence:[fileRef(base,'capture-a.json')],visual_capture:fileRef(base,'capture-a.json')},
      {name:'protected_region',evidence:[fileRef(base,'measured.json')],measurement:{file:fileRef(base,'measured.json'),pointer:'/values/protected_region'}}]});
    assert.equal(evaluateReport(base,job,'polish',boundReport).action,'user_review');
    fs.writeFileSync(path.join(base,'operation.py'),"bpy.data.objects['Foot']['workflow_fixture'] = True\n");
    const round=beginIteration(base,job,put('plan.json',{job_id:job.job_id,source_sha256:before,quality_spec_sha256:job.quality_spec.sha256,operation:'diagnostic',defect_id:'fixture',strategy_id:'fixture',hypothesis:'Verify execution receipt',authorization_evidence:'isolated integration test',success_checks:['shape'],protected_checks:['shape'],output_path:'candidate.blend',execution:{script:fileRef(base,'operation.py'),blender_version:measured.blender_version}}));
    const dispatch=prepareExecution(base,job);run(dispatch.native_arguments);
    reconcileExecution(base,job);assert.equal(round.execution.state,'completed');
    finishIteration(base,job,put('finish.json',{job_id:job.job_id,iteration_id:round.id,status:'completed',diagnostic_conclusion:'supported',summary:'Real isolated Blender smoke',evidence:[fileRef(base,'measured.json')],candidate:fileRef(base,'candidate.blend')}));
    assert.equal(round.outcome,'diagnostic_supported');assert.equal(sha256(source),before);
    fs.writeFileSync(path.join(base,'failure.py'),"bpy.data.objects['Foot'].location.x += 9\nraise RuntimeError('fixture partial failure')\n");
    const failed=beginIteration(base,job,put('failure-plan.json',{job_id:job.job_id,source_sha256:before,quality_spec_sha256:job.quality_spec.sha256,operation:'diagnostic',defect_id:'fixture',strategy_id:'fixture',hypothesis:'Verify partial failure receipt',authorization_evidence:'isolated test',success_checks:['shape'],protected_checks:['shape'],output_path:'failed.blend',execution:{script:fileRef(base,'failure.py'),blender_version:measured.blender_version}}));
    const failureDispatch=prepareExecution(base,job);
    const failure=spawnSync(executable,failureDispatch.native_arguments,{encoding:'utf8',timeout:45000,windowsHide:true});
    assert.ifError(failure.error);assert.notEqual(failure.status,0);assert.match(failure.stdout+failure.stderr,/fixture partial failure/);
    reconcileExecution(base,job);assert.equal(failed.execution.state,'failed');
    const receiptHash=sha256(path.join(base,failed.execution.receipt_path));
    const replay=spawnSync(executable,failureDispatch.native_arguments,{encoding:'utf8',timeout:45000,windowsHide:true});
    assert.ifError(replay.error);assert.notEqual(replay.status,0);assert.equal(sha256(path.join(base,failed.execution.receipt_path)),receiptHash);
    finishIteration(base,job,put('failure-finish.json',{job_id:job.job_id,iteration_id:failed.id,status:'failed',summary:'Verified partial failure, no replay',evidence:[failed.execution.receipt]}));
    assert.equal(sha256(source),before);assert.equal(failed.outcome,'diagnostic_execution_failed');
    if(process.env.BLENDER_TEST_REPORT){
      atomicJSON(process.env.BLENDER_TEST_REPORT,{blender_version:measured.blender_version,values:measured.values,root_bone_values:boneMeasured.values,capture_repeat_identical:true,capture_collector_sha256:captureA.collector_sha256,inventory_count:measured.inventory.length,samples:measured.samples,collector_sha256:measured.collector_sha256,source_unchanged:true,topology_mismatch_rejected:true,mapped_topology_verified:true,execution_receipt_verified:true,partial_failure_verified:true,replay_rejected:true,fixture_only:true});
      fs.copyFileSync(path.join(base,captureA.captures[0].image.path),process.env.BLENDER_TEST_REPORT.replace(/\.json$/,'.png'));
    }
  }finally{
    assert.equal(path.dirname(path.resolve(base)),path.resolve(os.tmpdir()));assert.ok(path.basename(base).startsWith('tripo-blender-test-'));fs.rmSync(base,{recursive:true,force:true});
  }
});
