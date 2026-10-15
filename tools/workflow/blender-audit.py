"""Read-only audit of explicitly named mesh objects in the connected Blender scene.

After MCP status/scene inspection, execute this file followed by
print(json.dumps(audit_objects([actual_object_name]), ensure_ascii=False)).
No imports, scene edits, automatic fixes, file saves or rigging are performed.
"""
import json
import math
import bpy
import bmesh


def audit_objects(names):
    if not names:
        raise ValueError("Explicit asset object names required")
    result = {"blender_version": bpy.app.version_string, "objects": [],
              "self_intersections": "not_tested", "uv_overlap": "not_tested",
              "deformation": "not_tested", "evaluated_modifiers": "not_tested"}
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != 'MESH':
            raise ValueError("Expected mesh object: " + name)
        mesh = obj.data
        bm = bmesh.new()
        try:
            bm.from_mesh(mesh)
            item = {"name": name, "vertices": len(mesh.vertices), "polygons": len(mesh.polygons),
                    "triangles_estimated": sum(max(0, len(p.vertices)-2) for p in mesh.polygons),
                    "boundary_edges": sum(e.is_boundary for e in bm.edges),
                    "non_manifold_edges_including_boundary": sum(not e.is_manifold for e in bm.edges),
                    "loose_vertices": sum(not v.link_edges for v in bm.verts),
                    "zero_area_faces": sum(f.calc_area() == 0 for f in bm.faces),
                    "non_finite_vertices": sum(not all(math.isfinite(x) for x in v.co) for v in mesh.vertices),
                    "uv_layers": [uv.name for uv in mesh.uv_layers],
                    "dimensions_scene_units": list(obj.dimensions), "scale": list(obj.scale),
                    "materials": [], "armatures": [m.object.name if m.object else None for m in obj.modifiers if m.type == 'ARMATURE']}
            for slot in obj.material_slots:
                mat = slot.material
                textures = []
                if mat and mat.use_nodes and mat.node_tree:
                    for node in mat.node_tree.nodes:
                        if node.type == 'TEX_IMAGE':
                            img = node.image
                            textures.append({"image": img.name if img else None,
                                             "size": list(img.size) if img else None,
                                             "color_space": img.colorspace_settings.name if img else None})
                item['materials'].append({"name": mat.name if mat else None, "textures": textures})
            result['objects'].append(item)
        finally:
            bm.free()
    return result
