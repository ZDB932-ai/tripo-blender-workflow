import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {textureRoute} from './texture-route.mjs';import {fileRef} from './production-io.mjs';
test('texture choices preserve prerequisites, evidence and pending transfers',()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'texture-route-'));
 try{
 fs.writeFileSync(path.join(base,'mesh.blend'),'fixture');fs.writeFileSync(path.join(base,'evidence.txt'),'observed missing');fs.writeFileSync(path.join(base,'quality.json'),JSON.stringify({animation_workflow:{}}));
 const source=fileRef(base,'mesh.blend'),job={requirements:{motion_required:true,rig_required:true},artifacts:{candidate:source},quality_spec:fileRef(base,'quality.json')};const save=()=>fs.writeFileSync(path.join(base,'production.json'),JSON.stringify(job));save();
 const c={source,texture_status:'missing',evidence:[fileRef(base,'evidence.txt')]};assert.equal(textureRoute(base,c).action,'ask_texture_choice');
 c.choice={value:'generate_first',source_sha256:source.sha256,evidence:'User chooses texture first'};assert.equal(textureRoute(base,c).action,'complete_geometry_preflight');
 c.choice.value='continue_untextured';assert.equal(textureRoute(base,c).action,'transfer_untextured_as_chosen');
 c.texture_status='present';assert.equal(textureRoute(base,c).action,'verify_export_dependencies');c.export_dependencies_verified=true;assert.equal(textureRoute(base,c).action,'transfer_existing_texture');
 c.texture_status='unknown';assert.equal(textureRoute(base,c).action,'inspect_texture');
 job.transfer={status:'unknown'};save();assert.equal(textureRoute(base,c).action,'reconcile_transfer');
 delete job.transfer;job.requirements={motion_required:false,rig_required:false};save();c.texture_status='missing';c.choice.value='generate_first';assert.equal(textureRoute(base,c).action,'prepare_texture_submission');assert.equal(textureRoute(base,c).can_submit,false);
 c.choice.source_sha256='bad';assert.throws(()=>textureRoute(base,c));
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});
