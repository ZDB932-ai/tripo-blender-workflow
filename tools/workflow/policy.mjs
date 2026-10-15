import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const defaultCreditAuthorization={mode:'autonomous_existing_balance',evidence:'User instruction 2026-10-14: Tripo额度默认不询问用户，任务范围内自己消耗；docs/workflow/credit-policy.md'};
export function autonomousCredits(p){
  return p?.credit_authorization?.mode==='autonomous_existing_balance'&&typeof p.credit_authorization.evidence==='string'&&Boolean(p.credit_authorization.evidence.trim());
}
export function creditApproval(base,plan,planHash){
  const file=path.join(base,'workflow-policy.json');
  if(!fs.existsSync(file))return null;
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!autonomousCredits(p))return null;
  if(plan.backend!=='tripo_studio_browser'||plan.billing_source!=='studio')throw Error('Autonomous credits cover existing Studio balance only');
  if(!Number.isFinite(plan.quoted_credits)||plan.quoted_credits<0)throw Error('Missing quote');
  return {status:'approved',authorization_kind:'standing_user_instruction',plan_sha256:planHash,max_credits:plan.quoted_credits,evidence:p.credit_authorization.evidence};
}

export function validatePolicy(p) {
  if(!['guided','autonomous'].includes(p.review_mode))throw Error('Invalid review mode');
  if(p.status!=='approved'||!p.evidence)throw Error('Execution scope not approved');
  if(!Array.isArray(p.allowed_operations)||!p.allowed_operations.length)throw Error('Allowed operations missing');
  if(!Array.isArray(p.allowed_backends)||!p.allowed_backends.length)throw Error('Allowed backends missing');
  if(!autonomousCredits(p)){
    if(!Number.isFinite(p.studio_credit_cap)||p.studio_credit_cap<0)throw Error('Budget undefined');
    if(!Number.isInteger(p.max_paid_runs)||p.max_paid_runs<1)throw Error('Attempt limit undefined');
  }
  if(!Number.isInteger(p.max_local_revision_rounds)||p.max_local_revision_rounds<0)throw Error('Local revision limit undefined');
  if(!/^[a-f0-9]{64}$/.test(p.reference_manifest_sha256||''))throw Error('Approved reference hash missing');
  return p;
}
export function checkScope(p, plan, previousRuns=[]) {
  validatePolicy(p);
  if(!p.allowed_backends.includes(plan.backend))throw Error('Backend outside scope');
  if(!p.allowed_operations.includes(plan.operation))throw Error('Operation outside scope');
  if(p.reference_manifest_sha256!==plan.reference_manifest_sha256)throw Error('Reference outside scope');
  if(!Number.isFinite(plan.quoted_credits)||plan.quoted_credits<0)throw Error('Quote undefined');
  // Every non-planned attempt remains charged/reserved, including failures and unknown submissions.
  // Refunds require a later audited ledger implementation; do not release uncertain reservations.
  const active=previousRuns.filter(r=>r.status!=='planned');
  let reserved=0;
  const automatic=autonomousCredits(p);
  if(automatic&&plan.billing_source!=='studio')throw Error('Autonomous credits cover existing Studio balance only');
  if(automatic&&active.some(r=>['submitting','submission_unknown','processing'].includes(r.status)))throw Error('Reconcile pending remote submission before spending again');
  let unknownCosts=0;
  for(const r of active){if(!Number.isFinite(r.quoted_credits)||r.quoted_credits<0){if(!automatic)throw Error('Historical cost unknown');unknownCosts++;}else reserved+=r.quoted_credits;}
  if(automatic)return {credit_mode:'autonomous_existing_balance',reserved:unknownCosts?null:reserved,known_reserved:reserved,unknown_cost_runs:unknownCosts,remaining:null,attempts:active.length};
  if(active.length+1>p.max_paid_runs)throw Error('Attempt limit exceeded');
  if(reserved+plan.quoted_credits>p.studio_credit_cap)throw Error('Cumulative budget exceeded');
  return {reserved,remaining:p.studio_credit_cap-reserved-plan.quoted_credits};
}
export function checkAssetScope(base,runId,plan){
  const file=path.join(base,'workflow-policy.json');
  if(!fs.existsSync(file))throw Error('Workflow policy missing; historical records remain readable but new submissions require explicit scope');
  const policy=JSON.parse(fs.readFileSync(file,'utf8'));
  const specBytes=fs.readFileSync(path.join(base,'quality-spec.json'));
  const spec=JSON.parse(specBytes.toString('utf8'));
  if(spec.status!=='approved'||!spec.evidence)throw Error('Quality requirements not approved');
  if(crypto.createHash('sha256').update(specBytes).digest('hex')!==policy.quality_spec_sha256)throw Error('Quality requirements changed');
  const runsPath=path.join(base,'runs');
  const previous=fs.readdirSync(runsPath,{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!==runId).map(d=>{
    const folder=path.join(runsPath,d.name);
    const state=JSON.parse(fs.readFileSync(path.join(folder,'state.json'),'utf8'));
    const old=JSON.parse(fs.readFileSync(path.join(folder,'plan.json'),'utf8'));
    return {status:state.status,quoted_credits:old.quoted_credits};
  });
  return checkScope(policy,plan,previous);
}
export function reviewGate(mode,stage,checks,requiredNames,exceptions=[]){
  if(!['guided','autonomous'].includes(mode)||!['reference','base_model','polish','motion','final'].includes(stage))throw Error('Unknown review gate');
  if(!Array.isArray(checks)||!checks.length) return {action:'blocked',reason:'No technical evidence'};
  if(requiredNames){
    if(!Array.isArray(requiredNames)||!requiredNames.length)return {action:'blocked',reason:'Quality requirements missing'};
    const missing=requiredNames.filter(name=>!checks.some(c=>c.name===name));
    if(missing.length)return {action:'blocked',reason:'Required checks omitted',checks:missing};
    checks=checks.map(c=>({...c,required:requiredNames.includes(c.name)||c.required!==false}));
  }
  const bad=checks.filter(c=>c.required!==false&&!(c.status==='pass'&&c.evidence)&&!(c.status==='not_applicable'&&c.reason&&exceptions.some(e=>e.name===c.name&&e.reason)));
  if(bad.length)return {action:'blocked',reason:'Required checks failed or unverified',checks:bad.map(c=>c.name)};
  return {action:mode==='guided'||['reference','final'].includes(stage)?'user_review':'ai_review',reason:'Technical evidence present; reviewer decision still required'};
}
