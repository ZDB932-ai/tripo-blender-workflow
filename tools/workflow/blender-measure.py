"""Evaluated-mesh measurements. Run in an isolated saved Blender file.

No quality thresholds are inferred. Regions, contact phases and sample times
must be frozen in a config. Topology-changing evaluation is explicitly refused.
"""
import hashlib
import json
import math
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def topology(mesh):
    data = [len(mesh.vertices), [list(e.vertices) for e in mesh.edges],
            [list(p.vertices) for p in mesh.polygons]]
    return hashlib.sha256(json.dumps(data, separators=(",", ":")).encode()).hexdigest()


def collect(config):
    import bpy
    from mathutils import Vector, Matrix
    source = Path(config["source"])
    if Path(bpy.data.filepath).resolve() != source.resolve() or bpy.data.is_dirty:
        raise ValueError("Expected clean saved source scene")
    if digest(source) != config["source_sha256"]:
        raise ValueError("Source hash mismatch")
    if config.get("blender_version") != bpy.app.version_string:
        raise ValueError("Freeze actual Blender version in measurement config")
    if not isinstance(config.get("suite_id"), str) or not config["suite_id"]:
        raise ValueError("Suite identity required")
    scale = config["scale"]
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Finite positive normalization scale required")
    samples = config["samples"]
    if not samples or len(set(samples)) != len(samples) or not all(math.isfinite(t) for t in samples):
        raise ValueError("Unique finite sample times required")
    reference = config["reference_frame"]
    if not math.isfinite(reference):
        raise ValueError("Finite reference frame required")
    regions = config["regions"]
    if not regions or len({r['name'] for r in regions}) != len(regions):
        raise ValueError("Unique named regions required")
    objects = {}
    for region in regions:
        obj = bpy.data.objects.get(region["object"])
        if obj is None or obj.type != 'MESH':
            raise ValueError("Mesh region object missing")
        if topology(obj.data) != region["topology_sha256"]:
            raise ValueError("Region topology identity changed")
        indices = region["indices"]
        if not indices or len(set(indices)) != len(indices) or any(type(i) is not int or i < 0 or i >= len(obj.data.vertices) for i in indices):
            raise ValueError("Region indices invalid")
        if 'sample_ids' in region and (len(region['sample_ids']) != len(indices) or
                len(set(region['sample_ids'])) != len(indices) or
                any(not isinstance(v, str) or not v.strip() for v in region['sample_ids'])):
            raise ValueError("Correspondence sample identities invalid")
        if region['kind'] not in ('protected', 'transition', 'contact'):
            raise ValueError("Unknown region kind")
        if region['space'] not in ('world', 'root'):
            raise ValueError("Explicit world/root coordinate space required")
        if region['kind'] == 'contact' and region['space'] != 'world':
            raise ValueError("Contact must be measured in world ground coordinates")
        objects[obj.name] = obj
    scene = bpy.context.scene
    old_frame, old_subframe = scene.frame_current, scene.frame_subframe
    positions = {r['name']: {} for r in regions}
    try:
        for time in sorted(set(samples + [reference])):
            frame = math.floor(time)
            scene.frame_set(frame, subframe=time-frame)
            graph = bpy.context.evaluated_depsgraph_get()
            for region in regions:
                obj = objects[region['object']].evaluated_get(graph)
                mesh = obj.to_mesh()
                try:
                    if topology(mesh) != region['topology_sha256']:
                        raise ValueError("Evaluated topology changed; rebuild region mapping")
                    matrix = obj.matrix_world.copy()
                    if region['space'] == 'root':
                        root = bpy.data.objects.get(region.get('root_object', ''))
                        if root is None:
                            raise ValueError("Root object missing")
                        root_matrix = root.evaluated_get(graph).matrix_world
                        if region.get('root_bone'):
                            evaluated_root = root.evaluated_get(graph)
                            bone = evaluated_root.pose.bones.get(region['root_bone']) if evaluated_root.type == 'ARMATURE' else None
                            if bone is None:
                                raise ValueError("Root bone missing")
                            root_matrix = root_matrix @ bone.matrix
                        if any(abs(v-1) > 1e-6 for v in root_matrix.to_scale()):
                            raise ValueError("Root removal requires unit scale")
                        removal = region.get('root_removal', 'translation_rotation')
                        if removal == 'translation':
                            root_matrix = Matrix.Translation(root_matrix.translation)
                        elif removal != 'translation_rotation':
                            raise ValueError("Unknown root removal mode")
                        matrix = root_matrix.inverted() @ matrix
                    points = [matrix @ mesh.vertices[i].co for i in region['indices']]
                    if any(not math.isfinite(v) for point in points for v in point):
                        raise ValueError("Non-finite evaluated position")
                    positions[region['name']][time] = points
                finally:
                    obj.to_mesh_clear()
    finally:
        scene.frame_set(old_frame, subframe=old_subframe)
    values, units, details = {}, {}, {}

    def emit(region, key, value, unit):
        name = region['metrics'][key]
        if name in values or not math.isfinite(value):
            raise ValueError("Duplicate or non-finite metric")
        values[name], units[name] = value, unit

    for region in regions:
        positions_at = positions[region['name']]
        rest = positions_at[reference]
        if region['kind'] == 'protected':
            displacement = max((a-b).length for t in samples for a, b in zip(positions_at[t], rest)) / scale
            emit(region, 'displacement', displacement, 'asset_height_ratio')
        elif region['kind'] == 'transition':
            ids = {v: i for i, v in enumerate(region['indices'])}
            edges = [(ids[e.vertices[0]], ids[e.vertices[1]]) for e in objects[region['object']].data.edges
                     if all(v in ids for v in e.vertices)]
            if 'sample_edges' in region:
                edges = region['sample_edges']
                if not edges or any(not isinstance(e, list) or len(e) != 2 or e[0] == e[1] or
                        any(type(i) is not int or i < 0 or i >= len(rest) for i in e) for e in edges):
                    raise ValueError("Frozen sample edges invalid")
            if not edges:
                raise ValueError("Transition region has no internal edges")
            ratios = []
            for a, b in edges:
                length = (rest[a]-rest[b]).length
                if length <= 1e-12:
                    raise ValueError("Degenerate reference edge")
                ratios.extend((positions_at[t][a]-positions_at[t][b]).length/length for t in samples)
            emit(region, 'stretch', max(ratios), 'ratio')
            emit(region, 'compression', min(ratios), 'ratio')
        else:
            plane = region['ground']
            normal, origin = Vector(plane['normal']), Vector(plane['point'])
            if not all(math.isfinite(v) for v in (*normal, *origin)) or normal.length <= 1e-12:
                raise ValueError("Finite ground plane required")
            normal.normalize()
            phases = region['contact_phases']
            if not phases:
                raise ValueError("Explicit contact phases required")
            drift, penetration = 0.0, 0.0
            for phase in phases:
                times = phase['samples']
                if not times or any(t not in samples for t in times) or times != sorted(set(times)):
                    raise ValueError("Contact phase must use ordered frozen samples")
                anchor = positions_at[times[0]]
                for time in times:
                    for p, a in zip(positions_at[time], anchor):
                        delta = p-a
                        drift = max(drift, (delta-normal*delta.dot(normal)).length/scale)
                        penetration = max(penetration, -(p-origin).dot(normal)/scale)
            emit(region, 'drift', drift, 'asset_height_ratio')
            emit(region, 'penetration', penetration, 'asset_height_ratio')
        details[region['name']] = {'object': region['object'], 'space': region['space'],
            'topology_sha256': region['topology_sha256'], 'vertex_count': len(rest),
            'reference_positions': [list(p) for p in rest],
            'sampled_positions': [{'frame': t, 'positions': [list(p) for p in positions_at[t]]} for t in samples]}
    inventory = []
    for obj in scene.objects:
        entry = {'name': obj.name, 'type': obj.type, 'hidden_render': obj.hide_render,
                 'hidden_viewport': obj.hide_viewport}
        if obj.type == 'MESH':
            entry.update(vertices=len(obj.data.vertices), topology_sha256=topology(obj.data),
                         modifiers=[{'name': m.name, 'type': m.type} for m in obj.modifiers],
                         materials=[slot.material.name if slot.material else None for slot in obj.material_slots])
        if obj.type == 'ARMATURE':
            entry['bones'] = [bone.name for bone in obj.data.bones]
        inventory.append(entry)
    return {'schema_version': 1, 'source_sha256': config['source_sha256'], 'suite_id': config['suite_id'],
            'blender_version': bpy.app.version_string, 'collector_sha256': digest(__file__),
            'values': values, 'units': units, 'regions': details, 'inventory': inventory,
            'reference_frame': reference, 'samples': samples, 'scale': scale,
            'not_tested': ['self_intersection', 'uv_overlap', 'artistic_quality', 'engine_playback']}


def run(config_path, output_path):
    config_path, output_path = Path(config_path), Path(output_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    asset_root = Path(config['asset_root']).resolve()
    for target in (config_path, output_path, Path(config['source'])):
        target.resolve().relative_to(asset_root)
    result = collect(config)
    result['config'] = {'path': config_path.resolve().relative_to(asset_root).as_posix(), 'sha256': digest(config_path)}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False, allow_nan=False)
    return result


if __name__ == '__main__':
    import sys
    args = sys.argv[sys.argv.index('--')+1:]
    run(*args)
