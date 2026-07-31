"""Blender scene builder + pass renderer for the Budapest keychain mockup.

Run:  blender -b -P tools/blender/build_mockup.py -- --out frontend/public/catalog/mockup

Renders four aligned passes used by the WebGL compositor:
  beauty.png       bare-metal keychain, transparent background
  print_white.png  same scene, print zone = white diffuse (lighting multiplier)
  print_gloss.png  same scene, print zone = white glossy ink (specular pass)
  uv.png           print-zone UV coordinates in R/G, alpha = zone mask
"""
import argparse
import math
import os
import sys
from mathutils import Vector

import bpy
import addon_utils

# Product dimensions (mm) from the production SVGs
PRODUCT_W = 45.0
PRODUCT_H = 95.1022
ZONE_W = 41.0993
ZONE_H = 66.1002
ZONE_TOP_OFFSET = 15.026  # from product top
FOB_THICKNESS = 1.6       # total plate thickness
ZONE_LIFT = 0.06          # print layer above front face


def mm(v):
    return v / 1000.0


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for addon in ("io_curve_svg",):
        try:
            addon_utils.enable(addon)
        except Exception as exc:
            print(f"addon {addon}: {exc}")


def import_svg_flat(path):
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=path)
    curves = [o for o in set(bpy.data.objects) - before if o.type == "CURVE"]
    if not curves:
        raise RuntimeError(f"nothing imported from {path}")
    bpy.ops.object.select_all(action="DESELECT")
    for o in curves:
        o.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    if len(curves) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    return obj


def bbox_world(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def build_fob(svg_path):
    obj = import_svg_flat(svg_path)
    obj.name = "Fob"
    (x0, x1), _, _ = bbox_world(obj)
    scale = mm(PRODUCT_W) / (x1 - x0)
    obj.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    curve = obj.data
    curve.dimensions = "2D"
    curve.fill_mode = "BOTH"
    curve.extrude = mm(FOB_THICKNESS / 2)
    curve.bevel_depth = mm(0.35)
    curve.bevel_resolution = 3

    # Center on origin in XY (move via location, then apply after mesh conversion)
    (x0, x1), (y0, y1), _ = bbox_world(obj)
    obj.location.x = -(x0 + x1) / 2
    obj.location.y = -(y0 + y1) / 2

    bpy.ops.object.convert(target="MESH")
    fob = bpy.context.view_layer.objects.active
    fob.name = "Fob"
    bpy.ops.object.transform_apply(location=True)
    fob.rotation_euler.z = math.radians(-26)  # tilted like the hero photo
    bpy.ops.object.transform_apply(rotation=True)
    return fob


def build_print_zone(svg_path, fob):
    obj = import_svg_flat(svg_path)
    obj.name = "PrintZone"
    (x0, x1), _, _ = bbox_world(obj)
    scale = mm(ZONE_W) / (x1 - x0)
    obj.scale = (scale, scale, scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    curve = obj.data
    curve.dimensions = "2D"
    curve.fill_mode = "BOTH"
    curve.extrude = mm(0.03)
    curve.bevel_depth = 0.0

    # Align: horizontal center = fob center; zone top = fob top - ZONE_TOP_OFFSET
    fx, fy, fz = bbox_world(fob)
    (zx0, zx1), (zy0, zy1), _ = bbox_world(obj)
    fob_cx = (fx[0] + fx[1]) / 2
    fob_top = fy[1]
    obj.location.x = fob_cx - (zx0 + zx1) / 2
    obj.location.y = (fob_top - mm(ZONE_TOP_OFFSET)) - zy1
    obj.location.z = mm(FOB_THICKNESS / 2 + 0.35 + ZONE_LIFT)

    bpy.ops.object.convert(target="MESH")
    zone = bpy.context.view_layer.objects.active
    zone.name = "PrintZone"
    bpy.ops.object.transform_apply(location=True)
    zone.parent = fob  # keep alignment if fob moves
    return zone


def build_ring_and_chain(fob):
    """Jump ring through the hole + a short drape of chain links on the ground."""
    fx, fy, fz = bbox_world(fob)
    fob_top = fy[1]
    fob_cx = (fx[0] + fx[1]) / 2
    hole_y = fob_top - mm(4.5)  # hole is ~4.5 mm below product top

    metal = bpy.data.materials.get("Metal")

    def link(loc, major, minor, rot):
        bpy.ops.mesh.primitive_torus_add(
            major_radius=mm(major), minor_radius=mm(minor),
            major_segments=20, minor_segments=8, location=loc, rotation=rot)
        t = bpy.context.view_layer.objects.active
        if metal:
            t.data.materials.append(metal)
        return t

    # Jump ring through the hole — nearly flat, slight tilt
    link((fob_cx, hole_y, mm(1.4)), 5.2, 0.95,
         (math.radians(12), 0, math.radians(-14)))

    # Chain: links lying flat, alternating 90° twist, gentle S-curve drape
    n = 24
    for i in range(n):
        t = i / (n - 1)
        x = fob_cx + mm(4 + 30 * t + 7 * math.sin(t * math.pi * 2.0))
        y = hole_y + mm(9 + 70 * t)
        rot = (0, 0, math.radians(90 if i % 2 else 0) + math.radians(20 * math.cos(t * math.pi * 2.0)))
        link((x, y, mm(1.0)), 3.4, 0.9, rot)


def mat_metal():
    m = bpy.data.materials.new("Metal")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.88, 0.90, 0.94, 1)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.24
    return m


def mat_white(roughness, glossy=False):
    m = bpy.data.materials.new(f"WhiteR{int(roughness * 100)}")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = roughness
    if glossy:
        bsdf.inputs["Coat Weight"].default_value = 1.0
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    return m


def mat_uv():
    """Emission shader: R,G = print-zone UV (v up), alpha 1.

    Generated X runs right-to-left on this mesh (verified against the WebGL
    compositor), so emit 1-X to make R increase left-to-right like image UVs.
    """
    m = bpy.data.materials.new("UVMap")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["X"], inv.inputs[1])
    nt.links.new(inv.outputs[0], comb.inputs["X"])
    nt.links.new(sep.outputs["Y"], comb.inputs["Y"])
    nt.links.new(comb.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def setup_scene(fob, zone):
    metal = mat_metal()
    fob.data.materials.append(metal)
    zone.data.materials.append(mat_white(0.55))

    # Ground — shadow catcher in Cycles
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0))
    ground = bpy.context.view_layer.objects.active
    ground.name = "Ground"
    gm = bpy.data.materials.new("Ground")
    gm.use_nodes = True
    gb = gm.node_tree.nodes["Principled BSDF"]
    gb.inputs["Base Color"].default_value = (0.87, 0.87, 0.88, 1)
    gb.inputs["Roughness"].default_value = 0.55
    ground.data.materials.append(gm)

    def area(name, loc, energy, size, color):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = loc
        # aim at fob
        direction = Vector((0, 0.01, 0)) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return obj

    area("Key", (-0.16, 0.10, 0.30), 130, 0.28, (1.0, 0.97, 0.93))
    area("Fill", (0.22, 0.02, 0.16), 80, 0.24, (0.93, 0.96, 1.0))
    area("Rim", (0.02, -0.24, 0.26), 150, 0.20, (1.0, 1.0, 1.0))
    # Large softbox mirrored across the fob face from the camera: its specular
    # reflection covers the face and makes the metal read as bright silver.
    area("FaceSoftbox", (-0.02, 0.10, 0.11), 200, 0.40, (0.98, 0.99, 1.0))

    # Camera: lower, more frontal elevation so the print face stays readable
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 58
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (mm(-14), mm(-112), mm(70))
    target = Vector((mm(6), mm(28), 0))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.92, 0.92, 0.95, 1)
    bg.inputs["Strength"].default_value = 0.7
    bpy.context.scene.world = world
    return ground


