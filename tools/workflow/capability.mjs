import {readJSON,verifyRef,requireText} from './production-io.mjs';

export const properties=['topology','uv','materials','rig','animation','objects','scale'];
export function validateCapability(base,plan,spec){
  if(plan.operation==='diagnostic')return null;
  if(!plan.capability){
    if(spec.evidence_policy?.capability_required)throw Error('Operation capability contract required');
    return null;
  }
  const c=readJSON(verifyRef(base,plan.capability));
  if(c.operation!==plan.operation)throw Error('Capability operation mismatch');
  for(const key of ['method','route','runtime','version','input_format','output_format','basis'])requireText(c[key],'Capability '+key);
  if(!['blender','tripo'].includes(c.route))throw Error('Unknown capability route');
  // This entry is local execution. Remote Studio uses its separately authorized plan.
  if(c.route!=='blender')throw Error('Remote capability must use Studio preflight/generate');
  if(c.runtime!=='Blender')throw Error('Local capability runtime must be Blender');
  if(plan.execution?.blender_version!==c.version)throw Error('Capability must freeze execution version');
  if(plan.operation==='export'&&c.output_format.toLowerCase()!==plan.format.toLowerCase())throw Error('Capability export format mismatch');
  const suffix=plan.output_path.split('.').pop().toLowerCase();
  if(suffix!==c.output_format.toLowerCase())throw Error('Capability reserved output format mismatch');
  if(!c.evidence?.length)throw Error('Capability compatibility evidence required');
  c.evidence.forEach(ref=>verifyRef(base,ref));
  for(const name of properties){
    const p=c.properties?.[name];
    if(!p||!['preserve','change','absent'].includes(p.disposition))throw Error('Explicit property disposition required: '+name);
    requireText(p.reason,'Property reason '+name);requireText(p.verification,'Property verification method '+name);
  }
  return c;
}

export function verifyCapabilityResult(base,plan,spec,round,result){
  const c=validateCapability(base,plan,spec);
  if(!c)return true;
  const report=readJSON(verifyRef(base,result.capability_report));
  if(report.contract_sha256!==plan.capability.sha256||report.source_sha256!==round.baseline.sha256||report.output_sha256!==result.candidate.sha256||report.runtime!==c.runtime||report.version!==c.version||report.input_format!==c.input_format||report.output_format!==c.output_format)throw Error('Capability result identity mismatch');
  if(!Array.isArray(report.checks)||report.checks.length!==properties.length||new Set(report.checks.map(x=>x.name)).size!==properties.length)throw Error('Capability property checks incomplete');
  for(const name of properties){
    const check=report.checks.find(x=>x.name===name);
    if(!check||!['pass','fail','unknown'].includes(check.status))throw Error('Invalid capability check: '+name);
    requireText(check.observation,'Capability observation '+name);
    if(!check.evidence?.length)throw Error('Capability verification evidence required');
    check.evidence.forEach(ref=>verifyRef(base,ref));
  }
  // Even absent properties need evidence that no unexpected feature appeared.
  return report.checks.every(x=>x.status==='pass');
}
