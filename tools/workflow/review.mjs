// All persisted quality gates use canonical production state.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const [asset,stage,report,...extra]=process.argv.slice(2);
if(!asset||!stage||!report||extra.length||['guided','autonomous'].includes(asset)){
  console.error('Usage: review.mjs ASSET STAGE REPORT_RELATIVE_TO_ASSET; legacy declaration-only review is disabled');
  process.exitCode=1;
}else{
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('./production.mjs',import.meta.url)),'evaluate',asset,stage,report],{stdio:'inherit'});
  process.exitCode=child.status??1;
}
