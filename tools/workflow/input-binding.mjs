import {isDeepStrictEqual} from 'node:util';
import {readJSON,verifyRef,requireText} from './production-io.mjs';

export function sourceInput(plan){
  if(plan.input)return plan.input;
  if(plan.source_file)return {kind:'local_file',file:{path:plan.source_file,sha256:plan.source_sha256},format:plan.source_file.split('.').at(-1)};
  throw Error('Processing input identity required');
}
export function verifyPreflightInput(base,job,plan,observation){
  const input=sourceInput(plan),candidate=job.artifacts.candidate;
  verifyRef(base,candidate);
  if(!isDeepStrictEqual(observation.source_input,input))throw Error('Observed processing input differs from planned source');
  if(input.kind==='local_file'){
    verifyRef(base,input.file);
    if(input.file.sha256===candidate.sha256&&input.file.path===candidate.path)return {relation:'exact_candidate'};
  }else if(input.kind==='studio_asset'){
    requireText(input.asset_url,'Studio asset URL');requireText(input.version,'Studio version');verifyRef(base,input.evidence);
  }else if(input.kind==='bridge_receipt'){
    verifyRef(base,input.file);verifyRef(base,input.receipt);
  }else throw Error('Unknown processing input kind');
  const binding=readJSON(verifyRef(base,plan.preflight_input_binding));
  if(binding.schema_version!==1||binding.job_id!==job.job_id||binding.candidate?.path!==candidate.path||binding.candidate?.sha256!==candidate.sha256||binding.quality_spec_sha256!==job.quality_spec.sha256||binding.checkpoint_sha256!==job.animation_reviews?.preflight?.sha256||!isDeepStrictEqual(binding.input,input))throw Error('Preflight input binding identity mismatch');
  if(binding.relation!=='verified_geometry_equivalence')throw Error('Input equivalence must be explicitly verified');
  const comparison=readJSON(verifyRef(base,binding.comparison));
  if(comparison.candidate_sha256!==candidate.sha256||!isDeepStrictEqual(comparison.input,input))throw Error('Input comparison source mismatch');
  // This is an explicit, source-bound audit, not a claim that a URL or hash proves geometry quality.
  for(const name of ['geometry','scale_axes','rig_correspondence']){
    const rows=comparison.checks?.filter(x=>x.name===name);
    if(rows?.length!==1||rows[0].status!=='pass')throw Error('Input equivalence check missing/failed: '+name);
    requireText(rows[0].observation,'Input equivalence observation');
    if(!rows[0].evidence?.length)throw Error('Input equivalence evidence required');
    rows[0].evidence.forEach(r=>verifyRef(base,r));
  }
  return binding;
}
