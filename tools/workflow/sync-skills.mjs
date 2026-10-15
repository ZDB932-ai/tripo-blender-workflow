// Source -> installed skills only. Defaults to preview; never removes extra files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './production-io.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const [installed,...flags]=process.argv.slice(2);
if(!installed||flags.some(f=>f!=='--apply'))throw Error('Usage: sync-skills.mjs INSTALLED_SKILL_ROOT [--apply]');
const targetRoot=path.resolve(installed),sourceRoot=path.join(root,'skills');
if(targetRoot===sourceRoot)throw Error('Source and install root must differ');
const relative=path.relative(root,targetRoot);
if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('Installation root must be outside this project');
const walk=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(d=>{
  if(d.isSymbolicLink())throw Error('Skill symlinks require manual review');
  return d.isDirectory()?walk(path.join(folder,d.name)):[path.join(folder,d.name)];
});
const files=walk(sourceRoot),changes=[];
for(const file of files){
  const rel=path.relative(sourceRoot,file),target=path.join(targetRoot,rel);
  let ancestor=target;
  while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  const real=fs.realpathSync(ancestor),realRoot=fs.existsSync(targetRoot)?fs.realpathSync(targetRoot):targetRoot;
  if(fs.existsSync(targetRoot)){
    const r=path.relative(realRoot,real);if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r))throw Error('Installation symlink escapes root');
  }
  if(!fs.existsSync(target)||sha256(file)!==sha256(target))changes.push({source:file,target,relative:rel});
}
let backup=null;
if(flags.includes('--apply')&&changes.length){
  backup=path.join(root,'designs','skill-backups','installed-maturity-'+new Date().toISOString().replace(/[:.]/g,'-'));
  for(const c of changes){
    if(fs.existsSync(c.target)){const b=path.join(backup,c.relative);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(c.target,b);}
    fs.mkdirSync(path.dirname(c.target),{recursive:true});fs.copyFileSync(c.source,c.target);
    if(sha256(c.source)!==sha256(c.target))throw Error('Installed copy verification failed');
  }
}
console.log(JSON.stringify({applied:flags.includes('--apply'),compared:files.length,changed:changes.map(c=>c.relative),backup},null,2));
