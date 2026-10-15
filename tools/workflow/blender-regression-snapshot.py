"""Read-only property fingerprint inventory; run on an archived clean .blend.

Hashes detect changes, not quality. Playback and protection measurements remain
required. No save, pose changes, or live-scene mutations are performed.
"""
import hashlib
import json
import sys
from pathlib import Path


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def collect():
    import bpy
    properties = {}
    for obj in bpy.context.scene.objects:
        prefix = 'object:' + obj.name
        properties[prefix + ':transform'] = fingerprint([list(row) for row in obj.matrix_local])
        if obj.type == 'MESH':
            mesh = obj.data
            properties[prefix + ':geometry'] = fingerprint({
                'vertices': [list(v.co) for v in mesh.vertices],
                'faces': [list(p.vertices) for p in mesh.polygons],
                'smooth': [p.use_smooth for p in mesh.polygons]})
            properties[prefix + ':weights'] = fingerprint([
                [(obj.vertex_groups[g.group].name, g.weight) for g in v.groups] for v in mesh.vertices])
            properties[prefix + ':uv'] = fingerprint({uv.name: [list(x.uv) for x in uv.data] for uv in mesh.uv_layers})
            properties[prefix + ':material_slots'] = fingerprint([m.name if m else None for m in mesh.materials])
        if obj.type == 'ARMATURE':
            properties[prefix + ':skeleton'] = fingerprint([
                [b.name, b.parent.name if b.parent else None, list(b.head_local), list(b.tail_local),
                 [list(row) for row in b.matrix_local], b.use_deform] for b in obj.data.bones])
    for action in bpy.data.actions:
        # Blender 5 layered actions: preserve slot identity and all key handles.
        for layer in action.layers:
            for si, strip in enumerate(layer.strips):
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        key = f'action:{action.name}:{layer.name}:{si}:{bag.slot_handle}:{curve.data_path}:{curve.array_index}'
                        properties[key] = fingerprint({'extrapolation': curve.extrapolation,
                            'mute': curve.mute, 'keys': [[list(k.co), k.interpolation,
                            k.easing, k.amplitude, k.back, k.period,
                            k.handle_left_type, k.handle_right_type,
                            list(k.handle_left), list(k.handle_right)] for k in curve.keyframe_points]})
    return properties


if __name__ == '__main__':
    import bpy
    if not bpy.data.filepath or bpy.data.is_dirty:
        raise ValueError('Expected clean archived source')
    output = Path(sys.argv[sys.argv.index('--') + 1])
    result = {'source_sha256': hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
              'collector_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'blender_version': bpy.app.version_string, 'properties': collect(),
              'not_tested': ['material node values', 'constraints', 'drivers', 'NLA',
                             'shape keys', 'curve modifiers', 'action blending/ranges',
                             'self intersection', 'visual quality']}
    with output.open('x', encoding='utf8') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
