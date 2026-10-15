// Synthetic CLI fixture; never represents real user approval or uploaded media.
import fs from 'node:fs';
import path from 'node:path';
import {atomicJSON,fileRef} from './production-io.mjs';
export function submissionFixture(base){
  const put=(p,v)=>{atomicJSON(path.join(base,p),v);return fileRef(base,p);};
  fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,'ref.png'),'synthetic reference');
  fs.writeFileSync(path.join(base,'ui.txt'),'synthetic UI observation');
  const intake=put('intake.json',{intent:'synthetic prop',animation:{status:'confirmed',use:'static',evidence:'Synthetic static request'}});
  const reference={files:[{...fileRef(base,'ref.png'),role:'front'}],intake,preparation:{route:'original',assessment:'usable',intake_sha256:intake.sha256,animation_considerations:'Synthetic static prop',checks:[{name:'identity',status:'pass',observation:'Synthetic clear reference'}]},decision:{status:'approved',evidence:'Synthetic user review'}};
  const referenceRef=put('ref.json',reference);
  const plan={reference_manifest:'ref.json',reference_manifest_sha256:referenceRef.sha256,intake_sha256:intake.sha256,operation:'generate',backend:'tripo_studio_browser',billing_source:'studio',candidate_count:1,quoted_credits:45,observed_at:new Date().toISOString(),ui_evidence:'ui.txt',settings:{mode:'synthetic image mode',model:'synthetic model'}};
  const ui={reference_manifest_sha256:referenceRef.sha256,intake_sha256:intake.sha256,operation:plan.operation,observed_at:plan.observed_at,quoted_credits:plan.quoted_credits,page_url:'https://example.invalid/fixture',target_description:'synthetic generate button',selection_reason:'Synthetic static use',unique_target:true,settings_match:true,actual_settings:plan.settings,animation_use:'static',evidence:[fileRef(base,'ui.txt')],uploaded_files:[fileRef(base,'ref.png')],input_layout:'Synthetic single-image input'};
  plan.ui_verification=put('ui-verification.json',ui);
  return {put,reference,plan,ui,intake};
}
