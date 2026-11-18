import bpy, math, random
from mathutils import Vector

BLEND = r"D:\gr\naiwaRA\assets\milkfrog_cast.blend"
bpy.ops.wm.open_mainfile(filepath=BLEND)
random.seed(20261117)

def get(col, name):
    return next((o for o in col.objects if o.name == name), None)

def tw(col, name, sc=None, loc=None, rot=None):
    """对指定部件做不对称微调：sc 乘性缩放，loc 加性位移，rot 加性旋转"""
    o = get(col, name)
    if not o:
        return
    if sc:
        o.scale.x *= sc[0]; o.scale.y *= sc[1]; o.scale.z *= sc[2]
    if loc:
        o.location.x += loc[0]; o.location.y += loc[1]; o.location.z += loc[2]
    if rot:
        o.rotation_euler.x += rot[0]; o.rotation_euler.y += rot[1]; o.rotation_euler.z += rot[2]

def shear(o, sx=0.0, sy=0.0):
    """顶点剪切：让直立物体歪斜、不再规整"""
    if not o:
        return
    for v in o.data.vertices:
        v.co.x += v.co.z * sx
        v.co.y += v.co.z * sy
    o.data.update()

def group_transform(col, prefix, pivot, scale=(1,1,1), tilt=(0,0,0)):
    """整组（一只克隆蛙）绕枢轴缩放/倾斜，做出胖瘦高矮"""
    members = [o for o in col.objects if o.name.startswith(prefix)]
    for o in members:
        d = o.location - Vector(pivot)
        o.location = Vector(pivot) + Vector((d.x*scale[0], d.y*scale[1], d.z*scale[2]))
        o.scale.x *= scale[0]; o.scale.y *= scale[1]; o.scale.z *= scale[2]
        o.rotation_euler.x += tilt[0]; o.rotation_euler.y += tilt[1]; o.rotation_euler.z += tilt[2]

C = {c.name: c for c in bpy.data.collections}

# ---------- 蛙神 ----------
col = C['CHAR_FrogGod']
tw(col, 'G_Body', sc=(1.13, 0.88, 1.05), loc=(0.04, 0, -0.02))
shear(get(col, 'G_Body'), sx=0.055, sy=-0.02)
tw(col, 'G_Head', sc=(1.06, 0.94, 1.02), loc=(0.09, 0.02, 0.03), rot=(0, 0, 0.07))
tw(col, 'G_Eye_-1', sc=(0.82, 0.82, 0.82), loc=(-0.02, -0.02, 0.06), rot=(0,0,0.1))
tw(col, 'G_Eye_1',  sc=(1.18, 1.18, 1.18), loc=(0.05, 0.04, -0.05), rot=(0.06,0,-0.08))
tw(col, 'G_Pupil_-1', loc=(-0.02, -0.02, 0.06))
tw(col, 'G_Pupil_1',  loc=(0.05, 0.04, -0.05))
tw(col, 'G_Foot_-1', sc=(1.22, 1.1, 1.0), loc=(-0.06, 0, -0.02), rot=(0,0,0.12))
tw(col, 'G_Foot_1',  sc=(0.78, 0.9, 1.0), loc=(0.04, 0.03, 0.04), rot=(0,0,-0.18))
tw(col, 'G_Mouth', loc=(-0.12, 0.01, -0.04), rot=(0,0,-0.14), sc=(1.1,1,0.9))
for i in range(5):
    tw(col, f'G_Cloud_{i}',
       sc=(random.uniform(0.7,1.4), random.uniform(0.7,1.3), random.uniform(0.75,1.3)),
       loc=(random.uniform(-0.16,0.16), random.uniform(-0.12,0.12), random.uniform(-0.14,0.14)),
       rot=(random.uniform(-0.2,0.2), random.uniform(-0.2,0.2), random.uniform(-0.3,0.3)))
tw(col, 'G_Crown', loc=(0.07, -0.02, 0.02), rot=(0.05, -0.06, 0.13))
tw(col, 'G_CrownRim', loc=(0.07, -0.02, 0.02), rot=(0.05, -0.06, 0.13))
for i in range(8):
    tw(col, f'G_CrownTooth_{i}', loc=(0.07, -0.02, 0.02), rot=(0.05, -0.06, 0.13),
       sc=(random.uniform(0.7,1.3), random.uniform(0.7,1.3), random.uniform(0.6,1.4)))

