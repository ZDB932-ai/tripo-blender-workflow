// Read-only dependency and source/installation compatibility report.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha256} from './production-io.mjs';
export const protocolVersion='3.6';
export function doctor(root,installed,blender,options={}){
  const profile=options.profile||'records';
  if(!['records','local'].includes(profile))throw Error('Doctor profile must be records or local');
  const checks=[];
  const add=(name,status,detail)=>checks.push({name,status,detail});
  const required=['docs/workflow/animation-review.md','tools/workflow/animation-review.mjs','tools/workflow/blender-regression-snapshot.py','docs/workflow/reference-intake.md','docs/workflow/playwright-operations.md','tools/workflow/submission-readiness.mjs','SKILLS.md','docs/workflow/skill-runtime.md','docs/workflow/request-modes.md','tools/workflow/PRODUCTION.md','tools/workflow/RECOVERY.md','tools/workflow/EVIDENCE.md','tools/workflow/production.mjs','tools/workflow/workflow.mjs','tools/workflow/quality.mjs','tools/workflow/remote-routing.mjs','tools/workflow/measurement-contract.mjs','tools/workflow/execution.mjs','tools/workflow/blender-execution.py','tools/workflow/blender-measure.py','tools/workflow/blender-capture.py','TRIPO_BLENDER_CAPABILITIES.md'];
  const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
  for(const f of ['docs/workflow/operator-guide.md','tools/workflow/validate.mjs','tools/workflow/run-local.mjs','tools/workflow/iteration-routing.mjs','docs/workflow/local-automation.md'])if(!fs.existsSync(path.join(root,f)))missing.push(f);
  for(const f of ['docs/workflow/studio-capabilities.md','docs/workflow/studio-recipes.md','docs/research/tripo-studio-2026-09-27.md','tools/workflow/LEAN.md','tools/workflow/work.mjs','tools/workflow/input-binding.mjs','tools/workflow/review-reuse.mjs','tools/workflow/blender-domain-snapshot.py'])if(!fs.existsSync(path.join(root,f)))missing.push(f);
  add('project_files',missing.length?'fail':'pass',missing);
  const protocol=path.join(root,'tools/workflow/PRODUCTION.md');
  add('protocol_document',fs.existsSync(protocol)&&fs.readFileSync(protocol,'utf8').includes('执行协议 **'+protocolVersion+'**')?'pass':'fail',protocolVersion);
  add('node',Number(process.versions.node.split('.')[0])>=20?'pass':'fail',process.version+' (requires >=20)');
  for(const [name,exe,args] of [['python','python',['-X','utf8','--version']],['blender',blender||'blender',['--version']]]){
    const result=spawnSync(exe,args,{encoding:'utf8',timeout:10000,windowsHide:true});
    add(name,result.status===0?'pass':'unavailable',result.status===0?(result.stdout||result.stderr).split(/\r?\n/)[0]:'Executable not available; specify its path when needed');
  }
  const skillsRoot=path.join(root,'skills');
  const skills=fs.existsSync(skillsRoot)?fs.readdirSync(skillsRoot,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name):[];
  const files=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(path.join(folder,d.name)):path.join(folder,d.name));
  for(const skill of skills){
    const folder=path.join(skillsRoot,skill),entry=path.join(folder,'SKILL.md');
    const version=fs.existsSync(entry)?fs.readFileSync(entry,'utf8').match(/workflow_protocol:\s*["']?([\d.]+)/)?.[1]:null;
    add(skill+':protocol',version===protocolVersion?'pass':'fail',{expected:protocolVersion,actual:version});
    if(installed){
      const target=path.join(installed,skill),sourceFiles=files(folder).map(f=>path.relative(folder,f));
      const drift=sourceFiles.filter(f=>!fs.existsSync(path.join(target,f))||sha256(path.join(folder,f))!==sha256(path.join(target,f)));
      const extra=fs.existsSync(target)?files(target).map(f=>path.relative(target,f)).filter(f=>!sourceFiles.includes(f)):[];
      add(skill+':installed',drift.length||extra.length?'fail':'pass',{changed_or_missing:drift,extra});
    }
  }
  add('live_tools','not_checked','CLI cannot certify MCP, Studio login, Bridge connection or account credits. Check current callable tools and their response bodies only when needed.');
  const recordsValid=checks.every(c=>c.status!=='fail');
  const localReady=recordsValid&&['python','blender'].every(name=>checks.find(c=>c.name===name)?.status==='pass');
  return {protocol_version:protocolVersion,root,profile,valid:profile==='local'?localReady:recordsValid,
    readiness:{records:recordsValid,local_execution:localReady,studio:'not_checked',live_blender:'not_checked'},
    note:'valid applies only to the selected profile; it does not certify Studio login, live MCP, paid generation or asset quality.',checks};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),get=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
  const root=get('--project')||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const result=doctor(root,get('--installed'),get('--blender')||process.env.BLENDER_TEST_EXE,{profile:get('--profile')});
  console.log(JSON.stringify(result,null,2));if(!result.valid)process.exitCode=1;
}
