import bpy, math, random
from mathutils import Vector, noise

BLEND = r"D:\gr\naiwaRA\assets\milkfrog_cast.blend"
bpy.ops.wm.open_mainfile(filepath=BLEND)
random.seed(20261117)

def h01(s):
    v = math.sin(sum((i+1)*ord(c) for i,c in enumerate(s))*12.9898)*43758.5453
    return v - math.floor(v)

def dirty(rgb, dark=False):
    r,g,b = rgb[:3]
    if dark:
        return (r*0.40+0.02, g*0.38+0.03, b*0.30+0.01, 1.0)
    return (r*0.86+0.05, g*0.84+0.06, b*0.72+0.02, 1.0)

# ---------- 1. 材质：脏斑驳 + 局部湿反光 ----------
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    # 发光材质：把刺眼的纯色改成病态暗色
    for n in nt.nodes:
        if n.type == 'EMISSION':
            c = n.inputs['Color'].default_value[:]
            if mat.name == 'M_sensor':
                n.inputs['Color'].default_value = (0.55, 0.07, 0.04, 1)
                n.inputs['Strength'].default_value = 1.3
            elif mat.name == 'M_eye_green':
                n.inputs['Color'].default_value = (0.52, 0.60, 0.18, 1)
                n.inputs['Strength'].default_value = 0.3
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        continue
    base = bsdf.inputs['Base Color']
    if base.is_linked:
        continue
    orig = base.default_value[:]
    # 斑驳噪声
    tc = nt.nodes.new('ShaderNodeTexCoord'); tc.location = (-600, 100)
    nb = nt.nodes.new('ShaderNodeTexNoise'); nb.location = (-400, 100)
    nb.inputs['Scale'].default_value = 7.0
    nb.inputs['Detail'].default_value = 4.0
    nb.inputs['Roughness'].default_value = 0.75
    nt.links.new(tc.outputs['Generated'], nb.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.location = (-180, 120)
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = dirty(orig, dark=True)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = dirty(orig)
    nt.links.new(nb.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], base)
    # 湿反光：噪声驱动粗糙度，局部光滑
    nw = nt.nodes.new('ShaderNodeTexNoise'); nw.location = (-400, -180)
    nw.inputs['Scale'].default_value = 11.0
    nw.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Generated'], nw.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.location = (-180, -180)
    mr.inputs['From Min'].default_value = 0.35
    mr.inputs['From Max'].default_value = 0.70
    mr.inputs['To Min'].default_value = 0.12   # 湿
    mr.inputs['To Max'].default_value = 0.92   # 干
    nt.links.new(nw.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], bsdf.inputs['Roughness'])

# 黏液材质（湿亮）
slime = bpy.data.materials.new('M_RotSlime'); slime.use_nodes = True
b = next(n for n in slime.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
b.inputs['Base Color'].default_value = (0.68, 0.72, 0.52, 1)
b.inputs['Roughness'].default_value = 0.12
b.inputs['Metallic'].default_value = 0.0

# ---------- 2. 几何扰动 + 部件歪斜 ----------
def rot_geo(obj):
    mesh = obj.data
    if not mesh.vertices:
        return
    mn = [min(v.co[i] for v in mesh.vertices) for i in range(3)]
    mx = [max(v.co[i] for v in mesh.vertices) for i in range(3)]
    diag = math.sqrt(sum((mx[i]-mn[i])**2 for i in range(3)))
    amp = diag * 0.042
    off = Vector((h01(obj.name+'x')*13, h01(obj.name+'y')*13, h01(obj.name+'z')*13))
    for v in mesh.vertices:
        p = v.co + off
        nl = noise.noise_vector(p*1.6)
        nh = noise.noise_vector(p*5.5)
        v.co += nl*amp + nh*amp*0.30
    mesh.update()

for col in list(bpy.data.collections):
    if not col.name.startswith('CHAR_'):
        continue
    objs = [o for o in col.objects if o.type == 'MESH']
    for o in objs:
        rot_geo(o)
        # 部件歪斜：主体小幅，配件大幅
        k = 0.045 if len(o.data.vertices) > 400 else 0.11
        o.rotation_euler.x += random.uniform(-k, k)
        o.rotation_euler.y += random.uniform(-k, k)
        o.rotation_euler.z += random.uniform(-k*1.4, k*1.4)
        s = random.uniform(0.94, 1.06)
        o.scale *= s

    # ---------- 3. 黏液滴 + 拉丝 ----------
    main = max(objs, key=lambda o: len(o.data.vertices))
    pts = [main.matrix_world @ Vector(c) for c in main.bound_box]
    mnx = [min(p[i] for p in pts) for i in range(3)]
    mxx = [max(p[i] for p in pts) for i in range(3)]
    span = [mxx[i]-mnx[i] for i in range(3)]
    for i in range(4):
        x = mnx[0] + span[0]*random.uniform(0.2, 0.8)
        y = mnx[1] + span[1]*random.uniform(0.2, 0.8)
        ztop = mnx[2] + span[2]*random.uniform(0.45, 0.92)
        zbot = random.uniform(0.03, 0.22)
        if ztop - zbot < 0.05:
            continue
        rt = span[2]*random.uniform(0.02, 0.045)
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=rt*0.18, radius2=rt,
                                         depth=ztop-zbot, location=(x, y, (ztop+zbot)/2))
        drip = bpy.context.object
        drip.name = f'ROT_{col.name}_DripA_{i}'
        for c in list(drip.users_collection): c.objects.unlink(drip)
        col.objects.link(drip)
        drip.data.materials.append(slime)
        for p in drip.data.polygons: p.use_smooth = False
        # 将滴未滴的液珠
        if random.random() < 0.6:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=rt*0.55,
                                                  location=(x, y, zbot))
            bead = bpy.context.object
            bead.name = f'ROT_{col.name}_Bead_{i}'
            for c in list(bead.users_collection): c.objects.unlink(bead)
            col.objects.link(bead)
            bead.data.materials.append(slime)
            for p in bead.data.polygons: p.use_smooth = False
    print("ROTTED", col.name, "objs", len(col.objects))

# 重新落地居中
for col in list(bpy.data.collections):
    if not col.name.startswith('CHAR_'):
        continue
    objs = list(col.objects)
    pts = []
    for o in objs:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    cx, cy, mz = (mn[0]+mx[0])/2, (mn[1]+mx[1])/2, mn[2]
    for o in objs:
        o.location.x -= cx; o.location.y -= cy; o.location.z -= mz

# ---------- 导出 ----------
for col in list(bpy.data.collections):
    if not col.name.startswith('CHAR_'):
        continue
    name = col.name.replace('CHAR_', '').lower()
    # 映射回原文件名
    mapping = {'MilkSlime':'milk_slime','MilkingSpider':'milking_spider','MooVending':'moo_vending',
               'Pigeon':'pigeon','CloneFrogs':'clone_frogs','FrogGod':'frog_god'}
    fname = mapping.get(col.name.replace('CHAR_',''), name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(col.objects))
    path = rf"D:\gr\naiwaRA\assets\{fname}.glb"
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    print("EXPORTED", path)

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("SAVED", BLEND)