# ---------- 挤奶机蜘蛛：八腿打乱 ----------
col = C['CHAR_MilkingSpider']
tw(col, 'Spider_Body', sc=(1.1, 0.9, 1.06), loc=(-0.03, 0, 0))
shear(get(col, 'Spider_Body'), sx=-0.04)
tw(col, 'Spider_Hump', loc=(0.07, -0.04, 0.03), sc=(0.85,1.1,0.9), rot=(0,0,0.15))
tw(col, 'Spider_Eye', loc=(0.06, 0.01, 0.02), sc=(0.9,0.9,1.1))
tw(col, 'Spider_Pipe', loc=(-0.05, 0.02, -0.03), rot=(0.06, -0.08, 0.05))
tw(col, 'Spider_Nozzle', loc=(0.08, 0, 0.04), rot=(0, 0.12, -0.15))
for i in range(8):
    f = random.uniform(0.68, 1.32)
    tw(col, f'Spider_LegA_{i}', sc=(1, f, 1), loc=(random.uniform(-0.05,0.05), random.uniform(-0.05,0.05), 0),
       rot=(random.uniform(-0.1,0.1), random.uniform(-0.1,0.1), random.uniform(-0.18,0.18)))
    tw(col, f'Spider_LegB_{i}', sc=(1, random.uniform(0.7,1.3), 1),
       rot=(random.uniform(-0.15,0.15), random.uniform(-0.15,0.15), random.uniform(-0.2,0.2)))

# ---------- 哞哞酱售货机：歪斜的箱体 ----------
col = C['CHAR_MooVending']
tw(col, 'V_Body', sc=(1.06, 0.94, 1.02), rot=(0.02, 0.03, -0.045))
shear(get(col, 'V_Body'), sx=0.09, sy=0.03)
for n in ['V_Panel','V_Face','V_Patch1','V_Patch2','V_Eye1','V_Eye2','V_Nose','V_Slot','V_Button_0','V_Button_1','V_Button_2']:
    tw(col, n, loc=(0.03, 0, -0.01), rot=(0.01, 0.02, -0.045))
tw(col, 'V_Eye1', sc=(1.25,1,1.25), loc=(-0.03, 0, 0.03))
tw(col, 'V_Eye2', sc=(0.75,1,0.8), loc=(0.03, 0, -0.02))
tw(col, 'V_Horn_-1', sc=(0.75,1,0.75), rot=(0,0,0.28))
tw(col, 'V_Horn_1', sc=(1.3,1,1.3), rot=(0,0,-0.12), loc=(0.02,0,-0.02))
tw(col, 'V_Patch1', loc=(-0.06, 0, 0.05), sc=(1.2,1,0.8))
tw(col, 'V_Patch2', loc=(0.05, 0, -0.04), sc=(0.8,1,1.3))

# ---------- 鸽子：一翅下垂、一翅张开 ----------
col = C['CHAR_Pigeon']
tw(col, 'P_Body', sc=(1.08, 0.92, 1.04), loc=(0.02,0,-0.01), rot=(0,0,0.06))
shear(get(col, 'P_Body'), sx=-0.05)
tw(col, 'P_Head', loc=(-0.04, 0.02, 0.03), rot=(0,0,-0.09))
tw(col, 'P_Wing_-1', sc=(1.3, 1.15, 0.8), loc=(-0.05,-0.02,-0.03), rot=(0.2, 0.1, 0.35))
tw(col, 'P_Wing_1',  sc=(0.7, 0.85, 1.2), loc=(0.04, 0.02, 0.04), rot=(-0.25,-0.1,-0.4))
tw(col, 'P_Eye_-1', sc=(1.3,1,1.3), loc=(-0.01,0,0.01))
tw(col, 'P_Eye_1',  sc=(0.7,1,0.7), loc=(0.01,0,-0.01))
tw(col, 'P_Beak', loc=(-0.02, 0, -0.01), rot=(0,0,-0.12))
tw(col, 'P_Tail', rot=(0.1, 0.15, 0.2), loc=(0.03,-0.03,0))
tw(col, 'P_KeyShaft', rot=(0,0,0.25), loc=(0.01,0,0))
tw(col, 'P_KeyBow', rot=(0,0,0.25), loc=(0.01,0,0))

