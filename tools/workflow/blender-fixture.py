"""Disposable engineering fixture. Only run with --factory-startup in a new process."""
import bpy
import json
import sys
import runpy
from pathlib import Path

base = Path(sys.argv[sys.argv.index('--')+1])
collector = runpy.run_path(str(Path(__file__).with_name('blender-measure.py')))
root = bpy.data.objects.new('FixtureRoot', None)
bpy.context.scene.collection.objects.link(root)
mesh = bpy.data.meshes.new('FixtureMesh')
mesh.from_pydata([(-.5, 0, 0), (.5, 0, 0), (.5, 1, 0), (-.5, 1, 0)], [], [(0, 1, 2, 3)])
obj = bpy.data.objects.new('Foot', mesh)
bpy.context.scene.collection.objects.link(obj)
obj.parent = root
arm = bpy.data.armatures.new('FixtureArmature')
rig = bpy.data.objects.new('Rig', arm)
bpy.context.scene.collection.objects.link(rig)
rig.parent = root
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bone = arm.edit_bones.new('foot')
bone.head = (0, 0, 0)
bone.tail = (0, 0, 1)
bpy.ops.object.mode_set(mode='OBJECT')
group = obj.vertex_groups.new(name='foot')
group.add(list(range(4)), 1.0, 'REPLACE')
modifier = obj.modifiers.new('Skin', 'ARMATURE')
modifier.object = rig
for frame, location in [(1, (0, 0, 0)), (2, (.2, -.1, 0))]:
    rig.pose.bones['foot'].location = location
    rig.pose.bones['foot'].keyframe_insert(data_path='location', frame=frame)
for frame, location in [(1, (0, 0, 0)), (2, (0, 3, 0))]:
    root.location = location
    root.keyframe_insert(data_path='location', frame=frame)
for index in range(12):
    empty = bpy.data.objects.new('Inventory'+str(index), None)
    bpy.context.scene.collection.objects.link(empty)
bpy.context.scene.frame_set(1)
source = base/'source.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
common = dict(object='Foot', indices=[0, 1, 2, 3], sample_ids=['corner-a', 'corner-b', 'corner-c', 'corner-d'], topology_sha256=collector['topology'](mesh))
config = {'asset_root': str(base), 'source': str(source), 'source_sha256': collector['digest'](source), 'suite_id': 'evaluated-fixture-v1',
          'blender_version': bpy.app.version_string, 'scale': 1, 'reference_frame': 1,
          'samples': [1, 1.5, 2], 'regions': [
              dict(common, name='protected', kind='protected', space='root', root_object='FixtureRoot', metrics={'displacement': 'protected_region'}),
              dict(common, name='contact', kind='contact', space='world', ground={'normal': [0, 0, 1], 'point': [0, 0, 0]},
                   contact_phases=[{'samples': [1, 1.5, 2]}], metrics={'drift': 'sole_drift', 'penetration': 'sole_penetration'}),
              dict(common, name='transition', kind='transition', space='root', root_object='FixtureRoot',
                   sample_edges=[[0, 1], [1, 2], [2, 3], [3, 0]],
                   metrics={'stretch': 'transition_stretch', 'compression': 'transition_compression'})]}
(base/'measure-config.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
from mathutils import Vector
camera_location = Vector((4, -6, 3))
camera_rotation = (Vector((0, .5, 0))-camera_location).to_track_quat('-Z', 'Y').to_euler()
capture = {'asset_root': str(base), 'source': str(source), 'source_sha256': collector['digest'](source),
    'suite_id': config['suite_id'], 'blender_version': bpy.app.version_string,
    'conditions': {'scene': bpy.context.scene.name, 'view_layer': bpy.context.view_layer.name,
        'views': [{'name': 'three-quarter', 'frame': 1, 'location': list(camera_location), 'rotation': list(camera_rotation),
            'type': 'PERSP', 'lens': 50, 'ortho_scale': 6, 'clip_start': .01, 'clip_end': 100}],
        'resolution': [64, 64], 'samples': 4, 'transparent': False,
        'color': {'view_transform': 'Standard', 'look': 'None', 'exposure': 0, 'gamma': 1},
        'display_device': 'sRGB', 'world_color': [.1, .1, .1], 'world_strength': .5,
        'lights': [{'location': [2, -3, 5], 'rotation': [0, 0, 0], 'energy': 500, 'color': [1, 1, 1], 'size': 4}]}}
(base/'capture-config.json').write_text(json.dumps(capture, indent=2), encoding='utf-8')
# Separate source tests a moving AND rotating root bone, not only object movement.
pose = rig.pose.bones['foot']
pose.rotation_mode = 'XYZ'
for frame, angle in [(1, 0), (2, .5)]:
    pose.rotation_euler = (0, 0, angle)
    pose.keyframe_insert(data_path='rotation_euler', frame=frame)
bpy.context.scene.frame_set(1)
bone_source = base/'bone-source.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(bone_source))
bone_config = dict(config, source=str(bone_source), source_sha256=collector['digest'](bone_source), regions=[
    dict(common, name='full-root', kind='protected', space='root', root_object='Rig', root_bone='foot',
         root_removal='translation_rotation', metrics={'displacement': 'root_removed'}),
    dict(common, name='translation-only', kind='protected', space='root', root_object='Rig', root_bone='foot',
         root_removal='translation', metrics={'displacement': 'rotation_retained'})])
(base/'bone-config.json').write_text(json.dumps(bone_config, indent=2), encoding='utf-8')
print('FIXTURE_READY')
# Actual topology change, isolated fixture only: retain named corner samples,
# subdivide the surface and measure through the same frozen virtual edges.
import bmesh
bpy.ops.wm.open_mainfile(filepath=str(source))
obj = bpy.data.objects['Foot']
corners = [v.co.copy() for v in obj.data.vertices]
bm = bmesh.new()
bm.from_mesh(obj.data)
bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
bm.to_mesh(obj.data)
bm.free()
obj.data.update()
mapped = [min(obj.data.vertices, key=lambda v: (v.co-p).length).index for p in corners]
topology_source = base/'topology-source.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(topology_source))
topology_config = dict(config, source=str(topology_source), source_sha256=collector['digest'](topology_source),
    mapping_variant='subdivided', regions=[dict(r, indices=mapped, topology_sha256=collector['topology'](obj.data)) for r in config['regions']])
(base/'topology-config.json').write_text(json.dumps(topology_config, indent=2), encoding='utf-8')
