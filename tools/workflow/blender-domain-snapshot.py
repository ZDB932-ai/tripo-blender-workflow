"""Read-only domain fingerprints for bounded evidence reuse.

Unsupported constructs yield null, never a claim that a domain is unchanged.
Run against a clean saved file in an isolated Blender process.
"""
import hashlib
import json
import sys
from pathlib import Path


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def scalar_properties(block):
    result = {}
    for prop in block.bl_rna.properties:
        if prop.identifier == 'rna_type' or prop.is_readonly or prop.type not in ('BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'):
            continue
        value = getattr(block, prop.identifier)
        result[prop.identifier] = sorted(value) if isinstance(value, set) else list(value) if getattr(prop, 'is_array', False) else value
    return result


def simple_nodes(mat):
    tree = mat.node_tree
    if not tree:
        return []
    if tree.animation_data or any(n.bl_idname not in ('ShaderNodeBsdfPrincipled', 'ShaderNodeOutputMaterial', 'ShaderNodeRGB', 'ShaderNodeValue') for n in tree.nodes):
        return None
    nodes = []
    for node in sorted(tree.nodes, key=lambda n: n.name):
        sockets = []
        for socket in list(node.inputs) + list(node.outputs):
            if hasattr(socket, 'default_value'):
                value = socket.default_value
                sockets.append([socket.identifier, list(value) if not isinstance(value, (str, int, float, bool)) else value])
        nodes.append([node.name, node.bl_idname, scalar_properties(node), sockets])
    links = sorted([l.from_node.name, l.from_socket.identifier, l.to_node.name, l.to_socket.identifier] for l in tree.links)
    return [nodes, links]


def collect():
    import bpy
    objects = sorted(bpy.context.scene.objects, key=lambda o: o.name)
    unsupported = {key: [] for key in ('geometry', 'uv', 'materials', 'rig', 'animation', 'scene')}
    geometry, uv, rig, material, animation = [], [], [], [], []
    for obj in objects:
        transform = [list(row) for row in obj.matrix_local]
        base = [obj.name, obj.type, obj.parent.name if obj.parent else None, transform,
                obj.hide_render, obj.hide_viewport]
        if obj.library or obj.override_library:
            for key in unsupported:
                unsupported[key].append('linked or overridden object: ' + obj.name)
        if obj.constraints or obj.animation_data:
            # Dependency graph evaluation can affect geometry and appearances as well.
            for key in ('geometry', 'rig', 'animation', 'scene'):
                unsupported[key].append('animated/constrained object: ' + obj.name)
        if obj.type == 'MESH':
            mesh = obj.data
            if obj.modifiers or mesh.shape_keys or mesh.animation_data:
                for key in ('geometry', 'uv', 'rig', 'animation'):
                    unsupported[key].append('modifier/shape-key/mesh animation: ' + obj.name)
            geometry.append([base, [list(v.co) for v in mesh.vertices],
                             [list(e.vertices) for e in mesh.edges],
                             [[list(p.vertices), p.use_smooth] for p in mesh.polygons],
                             [e.use_edge_sharp for e in mesh.edges]])
            uv.append([obj.name, mesh.uv_layers.active_index,
                       [[layer.name, layer.active_render, [list(x.uv) for x in layer.data]] for layer in mesh.uv_layers]])
            rig.append([base, [[g.name, g.lock_weight] for g in obj.vertex_groups],
                        [[(g.group, g.weight) for g in v.groups] for v in mesh.vertices]])
            material.append([obj.name, [m.name if m else None for m in mesh.materials],
                             [p.material_index for p in mesh.polygons]])
            # Generic attributes may drive displacement or shading outside this collector.
            builtin = {'position', '.edge_verts', '.corner_vert', '.corner_edge', 'material_index',
                       'sharp_face', 'sharp_edge', '.select_vert', '.select_edge', '.select_poly',
                       '.uv_select_face', '.uv_select_vert', '.uv_select_edge'}
            unknown = [a.name for a in mesh.attributes if a.name not in builtin and a.name not in mesh.uv_layers and not a.name.startswith(('.vs.', '.es.', '.pn.'))]
            if unknown:
                for key in ('geometry', 'materials'):
                    unsupported[key].append('custom mesh attributes: ' + obj.name)
            if mesh.has_custom_normals:
                unsupported['geometry'].append('custom normals: ' + obj.name)
        elif obj.type == 'ARMATURE':
            # Rest bones alone do not cover pose constraints, drivers, or bone collections.
            unsupported['rig'].append('armature requires an extended collector: ' + obj.name)
            unsupported['animation'].append('armature requires an extended collector: ' + obj.name)
            geometry.append(base)
        elif obj.type not in ('EMPTY', 'CAMERA', 'LIGHT'):
            for key in unsupported:
                unsupported[key].append('unsupported object type: ' + obj.type)
        else:
            geometry.append(base)
        animation.append([obj.name, bool(obj.animation_data)])
    used_materials = {slot.material for obj in objects for slot in obj.material_slots if slot.material}
    for mat in sorted(used_materials, key=lambda m: m.name):
        nodes = simple_nodes(mat)
        if nodes is None or mat.animation_data or mat.library or mat.override_library:
            unsupported['materials'].append('unsupported nodes/animated/linked material: ' + mat.name)
        material.append([mat.name, scalar_properties(mat), nodes])
    if bpy.data.actions:
        unsupported['animation'].append('actions require an extended collector')
    scene = bpy.context.scene
    # Scene domain deliberately unavailable until lighting/camera/render data are fully collected.
    unsupported['scene'].append('full scene/render dependencies require an extended collector')
    values = {'geometry': geometry, 'uv': uv, 'materials': material, 'rig': rig,
              'animation': animation, 'scene': [scene.name, scene.frame_current]}
    return {key: None if unsupported[key] else digest(value) for key, value in values.items()}, unsupported


if __name__ == '__main__':
    import bpy
    if not bpy.data.filepath or bpy.data.is_dirty:
        raise ValueError('Expected clean archived source')
    domains, unsupported = collect()
    output = Path(sys.argv[sys.argv.index('--') + 1])
    result = {'schema_version': 1,
              'source_sha256': hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
              'collector_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'blender_version': bpy.app.version_string, 'domains': domains, 'unsupported': unsupported}
    with output.open('x', encoding='utf8') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
