// Presentation is a verified projection, never a production acceptance command.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON,verifyRef,requireText,localFile} from './production-io.mjs';

export function renderPresentation(base,manifest,job){
  requireText(manifest.title,'Presentation title');
  verifyRef(base,manifest.source);
  const same=(a,b)=>a?.path===b?.path&&a?.sha256===b?.sha256;
  const known=[...Object.values(job.artifacts||{}).flat(),...(job.local_revisions?.records||[]).map(r=>r.output)].filter(Boolean);
  if(!known.some(r=>same(r,manifest.source)))throw Error('Presentation source is not a recorded artifact');
  let accepted=false;
  if(job.status==='accepted'&&job.gates?.final?.status==='accepted'&&same(job.artifacts.candidate,manifest.source)){
    const decision=readJSON(verifyRef(base,job.gates.final.decision));
    verifyRef(base,job.gates.final.report);
    accepted=decision.decision==='accepted'&&decision.stage==='final'&&decision.source_sha256===manifest.source.sha256&&decision.quality_spec_sha256===job.quality_spec?.sha256&&decision.report_sha256===job.gates.final.report.sha256;
  }
  const status=accepted?'已接受母版':'待审阅展示，未最终接受';
  requireText(manifest.summary,'Presentation summary');
  if(!manifest.media?.length)throw Error('Presentation media required');
  const link=(label,ref)=>`[${label.replace(/[\[\]\r\n]/g,' ')}](<${path.resolve(base,ref.path).replaceAll('\\','/')}>)`;
  const lines=[`# ${manifest.title.replace(/[\r\n]/g,' ')}`,'',`状态：${status}`,'',manifest.summary,'',link('展示源文件',manifest.source),`源 SHA256：${manifest.source.sha256}`,''];
  for(const item of manifest.media){
    requireText(item.label,'Media label');
    if(item.source_sha256!==manifest.source.sha256)throw Error('Preview source differs from display source');
    verifyRef(base,item.file);
    verifyRef(base,item.provenance);
    const receipt=readJSON(verifyRef(base,item.provenance));
    if(!same(receipt.source,manifest.source)||!receipt.files?.some(f=>same(f,item.file)))throw Error('Preview provenance does not bind source and media');
    lines.push('- '+link(item.label,item.file));
  }
  lines.push('','## 制作记录中的角色','');
  for(const key of ['candidate','latest_diagnostic','best_motion_draft','display_master']){
    const ref=job.artifacts[key];
    if(ref){verifyRef(base,ref);lines.push(`- ${key}：${link(ref.path,ref)}`);}
  }
  lines.push('','此索引由 presentation.json 和 production.json 生成；不会选择候选或批准质量。媒体归属声明仍需实际渲染/回读证据，哈希不能证明画面内容正确。','');
  return lines.join('\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [id,mode='check']=process.argv.slice(2);
  if(!/^[a-z0-9-]+$/.test(id||'')||!['check','write'].includes(mode))throw Error('Usage: presentation.mjs ASSET [check|write]');
  const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../assets',id);
  const output=renderPresentation(base,readJSON(localFile(base,'presentation.json')),readJSON(localFile(base,'production.json')));
  if(mode==='write'){
    const current=localFile(base,'CURRENT.md');
    if(fs.existsSync(current)){
      fs.mkdirSync(path.join(base,'index-history'),{recursive:true});
      fs.copyFileSync(current,path.join(base,'index-history',`CURRENT-${Date.now()}.md`));
    }
    fs.writeFileSync(current,output,'utf8');
  }
  console.log(JSON.stringify({valid:true,written:mode==='write'}));
}
