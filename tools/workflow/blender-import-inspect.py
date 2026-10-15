"""Read-only archived import inventory. No saves, pose edits or inferred quality pass.
blender --background --factory-startup SOURCE.blend --python THIS -- OUTPUT.json [MESH_NAME]
"""
import bpy, sys, json, hashlib
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0])
if not bpy.data.filepath or bpy.data.is_dirty:
    raise ValueError('Expected clean archived imported scene')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
skinned = [o for o in meshes if any(m.type == 'ARMATURE' and m.object for m in o.modifiers)]
selected = next((o for o in meshes if len(args)>1 and o.name == args[1]), None)
if len(args)>1 and selected is None:
    raise ValueError('Specified mesh not found')
if selected is None and len(skinned)==1:
    selected = skinned[0]
rigs = [o for o in bpy.context.scene.objects if o.type=='ARMATURE']
report = {
    'source': {'path': bpy.data.filepath, 'sha256': hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()},
    'selected_mesh': selected.name if selected else None,
    'selection_status': 'identified' if selected else 'ambiguous_requires_selection',
    'meshes': [{'name':o.name,'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),
                'armatures':[m.object.name for m in o.modifiers if m.type=='ARMATURE' and m.object],
                'uv_layers':[u.name for u in o.data.uv_layers],
                'materials':[m.name if m else None for m in o.data.materials],
                'matrix_world':[list(row) for row in o.matrix_world]} for o in meshes],
    'rigs': [{'name':o.name,'bones':len(o.data.bones),
              'active_action':o.animation_data.action.name if o.animation_data and o.animation_data.action else None,
              'use_nla':o.animation_data.use_nla if o.animation_data else None,
              'tracks':[{'name':t.name,'mute':t.mute,'strips':[{'action':s.action.name if s.action else None,'start':s.frame_start,'end':s.frame_end,'blend_type':s.blend_type,'influence':s.influence} for s in t.strips]} for t in o.animation_data.nla_tracks] if o.animation_data else []} for o in rigs],
    'actions':[{'name':a.name,'range':list(a.frame_range),'slots':[s.identifier for s in a.slots]} for a in bpy.data.actions],
    'images':[{'name':i.name,'size':list(i.size),'has_data':i.has_data,'packed':bool(i.packed_file),'filepath':i.filepath} for i in bpy.data.images],
    'fps':bpy.context.scene.render.fps/bpy.context.scene.render.fps_base,
    'units':bpy.context.scene.unit_settings.system,
    'not_verified':['source rig provenance','correct active action/slot','axis and scale correctness','texture node wiring','rest/pose alignment','root motion','deformation','animation visual quality']
}
with out.open('x',encoding='utf8') as f:
    json.dump(report,f,ensure_ascii=False,indent=2)
print(json.dumps({'selected_mesh':report['selected_mesh'],'selection_status':report['selection_status'],'output':str(out)}))
