export function qualityTemplate(motionRequired=false,options={}){
  const tier=options.delivery_tier;
  if(tier!==undefined&&!['concept_preview','static_asset','animated_asset','engine_asset'].includes(tier))throw Error('Unknown delivery tier');
  const rigRequired=options.rig_required??(motionRequired&&options.profile!=='articulated-prop');
  if(['concept_preview','static_asset'].includes(tier)&&(motionRequired||rigRequired||options.engine_required))throw Error('Static delivery tier cannot hide rig, animation or engine requirements');
  if(tier==='animated_asset'&&!motionRequired&&!rigRequired)throw Error('Animated delivery tier requires rig or motion');
  if(tier==='engine_asset'&&!options.engine_required)throw Error('Engine delivery tier requires an engine target');
  const structure=options.structure||(options.profile==='articulated-prop'?'rigid':'skinned');
  if(!['skinned','rigid','mixed'].includes(structure))throw Error('Unknown rig structure');
  const visual=description=>({kind:'visual',description});
  const assertion=description=>({kind:'assertion',description});
  const metric=(description,operator,unit,limit=null)=>({kind:'metric',description,operator,unit,limit});
  const template={
    schema_version:2,status:'draft',suite_id:'configure-asset-specific-suite',motion_required:motionRequired,rig_required:rigRequired,engine_required:Boolean(options.engine_required),profile:options.profile||(motionRequired||rigRequired?'deforming-character':'static-prop'),
    basis:'Fill from current user requirements and retained technical evidence; active means engineering requirements frozen, not user acceptance',
    structure,evidence_policy:{measurement_required:true,visual_required:true,capability_required:true},
    ...(structure==='mixed'?{structure_regions:{skinned:[],rigid:[]}}:{}),
    observation_conditions:{views:['front','side','back','three-quarter','joint-wireframe'],lighting:'fixed neutral',motion_sampling:'Freeze target clip, root-space removal, regions, contact phase and subframe schedule before comparison'},
    gates:{
      base_model:['design_identity','major_structure','repair_feasibility'],
      polish:['silhouette','geometry','uv_materials','editable_master'],
      rig:['rig_structure',...(structure==='rigid'?['rigid_attachments','joint_ranges']:structure==='mixed'?['structure_map','rigid_attachments','joint_ranges','weights']:['weights']),'deformation_readiness','protected_region','transition_stretch','transition_compression','joint_interfaces'],
      motion:['motion_intent','clips',...(structure==='rigid'?['rigid_attachments','joint_ranges']:['rig_structure','weights','deformation']),...(options.locomotion_contact?['sole_drift','sole_penetration']:[]),...(options.uses_ik?['ik_unreachable']:[])],
      engine:['engine_runtime','engine_budget'],
      final:['design_identity','file_dependencies','roundtrip','requested_deliverables']},
    criteria:{
      design_identity:visual('Identity/proportions match approved reference; same-view comparison'),
      major_structure:visual('No prohibited missing/extra parts or unintended adhesion'),
      repair_feasibility:assertion('Evidence-based repair route fits current scope and local cap'),
      silhouette:visual('Preserved silhouette/proportions compared under frozen views'),
      geometry:assertion('Classified mesh/interface defects resolved for intended use'),
      uv_materials:visual('UV/material appearance retained across changed and protected regions'),
      editable_master:assertion('Versioned editable master and dependencies exist'),
      deformation_readiness:visual('Actual stress poses preserve intended silhouette and interfaces'),
      protected_region:metric('Frozen protected-region displacement after intended root motion removed','lte','asset_height_ratio'),
      transition_stretch:metric('Maximum edge ratio in frozen transition region','lte','ratio'),
      transition_compression:metric('Minimum edge ratio in frozen transition region','gte','ratio'),
      joint_interfaces:visual('Certified real interfaces remain continuous; nearest-point candidates alone insufficient'),
      motion_intent:visual('Target motion, style and root trajectory match the current motion brief'),
      engine_runtime:assertion('Requested project/version imports and plays the exact exported files correctly'),
      engine_budget:assertion('Measured performance, scale, materials and collision meet target requirements'),
      rig_structure:assertion('Bone identity, hierarchy, rest pose and semantic influences verified'),
      rigid_attachments:assertion('Named rigid parts retain shape and attachment transforms through joint poses'),
      structure_map:assertion('Frozen skinned/rigid region definitions identify real objects or vertex regions, attachments and interfaces; each check covers the appropriate region'),
      joint_ranges:assertion('Named mechanical joints respect intended axes, limits and clearances'),
      weights:assertion('No unweighted vertices or abnormal remote-part influences; normalized weights'),
      deformation:visual('Full target clip and stress poses show no prohibited deformation'),
      clips:assertion('Clip duration, fps, root trajectory and loop behavior match motion brief'),
      sole_drift:metric('Frozen sole vertices during stance, including subframes','lte','asset_height_ratio'),
      sole_penetration:metric('Maximum ground penetration at frozen subframe samples','lte','asset_height_ratio'),
      ik_unreachable:metric('Unreachable target count in frozen sample schedule','eq','count',0),
      file_dependencies:assertion('Final files and required textures verified by hash'),
      roundtrip:assertion('Clean-file reimport and required animation playback verified'),
      requested_deliverables:assertion('Files and previews match current delivery request')}
  };
  if(tier)template.delivery_tier=tier;
  if(tier==='concept_preview'){
    // Concept delivery is explicitly a preview, never a silently weakened production asset.
    template.gates.polish=['silhouette','geometry','preview_materials','editable_master'];
    template.criteria.preview_materials=assertion('Preview material/untextured scope is explicit; no missing required dependencies or misleading final-material claim');
    template.observation_conditions.views=['front','three-quarter'];
    template.observation_conditions.motion_sampling='Not applicable: explicitly static concept preview';
  }
  if(structure==='rigid')for(const key of ['weights','protected_region','transition_stretch','transition_compression','joint_interfaces'])Object.assign(template.criteria[key],{applicable:false,exception_reason:'Rigid-part structure: shape, attachment, joint ranges and clearances are verified by rigid_attachments/joint_ranges; no continuous skin interface required'});
  return template;
}
