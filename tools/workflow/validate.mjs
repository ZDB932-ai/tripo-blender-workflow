// Repeatable local integration validation. Never submits a Studio task.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {doctor} from './doctor.mjs';
import {atomicJSON} from './production-io.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const args=process.argv.slice(2);
const get=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const blender=get('--blender')||process.env.BLENDER_TEST_EXE;
if(!blender){console.error('Set --blender PATH or BLENDER_TEST_EXE. Integration validation must not silently skip Blender.');process.exitCode=1;}
else{
  const dependencies=doctor(root,get('--installed'),blender,{profile:'local'});
  let result=null;
  if(dependencies.valid){
    const tests=fs.readdirSync(here).filter(f=>f.endsWith('.test.mjs')).sort();
    result=spawnSync(process.execPath,['--test',...tests],{cwd:here,env:{...process.env,BLENDER_TEST_EXE:blender},encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:16*1024*1024});
    process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
  }
  const valid=dependencies.valid&&result?.status===0&&!result?.error;
  const report={schema_version:1,at:new Date().toISOString(),valid,scope:'Local rules and isolated real Blender fixtures only; no Studio generation or asset acceptance',dependencies,test_exit_code:result?.status??null,error:result?.error?.message??null,stdout:result?.stdout||'',stderr:result?.stderr||''};
  const output=get('--report');if(output){const target=path.resolve(output);if(fs.existsSync(target))throw Error('Report exists; choose a new version');atomicJSON(target,report);}
  if(!valid){if(!dependencies.valid)console.error(JSON.stringify(dependencies,null,2));process.exitCode=1;}
}
