import bpy, math
from mathutils import Vector

OUT = r"D:\gr\naiwaRA\assets"
CAST_BLEND = OUT + r"\milkfrog_cast.blend"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- 色板（项目三幕） ----------
C = {
    'sick_white': (0.90, 0.886, 0.812),
    'dirty_milk': (0.847, 0.831, 0.737),
    'rust':       (0.549, 0.231, 0.180),
    'fluor_green':(0.525, 0.761, 0.294),
    'dark':       (0.110, 0.114, 0.141),
    'mold_green': (0.494, 0.545, 0.227),
    'cheese':     (0.851, 0.722, 0.290),
    'brown':      (0.353, 0.251, 0.188),
    'mother_pink':(0.878, 0.420, 0.620),
    'warn_yellow':(0.910, 0.753, 0.165),
    'deep_red':   (0.431, 0.122, 0.165),
    'steel':      (0.42, 0.44, 0.43),
    'pink_nose':  (0.90, 0.62, 0.68),
    'gold':       (0.90, 0.75, 0.30),
}

def make_mat(name, rgb, rough=0.9, metallic=0.0, emit=None, emit_str=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    if emit:
        e = m.node_tree.nodes.new('ShaderNodeEmission')
        e.inputs['Color'].default_value = (*emit, 1); e.inputs['Strength'].default_value = emit_str
        out = next(n for n in m.node_tree.nodes if n.type == 'OUTPUT_MATERIAL')
        m.node_tree.links.new(e.outputs['Emission'], out.inputs['Surface'])
    return m

M = {k: make_mat('M_' + k, v) for k, v in C.items()}
M['sensor'] = make_mat('M_sensor', (1,0,0), emit=(1,0.05,0.02), emit_str=2.5)
M['eye_green'] = make_mat('M_eye_green', C['fluor_green'], emit=C['fluor_green'], emit_str=0.4)

def new_col(name):
    col = bpy.data.collections.new(name); scene.collection.children.link(col); return col

def reg(obj, col, mat):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)
    if mat: obj.data.materials.append(mat)
    for p in obj.data.polygons: p.use_smooth = False
    return obj

def cube(name, loc, size, mat, col, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.dimensions = size
    if rot: o.rotation_euler = rot
    with bpy.context.temp_override(active_object=o, selected_objects=[o]):
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return reg(o, col, mat)

def sphere(name, loc, radius, mat, col, scale=None, seg=10, rings=7):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=radius, location=loc)
    o = bpy.context.object; o.name = name
    if scale: o.scale = scale
    return reg(o, col, mat)

def cyl(name, loc, radius, depth, mat, col, verts=8, rot=None, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=r2, depth=depth, location=loc)
    o = bpy.context.object; o.name = name
    if rot: o.rotation_euler = rot
    return reg(o, col, mat)

def torus(name, loc, major, minor, mat, col, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc)
    o = bpy.context.object; o.name = name
    if rot: o.rotation_euler = rot
    return reg(o, col, mat)

def rod(name, a, b, radius, mat, col, verts=6):
    a, b = Vector(a), Vector(b); d = b - a
    o = cyl(name, tuple((a+b)/2), radius, d.length, mat, col, verts=verts)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o

def ground(col, zoff=0.0):
    """把该 collection 所有物体整体落地并居中 xy"""
    objs = list(col.objects)
    pts = []
    for o in objs:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    cx, cy, mz = (mn[0]+mx[0])/2, (mn[1]+mx[1])/2, mn[2]
    for o in objs:
        o.location.x -= cx; o.location.y -= cy; o.location.z -= mz - zoff
    return (mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2])

chars = {}

# ============ 1. 奶渍怪 ============
def build_slime():
    col = new_col('CHAR_MilkSlime')
    sphere('Slime_Puddle', (0,0,0.10), 0.5, M['dirty_milk'], col, scale=(1.1,0.9,0.28), seg=12, rings=6)
    sphere('Slime_Blob', (0.03,0,0.32), 0.30, M['dirty_milk'], col, scale=(1,0.85,1.0), seg=10, rings=6)
    for s in (-1,1):
        cyl(f'Slime_Leg_{s}', (s*0.20,0,0.07), 0.075, 0.16, M['brown'], col, verts=6)
    for i,(x,y,z,r) in enumerate([(-0.25,0.05,0.36,0.09),(0.28,-0.08,0.30,0.07),(0.05,0.18,0.22,0.08)]):
        sphere(f'Slime_Drip_{i}', (x,y,z), r, M['dirty_milk'], col, scale=(1,1,1.3), seg=8, rings=5)
    chars['milk_slime'] = col
    return ground(col)

