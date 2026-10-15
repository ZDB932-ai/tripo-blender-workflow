import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function requireText(value,label){
  if(typeof value!=='string'||!value.trim())throw Error(`${label} required`);
  return value;
}
export function localFile(base,relative){
  requireText(relative,'Relative path');
  const absolute=path.resolve(base,relative), rel=path.relative(path.resolve(base),absolute);
  if(path.isAbsolute(relative)||!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Path escapes asset');
  // Outputs need the same containment check as existing evidence. A missing
  // leaf can still sit below a junction pointing outside this asset.
  let ancestor=absolute;
  while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  {
    const realRel=path.relative(fs.realpathSync(base),fs.realpathSync(ancestor));
    if(realRel==='..'||realRel.startsWith('..'+path.sep)||path.isAbsolute(realRel))throw Error('Symlink escapes asset');
  }
  return absolute;
}
export function fileRef(base,relative){return {path:relative,sha256:sha256(localFile(base,relative))};}
export function verifyRef(base,ref){
  if(!ref||!/^[a-f0-9]{64}$/.test(ref.sha256||''))throw Error('File reference/hash required');
  const file=localFile(base,ref.path);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw Error(`Evidence/source missing: ${ref.path}`);
  if(sha256(file)!==ref.sha256)throw Error(`File changed: ${ref.path}`);
  return file;
}
export function atomicJSON(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try{fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
