import bpy, math
from mathutils import Vector

SRC = r"D:\gr\naiwaRA\assets\nailong_colored.blend"
OUT_BLEND = r"D:\gr\naiwaRA\assets\milkfrog_no13.blend"
OUT_GLB = r"D:\gr\naiwaRA\assets\milkfrog_no13.glb"

bpy.ops.wm.open_mainfile(filepath=SRC)

# ---- 找到主体网格 ----
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
mesh.name = "MilkFrog_NO13_Body"

def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    return mn, mx

mn, mx = bbox(mesh)
cx, cy = (mn[0]+mx[0])/2, (mn[1]+mx[1])/2
minz = mn[2]
W, H, D = mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]
print("BODY SIZE", round(W,3), round(D,3), round(H,3))

# 落地 + 居中（直接改顶点，保证导出正确）
for v in mesh.data.vertices:
    w = mesh.matrix_world @ v.co
    v.co = mesh.matrix_world.inverted() @ Vector((w.x-cx, w.y-cy, w.z-minz))
bpy.context.view_layer.update()
mn2, mx2 = bbox(mesh)
H = mx2[2]-mn2[2]
print("BBOX after", [round(v,3) for v in mn2], [round(v,3) for v in mx2])

# ---- 配色改造 ----
def set_bsdf_color(mat, rgb, rough=0.75):
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            n.inputs['Base Color'].default_value = (*rgb, 1.0)
            n.inputs['Roughness'].default_value = rough

# 眼睛：荧光绿（项目点缀色）
set_bsdf_color(bpy.data.materials['材质'], (0.31, 0.62, 0.18))  # 绿眼
set_bsdf_color(bpy.data.materials['材质.001'], (0.02, 0.02, 0.02))  # 瞳孔
set_bsdf_color(bpy.data.materials['材质.002'], (0.05, 0.04, 0.03))  # 嘴/细节

# 主体：yellow 是两层 MIX_RGB 混合。
#   第一层 混合(旧版)      : Color1 橙黄(主体) / Color2 深褐(手脚) —— factor 程序化
#   第二层 混合(旧版).001  : Color1 链接自第一层 / Color2 浅褐(肚皮) —— factor 程序化
# 把这三处实色改成病奶白色板的层次，保留原有程序化明暗分布。
yellow = bpy.data.materials['yellow']
nt = yellow.node_tree
for n in nt.nodes:
    if n.type != 'MIX_RGB':
        continue
    if n.name.endswith('.001'):
        n.inputs['Color2'].default_value = (0.94, 0.92, 0.85, 1.0)  # 肚皮：亮奶白
    else:
        n.inputs['Color1'].default_value = (0.90, 0.89, 0.81, 1.0)  # 主体：病奶白 #E6E2CF
        n.inputs['Color2'].default_value = (0.30, 0.28, 0.21, 1.0)  # 手脚：脏褐

# ---- 材质工具 ----
def make_mat(name, rgb, rough=0.8, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    return m

mat_cap = make_mat('Cap_MilkWhite', (0.93, 0.92, 0.85))
mat_cap_ring = make_mat('Cap_RustRed', (0.55, 0.23, 0.18))
mat_tag = make_mat('Tag_Paper', (0.88, 0.86, 0.74))
mat_tag_ink = make_mat('Tag_Ink', (0.10, 0.10, 0.09))
mat_pack = make_mat('Pack_Bottle', (0.86, 0.88, 0.80))
mat_nipple = make_mat('Pack_Nipple', (0.62, 0.42, 0.34))

def finish(obj, material=None):
    if material:
        obj.data.materials.append(material)
    return obj

def add_cyl(name, radius, depth, loc, mat, verts=24, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    if rot: o.rotation_euler = rot
    return finish(o, mat)

def add_torus(name, major, minor, loc, mat, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc)
    o = bpy.context.object
    o.name = name
    if rot: o.rotation_euler = rot
    return finish(o, mat)

def add_box(name, size, loc, mat, bevel=0.0, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    if rot: o.rotation_euler = rot
    with bpy.context.temp_override(active_object=o, selected_objects=[o]):
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = o.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel; mod.segments = 3
    return finish(o, mat)

def add_uvsphere(name, radius, loc, mat, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=loc)
    o = bpy.context.object
    o.name = name
    if scale: o.scale = scale
    return finish(o, mat)

# ---- 配饰尺寸基于模型包围盒 ----
head_z = mx2[2]                      # 头顶
head_w = W                           # 整体宽
cap_r = head_w * 0.26                # 奶瓶盖半径
print("HEAD Z", round(head_z,3), "CAP R", round(cap_r,3))

# 1) 奶瓶盖帽子（歪一点）— 压到头顶，别像飞碟浮空
cap = add_cyl('NO13_Cap', cap_r, cap_r*0.42, (0.02, -0.01, head_z - cap_r*0.05), mat_cap, verts=28)
cap.rotation_euler = (math.radians(6), math.radians(-8), math.radians(10))
add_torus('NO13_CapRim', cap_r*0.98, cap_r*0.08, (0.02, -0.01, head_z + cap_r*0.14), mat_cap_ring)

# 2) NO.13 吊牌（贴胸口）— 脸朝 +Y，胸口 Y 比身体最宽处窄，故用实测值贴近
tag_z = head_z*0.72
tag_front = D*0.38
tag = add_cyl('NO13_Tag', head_w*0.12, head_w*0.02, (0, tag_front, tag_z), mat_tag, verts=6, rot=(math.pi/2,0,0))
# 吊牌绳
add_torus('NO13_TagCord', head_w*0.11, head_w*0.008, (0, tag_front-0.01, tag_z+head_w*0.13), mat_tag_ink, rot=(math.pi/2,0,0))

# 3) 小奶瓶包（背后）— 背在 -Y
pack_z = head_z*0.48
pack_y = -D*0.40 - head_w*0.05
add_cyl('NO13_PackBottle', head_w*0.13, head_w*0.30, (0, pack_y, pack_z), mat_pack, verts=20)
add_cyl('NO13_PackNipple', head_w*0.06, head_w*0.08, (0, pack_y, pack_z+head_w*0.19), mat_nipple, verts=16)
add_box('NO13_PackStrap', (head_w*0.04, head_w*0.02, head_w*0.30), (head_w*0.13, pack_y+head_w*0.06, pack_z), mat_nipple)

# ---- 保存 BLEND ----
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("SAVED BLEND", OUT_BLEND)

# ---- 导出 GLB（只角色相关，不带相机灯）----
for o in list(bpy.data.objects):
    if o.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED GLB", OUT_GLB)
print("OBJECTS", [(o.name, o.type) for o in bpy.data.objects])