# ============ 2. 挤奶机蜘蛛 ============
def build_spider():
    col = new_col('CHAR_MilkingSpider')
    sphere('Spider_Body', (0,0,0.55), 0.34, M['steel'], col, scale=(1.0,1.15,0.8), seg=10, rings=6)
    sphere('Spider_Hump', (0,-0.05,0.72), 0.22, M['brown'], col, scale=(1,1,0.7), seg=8, rings=5)
    # 红传感器眼
    sphere('Spider_Eye', (0,0.31,0.56), 0.11, M['sensor'], col, seg=10, rings=6)
    sphere('Spider_EyeRim', (0,0.28,0.56), 0.14, M['dark'], col, scale=(1,0.5,1), seg=10, rings=6)
    # 挤奶管（顶部竖管 + 弯头）
    cyl('Spider_Pipe', (0,-0.05,0.95), 0.06, 0.42, M['steel'], col, verts=8)
    cyl('Spider_Nozzle', (0.14,-0.05,1.14), 0.045, 0.28, M['rust'], col, verts=8, rot=(0,0,math.radians(70)))
    # 8 条管子腿
    for i in range(8):
        ang = i*math.pi/4 + 0.2
        sx, sy = math.cos(ang), math.sin(ang)
        knee = (sx*0.55, sy*0.55, 0.42)
        foot = (sx*0.78, sy*0.78, 0.04)
        rod(f'Spider_LegA_{i}', (sx*0.26, sy*0.26, 0.55), knee, 0.045, M['steel'], col)
        rod(f'Spider_LegB_{i}', knee, foot, 0.035, M['rust'], col)
    chars['milking_spider'] = col
    return ground(col)

# ============ 3. 哞哞酱售货机 ============
def build_vending():
    col = new_col('CHAR_MooVending')
    cube('V_Body', (0,0,0.62), (0.82,0.52,1.24), M['rust'], col)
    cube('V_Panel', (0,0.27,0.74), (0.66,0.03,0.56), M['sick_white'], col)
    # 像素奶牛脸：白斑 + 黑斑
    cube('V_Face', (0,0.29,0.76), (0.56,0.02,0.46), M['sick_white'], col)
    cube('V_Patch1', (-0.17,0.30,0.88), (0.18,0.02,0.14), M['dark'], col)
    cube('V_Patch2', (0.19,0.30,0.66), (0.14,0.02,0.16), M['dark'], col)
    cube('V_Eye1', (-0.13,0.31,0.79), (0.07,0.02,0.07), M['dark'], col)
    cube('V_Eye2', (0.13,0.31,0.79), (0.07,0.02,0.07), M['dark'], col)
    cube('V_Nose', (0,0.32,0.68), (0.22,0.03,0.13), M['pink_nose'], col)
    # 小角
    for s in (-1,1):
        cyl(f'V_Horn_{s}', (s*0.22,0.28,1.0), 0.05, 0.16, M['cheese'], col, verts=6, r2=0.01)
    # 出货口 + 按钮
    cube('V_Slot', (0,0.28,0.26), (0.5,0.03,0.18), M['dark'], col)
    for i in range(3):
        cube(f'V_Button_{i}', (-0.22+i*0.1,0.29,0.42), (0.06,0.02,0.06), M['fluor_green'] if i!=1 else M['warn_yellow'], col)
    chars['moo_vending'] = col
    return ground(col)

# ============ 4. 鸽子 ============
def build_pigeon():
    col = new_col('CHAR_Pigeon')
    sphere('P_Body', (0,0,0.30), 0.22, M['steel'], col, scale=(1,1.25,0.85), seg=10, rings=6)
    sphere('P_Head', (0,0.19,0.52), 0.13, M['steel'], col, seg=10, rings=6)
    cyl('P_Beak', (0,0.33,0.51), 0.07, 0.16, M['cheese'], col, verts=6, r2=0.005, rot=(math.pi/2,0,0))
    for s in (-1,1):
        sphere(f'P_Eye_{s}', (s*0.10,0.27,0.55), 0.027, M['dark'], col, seg=8, rings=5)
        w = sphere(f'P_Wing_{s}', (s*0.20,0.0,0.32), 0.14, M['brown'], col, scale=(0.45,1.1,0.7), seg=8, rings=5)
        w.rotation_euler = (0, s*0.25, s*0.2)
    # 尾巴
    cube('P_Tail', (0,-0.26,0.28), (0.12,0.20,0.04), M['brown'], col, rot=(0.25,0,0))
    # 吸管缠左翅
    rod('P_Straw1', (-0.30,-0.10,0.22), (-0.12,0.12,0.45), 0.018, M['sick_white'], col, verts=6)
    rod('P_Straw2', (-0.12,0.12,0.45), (0.06,-0.02,0.30), 0.018, M['sick_white'], col, verts=6)
    # 嘴里的小钥匙
    cube('P_KeyShaft', (0,0.45,0.50), (0.022,0.18,0.022), M['gold'], col)
    torus('P_KeyBow', (0,0.37,0.50), 0.045, 0.014, M['gold'], col, rot=(math.pi/2,0,0))
    chars['pigeon'] = col
    return ground(col)

