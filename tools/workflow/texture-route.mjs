import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON,verifyRef} from './production-io.mjs';
import {animated,requireCheckpoint} from './animation-review.mjs';
// Read-only advisory routing. Never authorizes submission or changes production state.
export function textureRoute(base,check){
 const job=readJSON(path.join(base,'production.json'));
 verifyRef(base,check.source);
 if(check.source.sha256!==job.artifacts.candidate.sha256||check.source.path!==job.artifacts.candidate.path)throw Error('Texture check is not for current candidate');
 if(!['present','missing','unknown'].includes(check.texture_status))throw Error('Texture status required');
 if(!check.evidence?.length)throw Error('Texture evidence required');check.evidence.forEach(r=>verifyRef(base,r));
 if(job.transfer&&['sending','unknown'].includes(job.transfer.status))return {action:'reconcile_transfer',can_submit:false};
 if(check.texture_status==='unknown')return {action:'inspect_texture',can_submit:false};
 if(check.texture_status==='present')return {action:check.export_dependencies_verified===true?'transfer_existing_texture':'verify_export_dependencies',can_submit:false};
 const choice=check.choice;
 if(choice&&!['generate_first','continue_untextured'].includes(choice.value))throw Error('Unknown texture choice');
 if(choice&&(!choice.evidence?.trim()||choice.source_sha256!==check.source.sha256))throw Error('Texture choice lacks current-source user evidence');
 let blocker=null;
 if(animated(job)){
  try{const spec=readJSON(verifyRef(base,job.quality_spec));if(!spec.animation_workflow)throw Error('Animation workflow must be configured');requireCheckpoint(base,job,spec,'preflight');}catch(e){blocker=e.message;}
 }
 if(!choice)return {action:'ask_texture_choice',can_submit:false,blocker,sequence:blocker?'isolated_geometry_preflight_then_texture_then_colored_import':'texture_preflight_then_generation_then_import'};
 if(choice.value==='continue_untextured')return {action:'transfer_untextured_as_chosen',can_submit:false};
 return {action:blocker?'complete_geometry_preflight':'prepare_texture_submission',can_submit:false,blocker,note:'Reuse choice; verify actual quote, compatible input and authorization through normal submission checks.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [base,file]=process.argv.slice(2);console.log(JSON.stringify(textureRoute(path.resolve(base),readJSON(file)),null,2));
}
