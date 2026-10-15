import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localFile,atomicJSON,fileRef} from './production-io.mjs';
import {checkReference} from './workflow.mjs';
import {newProduction,inspectNext,persist} from './production.mjs';
import {qualityTemplate} from './quality-template.mjs';
import {listTasks,taskSummary} from './work.mjs';
import {doctor} from './doctor.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-operability-'));
  t.after(()=>{assert.equal(path.dirname(dir),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('tripo-operability-'));fs.rmSync(dir,{recursive:true,force:true});});return dir;
}
test('all evidence and missing output paths reject external junction ancestors',t=>{
  const dir=fixture(t),base=path.join(dir,'asset'),outside=path.join(dir,'outside');
  fs.mkdirSync(base);fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'image.png'),'fixture');
  fs.symlinkSync(outside,path.join(base,'escape'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>localFile(base,'escape/new/output.blend'),/Symlink escapes/);
  assert.throws(()=>checkReference(base,{files:[{path:'escape/image.png',sha256:'0'.repeat(64)}]}),/Symlink escapes/);
  assert.equal(localFile(base,'safe/new.blend'),path.join(base,'safe/new.blend'));
  assert.equal(fs.existsSync(path.join(outside,'new')),false);
});
test('broken remote records return actionable recovery without hiding healthy jobs',t=>{
  const dir=fixture(t),base=path.join(dir,'assets','healthy');fs.mkdirSync(base,{recursive:true});
  atomicJSON(path.join(base,'spec.json'),qualityTemplate(false));
  const job=newProduction('healthy',fileRef(base,'spec.json'));persist(base,job,{type:'fixture'});
  fs.mkdirSync(path.join(base,'runs','001'),{recursive:true});fs.writeFileSync(path.join(base,'runs','001','state.json'),'{broken');
  assert.equal(inspectNext(base,job).action,'repair_records');
  assert.match(taskSummary(base).operator.instruction,/Repair/);
  fs.mkdirSync(path.join(dir,'assets','broken'));fs.writeFileSync(path.join(dir,'assets','broken','production.json'),'{');
  const snapshot=fs.readFileSync(path.join(base,'production.json'),'utf8');
  const listed=listTasks(dir);assert.equal(listed.length,2);assert.ok(listed.every(r=>r.next.action==='repair_records'));
  assert.equal(fs.readFileSync(path.join(base,'production.json'),'utf8'),snapshot);
});
test('local doctor and integration validator fail when Blender is unavailable',t=>{
  const dir=fixture(t),missing=path.join(dir,'missing-blender');
  const r=doctor(root,undefined,missing,{profile:'local'});
  assert.equal(r.valid,false);assert.equal(r.readiness.local_execution,false);assert.equal(r.readiness.studio,'not_checked');
  const cli=spawnSync(process.execPath,[path.join(root,'tools/workflow/validate.mjs')],{env:{...process.env,BLENDER_TEST_EXE:''},encoding:'utf8',windowsHide:true});
  assert.notEqual(cli.status,0);assert.match(cli.stderr,/must not silently skip/);
});
