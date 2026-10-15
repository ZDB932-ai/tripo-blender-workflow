import fs from 'node:fs';
import path from 'node:path';
import {root} from './workflow.mjs';
import {newProduction,projection} from './production.mjs';
import {fileRef} from './production-io.mjs';
import {qualityTemplate} from './quality-template.mjs';
import {defaultCreditAuthorization} from './policy.mjs';
const id=process.argv[2];
if(['--help','-h'].includes(id)){console.log('Usage: node tools/workflow/scaffold.mjs asset-id\nCreates a draft only; configure real requirements, reference approval and budgets before production. See docs/workflow/operator-guide.md.');process.exit(0);}
if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Usage: node tools/workflow/scaffold.mjs asset-id');
const base=path.join(root,'assets',id);
if(fs.existsSync(base))throw Error('Asset exists; inspect and resume rather than overwrite');
fs.mkdirSync(base,{recursive:true});
for(const d of ['references/originals','reference_sets','runs'])fs.mkdirSync(path.join(base,d),{recursive:true});
const write=(name,obj)=>fs.writeFileSync(path.join(base,name),JSON.stringify(obj,null,2)+'\n',{flag:'wx'});
write('brief.json',{schema_version:1,asset_id:id,title:null,intent:null,engine:null,rigging:null,scale_meters:null,preserve:[],acceptance:[],unresolved:[]});
write('intake-v001.json',{schema_version:1,intent:null,animation:{status:'unresolved',use:null,evidence:null,motion_intent:null,design_implications:null}});
write('reference-contract.json',{schema_version:1,input_contract:'adaptive_reference_v1',default_views:['front','left','right','back'],single_image_profiles:['simple_static','concept'],submission:'Choose reviewed input by asset complexity; animation and complex/character assets use four independent views'});
write('workflow-policy.json',{schema_version:1,credit_authorization:defaultCreditAuthorization,review_mode:'guided',status:'needs_configuration',evidence:null,reference_input_contract:'adaptive_reference_v1',allowed_backends:['tripo_studio_browser'],allowed_operations:[],studio_credit_cap:null,max_paid_runs:null,max_local_revision_rounds:null,reference_manifest_sha256:null,quality_profile:null,quality_spec_sha256:null});
fs.copyFileSync(path.join(root,'tools/workflow/quality-spec.template.json'),path.join(base,'quality-spec.json'));
// G0/submission requirements remain distinct from the versioned production criteria.
write('production-quality-v001.json',qualityTemplate(false));
const production=newProduction(id,fileRef(base,'production-quality-v001.json'));
// New jobs must configure classified budgets explicitly. Existing jobs retain their total cap.
production.animation_workflow_required=true;
production.local_revisions.budgets={repair:0,diagnostic:0,creation:0,export:0};
production.local_revisions.enforce_total=false;
production.local_revisions.limit_basis='Configure per-operation budgets from the actual authorized scope';
write('production.json',production);
write('handoff.json',projection(production));
console.log(base);