# ============ 5. 克隆奶蛙群（NO.01-12 代表 3 只） ============
def make_clone(col, x, tagmat, idx):
    sphere(f'C{idx}_Body', (x,0,0.26), 0.26, M['sick_white'], col, scale=(1,0.92,1.1), seg=10, rings=6)
    for s in (-1,1):
        sphere(f'C{idx}_Eye_{s}', (x+s*0.12,0.15,0.42), 0.065, M['eye_green'], col, seg=8, rings=5)
        sphere(f'C{idx}_Pupil_{s}', (x+s*0.12,0.20,0.42), 0.028, M['dark'], col, seg=8, rings=5)
        sphere(f'C{idx}_Foot_{s}', (x+s*0.16,0.06,0.05), 0.10, M['brown'], col, scale=(1.2,1,0.5), seg=8, rings=5)
    cube(f'C{idx}_Tag', (x,0.24,0.24), (0.17,0.02,0.13), tagmat, col)
    torus(f'C{idx}_Cord', (x,0.22,0.36), 0.09, 0.012, M['dark'], col, rot=(math.pi/2,0,0))

def build_clones():
    col = new_col('CHAR_CloneFrogs')
    for i,(x,tm) in enumerate([(-0.62,M['rust']), (0,M['fluor_green']), (0.62,M['mother_pink'])]):
        make_clone(col, x, tm, i+1)
    chars['clone_frogs'] = col
    return ground(col)

# ============ 6. 蛙神（巨大奶蛙） ============
def build_frogod():
    col = new_col('CHAR_FrogGod')
    # 身体
    sphere('G_Body', (0,0,1.0), 0.85, M['sick_white'], col, scale=(1,0.88,1.1), seg=14, rings=9)
    sphere('G_Head', (0,0.0,1.55), 0.6, M['sick_white'], col, scale=(1.15,0.9,0.8), seg=12, rings=8)
    for s in (-1,1):
        sphere(f'G_Eye_{s}', (s*0.35,0.42,1.78), 0.22, M['eye_green'], col, seg=12, rings=8)
        sphere(f'G_Pupil_{s}', (s*0.35,0.58,1.78), 0.09, M['dark'], col, seg=10, rings=6)
        sphere(f'G_Foot_{s}', (s*0.55,0.18,0.12), 0.28, M['brown'], col, scale=(1.2,1.4,0.4), seg=10, rings=6)
    # 宽嘴（暗色弧）
    torus('G_Mouth', (0,0.52,1.32), 0.32, 0.045, M['deep_red'], col, rot=(math.pi/2,0,0))
    # 奶牛纹云披风
    for i,(x,y,z,r) in enumerate([(-0.95,-0.15,1.35,0.42),(-0.5,-0.35,1.6,0.38),(0.5,-0.35,1.6,0.38),
                                   (0.95,-0.15,1.35,0.42),(0,-0.45,1.2,0.45)]):
        sphere(f'G_Cloud_{i}', (x,y,z), r, M['sick_white'], col, scale=(1.2,0.7,0.8), seg=10, rings=6)
    for i,(x,y,z) in enumerate([(-0.95,0.12,1.45),(0.5,0.0,1.72),(0.95,0.10,1.45)]):
        sphere(f'G_CloudSpot_{i}', (x,y,z), 0.12, M['dark'], col, scale=(1.2,0.4,0.7), seg=8, rings=5)
    # 奶瓶盖王冠
    cyl('G_Crown', (0,0,2.02), 0.34, 0.16, M['sick_white'], col, verts=16)
    torus('G_CrownRim', (0,0,1.94), 0.33, 0.04, M['rust'], col)
    for i in range(8):
        a = i*math.pi/4
        cube(f'G_CrownTooth_{i}', (math.cos(a)*0.30, math.sin(a)*0.30, 2.16), (0.09,0.09,0.16), M['sick_white'], col)
    chars['frog_god'] = col
    return ground(col)

# ---------- 构建全部 ----------
sizes = {}
for fn in (build_slime, build_spider, build_vending, build_pigeon, build_clones, build_frogod):
    key = list(chars.keys())
    before = set(chars.keys())
    sz = fn()
    newk = [k for k in chars.keys() if k not in before][0]
    sizes[newk] = sz
    print(f"BUILT {newk}: polys~{sum(len(o.data.polygons) for o in chars[newk].objects if o.type=='MESH')} size={[round(v,2) for v in sz]}")

# ---------- 单独导出每个角色 GLB ----------
for name, col in chars.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(col.objects))
    path = f"{OUT}\\{name}.glb"
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print("EXPORTED", path)

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=CAST_BLEND)
print("SAVED CAST", CAST_BLEND)
