import bpy
from mathutils import Vector

src = r"D:\gr\naiwaRA\assets\nailong_colored.blend"
bpy.ops.wm.open_mainfile(filepath=src)

print("=== SCENE OBJECTS ===")
for o in bpy.data.objects:
    print(f"OBJ {o.name!r} type={o.type} loc={[round(v,3) for v in o.location]} scale={[round(v,3) for v in o.scale]}")

mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]
print("=== MESH ===")
print("name", mesh.name, "verts", len(mesh.data.vertices), "polys", len(mesh.data.polygons))

def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = [min(p[i] for p in pts) for i in range(3)]
    mx = [max(p[i] for p in pts) for i in range(3)]
    return mn, mx
mn, mx = bbox(mesh)
print("BBOX", [round(v,3) for v in mn], [round(v,3) for v in mx])

print("=== MATERIAL SLOTS ===")
for i, m in enumerate(mesh.data.materials):
    print(f"SLOT {i}: {m.name!r}")
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                bc = n.inputs.get('Base Color')
                print("   BaseColor", tuple(round(x,3) for x in bc.default_value) if bc else None)

print("=== POLYGON MATERIAL DISTRIBUTION ===")
from collections import Counter
c = Counter(p.material_index for p in mesh.data.polygons)
for k, v in sorted(c.items()):
    print(f"  mat_index {k}: {v} faces")

print("=== VERTEX GROUPS ===")
print([g.name for g in mesh.vertex_groups])
