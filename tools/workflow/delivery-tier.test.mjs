import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qualityTemplate} from './quality-template.mjs';
import {validateSpec} from './quality.mjs';

test('concept preview has explicit reduced material expectations without removing identity or file verification',()=>{
  const spec=qualityTemplate(false,{delivery_tier:'concept_preview'});validateSpec(spec);
  assert.ok(spec.gates.base_model.includes('design_identity'));assert.ok(spec.gates.polish.includes('geometry'));
  assert.ok(spec.gates.polish.includes('preview_materials'));assert.ok(!spec.gates.polish.includes('uv_materials'));
  assert.ok(spec.gates.final.includes('roundtrip'));assert.ok(spec.gates.final.includes('file_dependencies'));
  assert.deepEqual(spec.observation_conditions.views,['front','three-quarter']);
  assert.equal(spec.evidence_policy.visual_required,true);
});
test('delivery tiers cannot label animation or engine output as a static preview',()=>{
  assert.throws(()=>qualityTemplate(true,{delivery_tier:'concept_preview'}),/cannot hide/);
  assert.throws(()=>qualityTemplate(false,{delivery_tier:'concept_preview',engine_required:true}),/cannot hide/);
  assert.throws(()=>qualityTemplate(false,{delivery_tier:'animated_asset'}),/requires rig/);
  assert.throws(()=>qualityTemplate(false,{delivery_tier:'engine_asset'}),/requires an engine/);
  for(const spec of [qualityTemplate(false,{delivery_tier:'static_asset'}),qualityTemplate(true,{delivery_tier:'animated_asset'}),qualityTemplate(false,{delivery_tier:'engine_asset',engine_required:true})])validateSpec(spec);
  const stale=qualityTemplate(true);stale.delivery_tier='concept_preview';assert.throws(()=>validateSpec(stale),/cannot hide/);
});
