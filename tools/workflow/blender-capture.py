"""Deterministic comparison capture in an isolated saved Blender process.

Uses explicit neutral lights/world and camera; never saves the modified scene.
"""
import json
import math
from pathlib import Path
from hashlib import sha256


def digest(path):
    return sha256(Path(path).read_bytes()).hexdigest()


def run(config_path, output_path):
    import bpy
    config_path, output_path = Path(config_path), Path(output_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    root = Path(config['asset_root']).resolve()
    for target in (config_path, output_path, Path(config['source'])):
        target.resolve().relative_to(root)
    if Path(bpy.data.filepath).resolve() != Path(config['source']).resolve() or bpy.data.is_dirty:
        raise ValueError('Expected clean saved capture source')
    if digest(config['source']) != config['source_sha256'] or bpy.app.version_string != config['blender_version']:
        raise ValueError('Capture source/runtime mismatch')
    if not config.get('suite_id'):
        raise ValueError('Capture suite required')
    c = config['conditions']
    scene = bpy.data.scenes[c['scene']]
    layer = scene.view_layers[c['view_layer']]
    bpy.context.window.scene = scene
    bpy.context.window.view_layer = layer
    for item in scene.view_layers:
        item.use = item == layer
    views = c['views']
    if not views or len({v['name'] for v in views}) != len(views):
        raise ValueError('Unique capture views required')
    # New directory is the claim; partial captures must not be replayed/overwritten.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image_dir = output_path.with_suffix('.images')
    if output_path.exists():
        raise ValueError('Capture output already exists')
    image_dir.mkdir()
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = c['samples']
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.seed = 0
    scene.cycles.use_animated_seed = False
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 4
    scene.cycles.transmission_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.volume_bounces = 0
    scene.cycles.use_fast_gi = False
    scene.render.resolution_x, scene.render.resolution_y = c['resolution']
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
    scene.render.film_transparent = c['transparent']
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.render.use_border = False
    scene.render.use_stamp = False
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.use_file_extension = True
    scene.render.use_motion_blur = False
    layer.material_override = None
    for key in ('view_transform', 'look', 'exposure', 'gamma'):
        setattr(scene.view_settings, key, c['color'][key])
    scene.view_settings.use_curve_mapping = False
    scene.display_settings.display_device = c['display_device']
    scene.world = bpy.data.worlds.new('WorkflowCaptureWorld')
    scene.world.use_nodes = True
    background = next(node for node in scene.world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = [*c['world_color'], 1]
    background.inputs['Strength'].default_value = c['world_strength']
    for obj in scene.objects:
        if obj.type == 'LIGHT':
            obj.hide_render = True
    lights = []
    for spec in c['lights']:
        data = bpy.data.lights.new('WorkflowCaptureLight', 'AREA')
        data.energy, data.color, data.size = spec['energy'], spec['color'], spec['size']
        obj = bpy.data.objects.new('WorkflowCaptureLight', data)
        scene.collection.objects.link(obj)
        obj.location, obj.rotation_euler = spec['location'], spec['rotation']
        lights.append(obj)
    data = bpy.data.cameras.new('WorkflowCaptureCamera')
    camera = bpy.data.objects.new('WorkflowCaptureCamera', data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    captures = []
    for index, view in enumerate(views):
        time = view['frame']
        scene.frame_set(math.floor(time), subframe=time-math.floor(time))
        # Animated scene exposure must not silently override the frozen view.
        for key in ('view_transform', 'look', 'exposure', 'gamma'):
            setattr(scene.view_settings, key, c['color'][key])
        camera.location, camera.rotation_euler = view['location'], view['rotation']
        data.type, data.lens, data.ortho_scale = view['type'], view['lens'], view['ortho_scale']
        data.clip_start, data.clip_end = view['clip_start'], view['clip_end']
        data.dof.use_dof = False
        data.shift_x = data.shift_y = 0
        bpy.context.view_layer.update()
        image = image_dir / f'{index:03d}.png'
        scene.render.filepath = str(image)
        bpy.ops.render.render(write_still=True, scene=scene.name)
        captures.append({'name': view['name'], 'frame': time,
            'camera_matrix': [list(row) for row in camera.matrix_world],
            'camera': {k: getattr(data, k) for k in ('type', 'lens', 'ortho_scale', 'clip_start', 'clip_end')},
            'image': {'path': image.relative_to(root).as_posix(), 'sha256': digest(image)}})
    effective = {'engine': scene.render.engine, 'device': scene.cycles.device,
        'samples': scene.cycles.samples, 'resolution': [scene.render.resolution_x, scene.render.resolution_y],
        'color': {k: getattr(scene.view_settings, k) for k in ('view_transform', 'look', 'exposure', 'gamma')},
        'lights': [{'matrix': [list(row) for row in o.matrix_world], 'energy': o.data.energy,
                    'color': list(o.data.color), 'size': o.data.size} for o in lights],
        'views': [{k: v for k, v in item.items() if k != 'image'} for item in captures]}
    result = {'source_sha256': config['source_sha256'], 'suite_id': config['suite_id'],
        'blender_version': bpy.app.version_string, 'collector_sha256': digest(__file__),
        'config': {'path': config_path.resolve().relative_to(root).as_posix(), 'sha256': digest(config_path)},
        'effective_conditions': effective, 'captures': captures}
    with output_path.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
    return result


if __name__ == '__main__':
    import sys
    run(*sys.argv[sys.argv.index('--')+1:])
