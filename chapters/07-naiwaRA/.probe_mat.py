import bpy

src = r"D:\gr\naiwaRA\assets\nailong_colored.blend"
bpy.ops.wm.open_mainfile(filepath=src)
mesh = [o for o in bpy.data.objects if o.type == 'MESH'][0]

for m in mesh.data.materials:
    print(f"=== MATERIAL {m.name!r} use_nodes={m.use_nodes} ===")
    if not m.use_nodes:
        continue
    nt = m.node_tree
    for n in nt.nodes:
        extra = ""
        if n.type == 'BSDF_PRINCIPLED':
            bc = n.inputs.get('Base Color')
            extra = " BaseColor=" + str(tuple(round(x,3) for x in bc.default_value)) if bc and not bc.is_linked else " BaseColor<-linked"
        if n.type == 'TEX_IMAGE':
            extra = f" image={n.image.name if n.image else None}"
        if n.type == 'VALTORGB':
            stops = [(round(e.position,3), tuple(round(x,3) for x in e.color)) for e in n.color_ramp.elements]
            extra = f" ramp={stops}"
        if n.type == 'RGB':
            extra = " color=" + str(tuple(round(x,3) for x in n.outputs[0].default_value))
        if n.type == 'MIX_RGB' or n.type == 'MIX':
            extra = f" blend={getattr(n,'blend_type','')}"
        print(f"  NODE {n.name!r} type={n.type}{extra}")
    print("  --- LINKS ---")
    for l in nt.links:
        print(f"    {l.from_node.name}.{l.from_socket.name} -> {l.to_node.name}.{l.to_socket.name}")

print("=== VERTEX COLOR ATTRS ===")
print([a.name for a in mesh.data.color_attributes])
