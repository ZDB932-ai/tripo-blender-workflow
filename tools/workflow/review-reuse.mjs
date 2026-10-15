// Evidence reuse never rewrites a previous report, decision or source identity.
import {readJSON,verifyRef,requireText} from './production-io.mjs';

export const DOMAINS=['geometry','uv','materials','rig','animation','scene'];
// Unknown checks conservatively require all domains. A spec may add, never subtract.
const CHECK_DOMAINS={
  geometry:['geometry'],major_structure:['geometry','materials','scene'],
  design_identity:['geometry','uv','materials','scene'],silhouette:['geometry','scene'],
  uv_materials:['geometry','uv','materials','scene'],
  rig_structure:['geometry','rig'],weights:['geometry','rig'],
  clips:['geometry','rig','animation','scene'],
  motion_intent:['geometry','rig','animation','scene'],
  deformation:['geometry','rig','animation','scene'],deformation_readiness:['geometry','rig','animation','scene'],
  protected_region:['geometry','rig','animation','scene'],transition_stretch:['geometry','rig','animation','scene'],
  transition_compression:['geometry','rig','animation','scene'],joint_interfaces:['geometry','rig','animation','scene'],
  sole_drift:['geometry','rig','animation','scene'],sole_penetration:['geometry','rig','animation','scene'],
  ik_unreachable:['geometry','rig','animation','scene'],rigid_attachments:['geometry','rig','animation','scene'],
  joint_ranges:['geometry','rig','animation','scene'],structure_map:['geometry','rig'],
};
export function requiredDomains(spec,kind){
  if(['preflight','rhythm'].includes(kind))return ['geometry','rig','animation','scene'];
  const names=spec.gates?.[kind];if(!names?.length)throw Error('Reuse gate has no criteria');
  return [...new Set(names.filter(n=>spec.criteria?.[n]?.applicable!==false).flatMap(n=>CHECK_DOMAINS[n]||DOMAINS))];
}
export function reuseDependencyProblems(spec){
  const contract=spec.reuse_contract;
  if(!contract)return [];
  return Object.entries(contract.dependencies).flatMap(([kind,configured])=>{
    const missing=requiredDomains(spec,kind).filter(x=>!configured.includes(x));
    return missing.length?[{kind,missing}]:[];
  });
}
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function validateReuseContract(c){
  if(!c)return;
  if(c.version!==1||!hash(c.collector_sha256))throw Error('Reuse collector/version required');
  requireText(c.blender_version,'Reuse Blender version');
  if(!c.dependencies||typeof c.dependencies!=='object')throw Error('Reuse dependencies required');
  for(const [key,domains] of Object.entries(c.dependencies)){
    if(!['base_model','polish','rig','motion','preflight','rhythm'].includes(key)||!Array.isArray(domains)||!domains.length||new Set(domains).size!==domains.length||domains.some(x=>!DOMAINS.includes(x)))throw Error('Invalid reuse dependency: '+key);
  }
}
export function verifyUnchanged(base,spec,kind,proofRef,from,to){
  const c=spec.reuse_contract;validateReuseContract(c);
  const required=c?.dependencies?.[kind];
  if(!required)throw Error('No frozen reuse dependencies: '+kind);
  const missing=requiredDomains(spec,kind).filter(x=>!required.includes(x));
  if(missing.length)throw Error('Reuse dependencies omit mandatory domains: '+missing.join(', '));
  verifyRef(base,from);verifyRef(base,to);
  const proof=readJSON(verifyRef(base,proofRef));
  if(proof.source_sha256!==from.sha256||proof.output_sha256!==to.sha256)throw Error('Reuse proof source mismatch');
  const a=readJSON(verifyRef(base,proof.before)),b=readJSON(verifyRef(base,proof.after));
  for(const [d,source] of [[a,from],[b,to]]){
    if(d.schema_version!==1||d.source_sha256!==source.sha256||d.collector_sha256!==c.collector_sha256||d.blender_version!==c.blender_version)throw Error('Reuse snapshot identity/collector mismatch');
  }
  for(const name of required){
    if(!hash(a.domains?.[name])||!hash(b.domains?.[name])||a.domains[name]!==b.domains[name])throw Error('Changed or unmeasured dependency: '+name);
  }
  return true;
}
export function verifyReuseChain(base,job,spec,kind,reuse){
  if(!reuse?.links?.length||reuse.links.length>100||reuse.quality_spec_sha256!==job.quality_spec.sha256)throw Error('Invalid reuse chain/spec');
  let source=reuse.origin;
  for(const link of reuse.links){
    verifyUnchanged(base,spec,kind,link.proof,source,link.target);source=link.target;
  }
  if(source.path!==job.artifacts.candidate.path||source.sha256!==job.artifacts.candidate.sha256)throw Error('Reuse chain does not reach current candidate');
  return reuse.origin;
}
export function extendReuse(existing,origin,target,proof,quality){
  return {origin:existing?.origin||origin,quality_spec_sha256:quality.sha256,links:[...(existing?.links||[]),{target,proof}]};
}
