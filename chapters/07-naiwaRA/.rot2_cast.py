import bpy, math, random
from mathutils import Vector

BLEND = r"D:\gr\naiwaRA\assets\milkfrog_cast.blend"
bpy.ops.wm.open_mainfile(filepath=BLEND)
random.seed(777)

# 更强的脏色：主体往黄绿污浊推，暗端褐黑
def filthy(rgb, dark=False):
    r,g,b = rgb[:3]
    if dark:
        return (r*0.26+0.05, g*0.25+0.05, b*0.16+0.03, 1.0)
    return (r*0.70+0.06, g*0.70+0.09, b*0.52+0.02, 1.0)

for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    if mat.name == 'M_RotSlime':
        b = next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'), None)
        if b:
            b.inputs['Base Color'].default_value = (0.52, 0.58, 0.32, 1)
            b.inputs['Roughness'].default_value = 0.08
        continue
    bsdf = next((n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'), None)
    if bsdf is None:
        continue
    base = bsdf.inputs['Base Color']
    if not base.is_linked:
        continue
    # 找到上一轮插入的 ramp（连到 base 的那个 ValToRGB）
    link = base.links[0]
    ramp = link.from_node
    if ramp.type != 'VALTORGB':
        continue
    # 从 ramp 亮端反推原色（用当前亮端值近似），重新填脏色
    bright = tuple(ramp.color_ramp.elements[1].color[:])
    ramp.color_ramp.elements[0].position = 0.46
    ramp.color_ramp.elements[0].color = filthy(bright, dark=True)
    ramp.color_ramp.elements[1].position = 0.70
    ramp.color_ramp.elements[1].color = filthy(bright)
    # 噪声更粗大斑驳
    nb = None
    for l in nt.links:
        if l.to_node == ramp and l.to_socket.name == 'Fac' and l.from_node.type == 'TEX_NOISE':
            nb = l.from_node; break
    if nb:
        nb.inputs['Scale'].default_value = 4.5
        nb.inputs['Detail'].default_value = 5.0

# 加更多黏液滴：每角色再补 3 条更长更明显的垂丝
slime = bpy.data.materials['M_RotSlime']
for col in list(bpy.data.collections):
    if not col.name.startswith('CHAR_'):
        continue
    objs = [o for o in col.objects if o.type == 'MESH' and 'Drip' not in o.name and 'Bead' not in o.name]
    main = max(objs, key=lambda o: len(o.data.vertices))
    pts = [main.matrix_world @ Vector(c) for c in main.bound_box]
    mnx = [min(p[i] for p in pts) for i in range(3)]
    mxx = [max(p[i] for p in pts) for i in range(3)]
    span = [mxx[i]-mnx[i] for i in range(3)]
    for i in range(3):
        x = mnx[0] + span[0]*random.uniform(0.25, 0.75)
        y = mxx[1] - span[1]*random.uniform(0.0, 0.3)
        ztop = mnx[2] + span[2]*random.uniform(0.5, 0.95)
        zbot = random.uniform(0.01, 0.10)
        if ztop - zbot < 0.08:
            continue
        rt = span[2]*random.uniform(0.02, 0.05)
        # 两节：上一节粗，下一节细，制造"拉丝"
        mid = (ztop+zbot)*0.5
        for j,(za,zb,ra) in enumerate([(mid,ztop,rt),(zbot,mid,rt*0.45)]):
            bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=ra*0.5, radius2=ra,
                                             depth=zb-za, location=(x, y, (za+zb)/2))
            d = bpy.context.object
            d.name = f'ROT2_{col.name}_String_{i}_{j}'
            for c in list(d.users_collection): c.objects.unlink(d)
            col.objects.link(d)
            d.data.materials.append(slime)
            for p in d.data.polygons: p.use_smooth = False
    print("FILTHIED", col.name, "objs", len(col.objects))

# 重新落地
for col in list(bpy.data.collections):
    if not col.name.startswith('CHAR_'):
        continue
    objs = list(col.objects)
    pts = []
    for o in objs:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = [min(p[i] for i in range(3)) for p in pts]
    mz = min(p[2] for p in pts)
    for o in objs:
        o.location.z -= mz

mapping = {'MilkSlime':'milk_slime','MilkingSpider':'milking_spider','MooVending':'moo_vending',
           'Pigeon':'pigeon','CloneFrogs':'clone_frogs','FrogGod':'frog_god'}
for col in list(bpy.data.collections):
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
