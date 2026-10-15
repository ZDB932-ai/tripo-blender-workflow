import {isDeepStrictEqual} from 'node:util';
import {readJSON,verifyRef,requireText} from './production-io.mjs';

const mappingFields=new Set(['object','indices','topology_sha256']);
const semanticRegion=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!mappingFields.has(k)));
export function validateRegionVariants(contract){
  if(!contract.region_variants)return;
  if(!Array.isArray(contract.region_variants)||!contract.region_variants.length)throw Error('Region variants required');
  const ids=new Set();
  for(const variant of contract.region_variants){
    requireText(variant.id,'Region variant identity');
    if(ids.has(variant.id))throw Error('Duplicate region variant');ids.add(variant.id);
    requireText(variant.basis,'Correspondence semantic basis');
    if(!Number.isFinite(variant.max_reference_error)||variant.max_reference_error<0)throw Error('Frozen mapping error limit required');
    if(!variant.evidence?.length||!variant.baseline_source||!variant.baseline_measurement)throw Error('Mapping baseline/evidence required');
    const original=contract.conditions.regions;
    if(!Array.isArray(variant.regions)||variant.regions.length!==original.length)throw Error('Mapped regions must retain coverage');
    original.forEach((r,i)=>{
      const mapped=variant.regions[i];
      if(!isDeepStrictEqual(semanticRegion(r),semanticRegion(mapped)))throw Error('Mapped region semantics/conditions changed');
      if(!Array.isArray(r.sample_ids)||r.sample_ids.length!==r.indices.length||new Set(r.sample_ids).size!==r.sample_ids.length||r.sample_ids.some(x=>typeof x!=='string'||!x.trim()))throw Error('Named correspondence samples required');
      if(!Array.isArray(mapped.indices)||mapped.indices.length!==r.indices.length||new Set(mapped.indices).size!==mapped.indices.length||mapped.indices.some(x=>!Number.isInteger(x)||x<0))throw Error('Mapped sample coverage changed');
      if(!/^[a-f0-9]{64}$/.test(mapped.topology_sha256||''))throw Error('Mapped topology hash required');
      requireText(mapped.object,'Mapped object');
      if(r.kind==='transition'&&(!r.sample_edges?.length||r.sample_edges.some(e=>!Array.isArray(e)||e.length!==2||e[0]===e[1]||e.some(x=>!Number.isInteger(x)||x<0||x>=r.indices.length))))throw Error('Cross-topology strain requires frozen sample edges');
    });
  }
}
function verifyBase(base,contract,raw,config,sourceHash,regions){
  if(raw.source_sha256!==sourceHash||config.source_sha256!==sourceHash||raw.suite_id!==config.suite_id)throw Error('Measurement config identity mismatch');
  if(raw.collector_sha256!==contract.collector_sha256||raw.blender_version!==contract.blender_version||(config.blender_version!==undefined&&config.blender_version!==contract.blender_version))throw Error('Measurement collector/runtime mismatch');
  for(const [key,value] of Object.entries(contract.conditions))if(!isDeepStrictEqual(config[key],key==='regions'?regions:value))throw Error('Measurement conditions changed: '+key);
}
export function verifyMeasurementContract(base,contract,raw,sourceHash){
  const config=readJSON(verifyRef(base,raw.config));
  const variant=config.mapping_variant===undefined?null:contract.region_variants?.find(v=>v.id===config.mapping_variant);
  if(config.mapping_variant!==undefined&&!variant)throw Error('Unfrozen region variant');
  verifyBase(base,contract,raw,config,sourceHash,variant?.regions||contract.conditions.regions);
  if(!variant)return;
  if(config.blender_version!==contract.blender_version)throw Error('Mapped measurement config runtime required');
  validateRegionVariants(contract);
  variant.evidence.forEach(ref=>verifyRef(base,ref));verifyRef(base,variant.baseline_source);
  const before=readJSON(verifyRef(base,variant.baseline_measurement));
  const beforeConfig=readJSON(verifyRef(base,before.config));
  if(beforeConfig.mapping_variant!==undefined||before.suite_id!==raw.suite_id)throw Error('Mapping requires original same-suite baseline');
  verifyBase(base,contract,before,beforeConfig,variant.baseline_source.sha256,contract.conditions.regions);
  if(!Number.isFinite(config.scale)||config.scale<=0)throw Error('Mapping scale invalid');
  for(const region of variant.regions){
    const original=contract.conditions.regions.find(r=>r.name===region.name);
    const a=before.regions?.[region.name],b=raw.regions?.[region.name];
    for(const [data,expected] of [[a,original],[b,region]]){
      if(data?.topology_sha256!==expected.topology_sha256||data.object!==expected.object||data.space!==expected.space||!Array.isArray(data.reference_positions)||data.reference_positions.length!==expected.indices.length)throw Error('Mapping raw coverage/identity mismatch');
    }
    for(let i=0;i<region.indices.length;i++){
      const x=a.reference_positions[i],y=b.reference_positions[i];
      if(!Array.isArray(x)||!Array.isArray(y)||x.length!==3||y.length!==3||![...x,...y].every(Number.isFinite))throw Error('Mapping coordinates invalid');
      if(Math.hypot(...x.map((v,j)=>v-y[j]))/config.scale>variant.max_reference_error)throw Error('Mapping reference error exceeds frozen limit');
    }
  }
}
