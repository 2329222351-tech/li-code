import bpy
from mathutils import Vector

SRC = r"D:\gr\naiwaRA\assets\nailong_colored.blend"
bpy.ops.wm.open_mainfile(filepath=SRC)
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]

# 两个 MIX_RGB 的输入状态
mat = bpy.data.materials['yellow']
nt = mat.node_tree
for n in nt.nodes:
    if n.type == 'MIX_RGB':
        print(f"MIX {n.name!r} blend={n.blend_type} fac_linked={n.inputs['Factor'].is_linked}")
        for s in ['Color1', 'Color2']:
            inp = n.inputs[s]
            print(f"   {s}: linked={inp.is_linked} default={tuple(round(x,3) for x in inp.default_value)}")

# 眼睛绿材质面的位置分布 -> 判断脸朝向
for matname in ['材质', '材质.001']:
    idx = list(mesh.data.materials).index(bpy.data.materials[matname])
    pts = []
    for p in mesh.data.polygons:
        if p.material_index == idx:
            pts.append(mesh.matrix_world @ p.center)
    if pts:
        c = sum(pts, Vector()) / len(pts)
        print(f"MAT {matname} faces={len(pts)} center={tuple(round(v,3) for v in c)}")

# 按 Z 分层看 XY 范围（帮助判断头部/帽子位置）
print("=== Z SLICES (world coords) ===")
pts = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
for zlo, zhi in [(0,0.3),(0.3,0.7),(0.7,1.1),(1.1,1.4),(1.4,1.7),(1.7,1.9)]:
    sel = [p for p in pts if zlo <= p.z < zhi]
    if sel:
        xs=[p.x for p in sel]; ys=[p.y for p in sel]
        print(f"  z[{zlo},{zhi}]: n={len(sel)} x[{min(xs):.2f},{max(xs):.2f}] y[{min(ys):.2f},{max(ys):.2f}]")