# ---------- 奶渍怪：不对称的一摊 ----------
col = C['CHAR_MilkSlime']
tw(col, 'Slime_Puddle', sc=(1.16, 0.86, 1.1), rot=(0,0,-0.08))
shear(get(col, 'Slime_Puddle'), sx=0.06)
tw(col, 'Slime_Blob', loc=(-0.09, 0.04, 0.02), sc=(1.12, 0.88, 1.05), rot=(0,0,0.12))
tw(col, 'Slime_Leg_-1', sc=(1.25,1,1), loc=(-0.04,0,0), rot=(0,0,0.16))
tw(col, 'Slime_Leg_1',  sc=(0.75,1,0.85), loc=(0.03,0,-0.01), rot=(0,0,-0.2))
for i in range(3):
    tw(col, f'Slime_Drip_{i}', sc=(random.uniform(0.7,1.4), random.uniform(0.7,1.3), random.uniform(0.6,1.5)),
       loc=(random.uniform(-0.05,0.05), random.uniform(-0.04,0.04), 0),
       rot=(random.uniform(-0.2,0.2), random.uniform(-0.2,0.2), 0))

# ---------- 克隆奶蛙群：三只胖瘦高矮各异 ----------
col = C['CHAR_CloneFrogs']
group_transform(col, 'C1_', pivot=(-0.6,0,0.3), scale=(1.18, 1.05, 0.85), tilt=(0,0,0.09))
group_transform(col, 'C2_', pivot=(0,0,0.3),    scale=(0.86, 0.92, 1.22), tilt=(0,0,-0.07))
group_transform(col, 'C3_', pivot=(0.6,0,0.3),  scale=(1.02, 1.12, 1.0),  tilt=(0,0,0.15))
for idx in (1,2,3):
    tw(col, f'C{idx}_Body', sc=(1.08, 0.93, 1.04))
    shear(get(col, f'C{idx}_Body'), sx=random.uniform(-0.08,0.08))
    tw(col, f'C{idx}_Eye_-1', sc=(0.85,0.85,0.85), loc=(-0.015,0,0.015))
    tw(col, f'C{idx}_Eye_1',  sc=(1.15,1.15,1.15), loc=(0.015,0,-0.015))
    tw(col, f'C{idx}_Pupil_-1', sc=(0.85,0.85,0.85), loc=(-0.015,0,0.015))
    tw(col, f'C{idx}_Pupil_1',  sc=(1.15,1.15,1.15), loc=(0.015,0,-0.015))
    tw(col, f'C{idx}_Foot_-1', sc=(1.2,1,1), loc=(-0.02,0,0))
    tw(col, f'C{idx}_Foot_1',  sc=(0.8,1,0.9), loc=(0.02,0,0))
    tw(col, f'C{idx}_Tag', rot=(0,0,random.uniform(-0.25,0.25)), loc=(0.01,0,-0.01))

# 重新落地居中
for col in C.values():
    if not col.name.startswith('CHAR_'):
        continue
    objs = [o for o in col.objects if o.type == 'MESH']
    pts = []
    for o in objs:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    cx, cy, mz = (mn[0]+mx[0])/2, (mn[1]+mx[1])/2, mn[2]
    for o in objs:
        o.location.x -= cx; o.location.y -= cy; o.location.z -= mz
    print("SHAPED", col.name, "objs", len(objs))

# 导出
mapping = {'MilkSlime':'milk_slime','MilkingSpider':'milking_spider','MooVending':'moo_vending',
           'Pigeon':'pigeon','CloneFrogs':'clone_frogs','FrogGod':'frog_god'}
for col in C.values():
    if not col.name.startswith('CHAR_'):
        continue
    fname = mapping[col.name.replace('CHAR_','')]
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(col.objects))
    path = rf"D:\gr\naiwaRA\assets\{fname}.glb"
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print("EXPORTED", path)

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("SAVED", BLEND)
