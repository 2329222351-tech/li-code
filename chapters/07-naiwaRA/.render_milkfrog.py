import bpy, math
from mathutils import Vector

BLEND = r"D:\gr\naiwaRA\assets\milkfrog_no13.blend"
OUT = r"D:\gr\naiwaRA\assets\milkfrog_no13_preview.png"
bpy.ops.wm.open_mainfile(filepath=BLEND)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
bg = next((n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND'), None)
if bg:
    bg.inputs['Color'].default_value = (0.55, 0.55, 0.56, 1.0)
    bg.inputs['Strength'].default_value = 0.8

# 目标中心
target = Vector((0, 0, 0.95))

def area(name, loc, energy, size, color=(1,1,1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy; data.shape = 'DISK'; data.size = size; data.color = color
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (target - o.location).to_track_quat('-Z', 'Y').to_euler()

area('Key',   (3.0, 4.0, 5.0), 900, 5.0, (1.0, 0.97, 0.9))
area('Fill',  (-4.0, 2.0, 3.0), 500, 5.0, (0.85, 0.9, 1.0))
area('Rim',   (0.0, -3.5, 4.0), 700, 4.0, (1.0, 1.0, 1.0))

cam_data = bpy.data.cameras.new('PreviewCam')
cam = bpy.data.objects.new('PreviewCam', cam_data)
scene.collection.objects.link(cam)
cam.location = (2.4, 4.4, 2.3)
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 50
scene.camera = cam

# 材质预览着色无需（渲染用真实材质）
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
