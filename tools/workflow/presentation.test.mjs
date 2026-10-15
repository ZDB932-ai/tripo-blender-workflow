import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileRef,atomicJSON} from './production-io.mjs';
import {renderPresentation} from './presentation.mjs';

test('presentation binds actual media/source and never promotes a diagnostic',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'tripo-presentation-'));
  try{
    const put=(name,data)=>{fs.writeFileSync(path.join(base,name),data);return fileRef(base,name);};
    const source=put('draft.blend','synthetic draft'),other=put('old.blend','synthetic old'),media=put('preview.mp4','synthetic media');
    atomicJSON(path.join(base,'receipt.json'),{source,files:[media]});
    const manifest={title:'Draft',summary:'Pending',source,media:[{label:'Video',source_sha256:source.sha256,file:media,provenance:fileRef(base,'receipt.json')}]};
    const job={artifacts:{candidate:other,latest_diagnostic:source},gates:{final:{status:'accepted'}},local_revisions:{records:[]}};
    assert.match(renderPresentation(base,manifest,job),/未最终接受/);
    assert.throws(()=>renderPresentation(base,{...manifest,source:put('unknown.blend','unknown')},job),/not a recorded/);
    assert.throws(()=>renderPresentation(base,{...manifest,media:[{...manifest.media[0],source_sha256:other.sha256}]},job),/differs/);
    atomicJSON(path.join(base,'wrong.json'),{source:other,files:[media]});
    assert.throws(()=>renderPresentation(base,{...manifest,media:[{...manifest.media[0],provenance:fileRef(base,'wrong.json')}]},job),/provenance/);
    fs.writeFileSync(path.join(base,'preview.mp4'),'changed');
    assert.throws(()=>renderPresentation(base,manifest,job),/File changed/);
  }finally{
    assert.equal(path.dirname(base),os.tmpdir());assert.ok(path.basename(base).startsWith('tripo-presentation-'));
    fs.rmSync(base,{recursive:true,force:true});
  }
});
