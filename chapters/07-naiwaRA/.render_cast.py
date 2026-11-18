import bpy, math
from mathutils import Vector

BLEND = r"D:\gr\naiwaRA\assets\milkfrog_cast.blend"
OUT = r"D:\gr\naiwaRA\assets\milkfrog_cast_gallery.png"
bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
bg = next((n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'), None)
if bg:
    bg.inputs['Color'].default_value = (0.20, 0.22, 0.20, 1)
    bg.inputs['Strength'].default_value = 0.55

# 角色排位（场景 X；相机在 +Y 侧，画面左右与场景 X 镜像）
order = [
    ('CHAR_CloneFrogs', -5.4),
    ('CHAR_MilkSlime', -3.2),
    ('CHAR_Pigeon', -1.6),
    ('CHAR_MooVending', 0.0),
    ('CHAR_MilkingSpider', 1.9),
    ('CHAR_FrogGod', 4.2),
]
for cname, x in order:
    col = bpy.data.collections[cname]
    for o in col.objects:
        o.location.x += x

# 地面
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,-0.01))
ground = bpy.context.object
gm = bpy.data.materials.new('Ground'); gm.use_nodes = True
b = next(n for n in gm.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
b.inputs['Base Color'].default_value = (0.30,0.31,0.32,1); b.inputs['Roughness'].default_value=1
ground.data.materials.append(gm)

def area(name, loc, energy, size, target, color=(1,1,1)):
    d = bpy.data.lights.new(name, 'AREA'); d.energy=energy; d.shape='DISK'; d.size=size; d.color=color
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location=loc
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

t = (0,0,0.8)
area('Key', (2,8,10), 1400, 12, t, (0.95,0.93,0.82))
area('Fill', (-8,5,7), 600, 12, t, (0.70,0.78,0.85))
area('Rim', (0,-6,8), 900, 10, t, (0.85,0.90,0.80))

cam_d = bpy.data.cameras.new('GalleryCam'); cam = bpy.data.objects.new('GalleryCam', cam_d)
scene.collection.objects.link(cam); cam.location=(-0.6,17,3.4)
cam.rotation_euler = (Vector((-0.6,0,0.9))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_d.lens = 44
scene.camera = cam

scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