def configure_render(engine, res, samples, transparent):
    scene = bpy.context.scene
    scene.render.engine = engine
    if engine == "CYCLES":
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "METAL"
            prefs.get_devices()
            for d in prefs.devices:
                d.use = True
            scene.cycles.device = "GPU"
        except Exception as exc:
            print(f"cycles gpu setup: {exc}")
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = transparent
    scene.render.image_settings.color_depth = "8"


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"rendered {path}")


def set_hidden(objs, hidden):
    for o in objs:
        o.hide_render = hidden


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--res", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=64)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    os.makedirs(args.out, exist_ok=True)

    here = os.path.dirname(os.path.abspath(__file__))
    clean_scene()

    fob = build_fob(os.path.join(here, "keychain_outline.svg"))
    zone = build_print_zone(os.path.join(here, "print_zone.svg"), fob)
    ground = setup_scene(fob, zone)

    # Shadow catcher only in Cycles beauty passes
    white_diff = mat_white(0.55)
    white_gloss = mat_white(0.35, glossy=True)
    uv_mat = mat_uv()

    chain_and_ring = [o for o in bpy.data.objects if o.type == "MESH" and o.name not in ("Fob", "PrintZone", "Ground")]

    # --- beauty: bare metal zone ---
    configure_render("CYCLES", args.res, args.samples, transparent=True)
    set_hidden([ground], True)
    zone.data.materials.clear()
    zone.data.materials.append(bpy.data.materials["Metal"])
    render_to(os.path.join(args.out, "beauty.png"))

    # --- print zone white diffuse (lighting multiplier) ---
    zone.data.materials.clear()
    zone.data.materials.append(white_diff)
    render_to(os.path.join(args.out, "print_white.png"))

    # --- print zone glossy white (specular on ink) ---
    zone.data.materials.clear()
    zone.data.materials.append(white_gloss)
    render_to(os.path.join(args.out, "print_gloss.png"))

    # --- uv pass: only the print zone visible ---
    configure_render("BLENDER_EEVEE", args.res, 16, transparent=True)
    set_hidden([ground] + chain_and_ring + [fob], True)
    set_hidden([zone], False)
    zone.data.materials.clear()
    zone.data.materials.append(uv_mat)
    render_to(os.path.join(args.out, "uv.png"))

    print("DONE")


main()
