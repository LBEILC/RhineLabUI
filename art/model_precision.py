"""Reproducible geometry-only experiment; execute through Blender MCP.

Uses the shipped cassette as source. High is the original byte-for-byte asset;
medium changes background geometry only; low also simplifies fine internals.
Materials, UVs, transforms, shell dimensions and part count are retained.
"""
import bpy, bmesh, re, json, hashlib
from pathlib import Path

ROOT = Path(r'E:\AIProject\RhineLabUI')
OUT = ROOT / 'reference/model-precision'
ARRAY = {'Frosted_Polymer', 'Ivory_Edges', 'Optical_Diffuser', 'Index_Inlay', 'Titanium_Fasteners'}
RATIOS = {
    'medium': {'Titanium_Fasteners': .18, 'Ivory_Edges': .60},
    'low': {'Titanium_Fasteners': .07, 'Ivory_Edges': .30,
            'Internal_Ceramic': .40, 'Optical_Edges': .30,
            'Subsurface_Optics': .30, 'Optical_Film_Edge': .15,
            'Amber_Optical_Inlay': .30, 'Case_Engraving': .30,
            'Case_Engraving_Highlight': .30, 'Moulded_Lettering': .45},
}

def generate(tier):
    OUT.mkdir(parents=True, exist_ok=True)
    scene = bpy.data.scenes.new('Precision ' + tier)
    bpy.context.window.scene = scene
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/archive-cassette.glb'))
    objects = list(scene.objects)
    rows = []
    for obj in objects:
        if obj.type != 'MESH': continue
        name = re.sub(r'(\.\d+)+$', '', obj.data.materials[0].name)
        # Canonical surface names avoid suffix differences across imports.
        obj.data.materials[0].name = name
        obj.data.calc_loop_triangles()
        before = len(obj.data.loop_triangles)
        ratio = RATIOS[tier].get(name, 1)
        if ratio < 1:
            original = obj.copy()
            original.data = obj.data.copy()
            scene.collection.objects.link(original)
            bpy.context.view_layer.objects.active = obj
            # glTF splits vertices at normal/UV seams. Weld coincident positions
            # before decimation so a curved surface is simplified continuously.
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
            bm.to_mesh(obj.data)
            bm.free()
            dec = obj.modifiers.new('Precision geometry reduction', 'DECIMATE')
            dec.ratio = ratio
            dec.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=dec.name)
            # Preserve the source's smooth surfaces and sharp shading boundaries.
            normals = obj.modifiers.new('Preserve reference normals', 'DATA_TRANSFER')
            normals.object = original
            normals.use_loop_data = True
            normals.data_types_loops = {'CUSTOM_NORMAL'}
            normals.loop_mapping = 'POLYINTERP_NEAREST'
            bpy.ops.object.modifier_apply(modifier=normals.name)
            bpy.data.objects.remove(original, do_unlink=True)
        obj.data.calc_loop_triangles()
        rows.append({'surface':name, 'before':before, 'after':len(obj.data.loop_triangles), 'array':name in ARRAY})
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{tier}.glb'), export_format='GLB',
                              use_selection=True, use_active_scene=True, export_yup=True, export_normals=True,
                              export_materials='EXPORT', export_extras=True)
    manifest = {'tier':tier, 'sourceSha256':hashlib.sha256((ROOT/'public/assets/archive-cassette.glb').read_bytes()).hexdigest(), 'parts':rows}
    (OUT/f'{tier}.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
    print(json.dumps(manifest))

if __name__ == '__main__':
    generate('medium')
    generate('low')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/model-precision.blend'), compress=True)
