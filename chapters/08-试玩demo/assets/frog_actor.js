// Instances own their bones but share immutable geometry and materials.
(function (global) {
  "use strict";
  var THREE = global.THREE, template = null, bounds = null, serial = 0;
  var key = function (name) { return name.replace(/[.\s_]/g, ""); };
  var ready = new Promise(function (resolve, reject) {
    if (!THREE || !global.GLTFLoader || !global.MILKFROG_RIG_B64) {
      reject(new Error("FrogActor: missing local Three/loader/rig data"));
      return;
    }
    try {
      var text = atob(global.MILKFROG_RIG_B64), bytes = new Uint8Array(text.length);
      for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      new global.GLTFLoader().parse(bytes.buffer, "", function (gltf) {
        try {
          template = gltf.scene;
          var materials = new Map();
          template.traverse(function (node) {
            if (!node.isMesh) return;
            // Preserve authored vertex colours without the static-geometry PS shader.
            function material(source) {
              var id = source.uuid + ":" + !!node.geometry.attributes.color;
              if (!materials.has(id)) {
                var mat = new THREE.MeshBasicMaterial({
                  color: source.color, map: source.map, alphaMap: source.alphaMap,
                  vertexColors: !!node.geometry.attributes.color, side: source.side,
                  transparent: source.transparent, opacity: source.opacity,
                  alphaTest: source.alphaTest, depthWrite: source.depthWrite, fog: true
                });
                mat.name = source.name;
                mat.onBeforeCompile = function (shader) {
                  shader.vertexShader = 'varying float vFrogLight;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n#if defined(USE_SKINNING)\nvec3 frogNormal = normalize(transformedNormal);\n#else\nvec3 frogNormal = normalize(normalMatrix * normal);\n#endif\nvFrogLight = 0.38 + 0.62 * max(dot(frogNormal, normalize(vec3(-0.4, 0.8, 0.6))), 0.0);');
                  shader.fragmentShader = 'varying float vFrogLight;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vFrogLight;');
                };
                mat.customProgramCacheKey = function () { return 'milkfrog-skinned-light-v1'; };
                materials.set(id, mat);
              }
              return materials.get(id);
            }
            node.material = Array.isArray(node.material) ? node.material.map(material) : material(node.material);
            if (node.isSkinnedMesh) node.frustumCulled = false; // r149 bounds do not follow the posed skin.
          });
          template.updateMatrixWorld(true);
          bounds = new THREE.Box3().setFromObject(template);
          resolve();
        } catch (err) { template = null; reject(err); }
      }, reject); // GLTFLoader.parse has exactly four arguments.
    } catch (err) { reject(err); }
  });
  // Keep the original promise rejected for callers, but avoid early unhandled rejection.
  ready.catch(function (err) { console.error(err); });

  function cloneRig(source) {
    var clone = source.clone(true), nodes = new Map(), skeletons = new Map();
    function pair(a, b) {
      nodes.set(a, b);
      for (var i = 0; i < a.children.length; i++) pair(a.children[i], b.children[i]);
    }
    pair(source, clone);
    source.traverse(function (mesh) {
      if (!mesh.isSkinnedMesh) return;
      var target = nodes.get(mesh), original = mesh.skeleton;
      if (!skeletons.has(original)) {
        var bones = original.bones.map(function (bone) {
          var mapped = nodes.get(bone);
          if (!mapped) throw new Error("FrogActor: bone outside the cloned scene: " + bone.name);
          return mapped;
        });
        skeletons.set(original, new THREE.Skeleton(bones, original.boneInverses.map(function (m) { return m.clone(); })));
      }
      target.bind(skeletons.get(original), mesh.bindMatrix);
      target.bindMode = mesh.bindMode;
    });
    return clone;
  }

  function create(height) {
    if (!template || !bounds) throw new Error("FrogActor.create: await FrogActor.ready first");
    height = Number.isFinite(height) && height > 0 ? height : 1.7;
    var model = cloneRig(template), root = new THREE.Group();
    root.name = "MilkFrogActor";
    var scale = height / (bounds.max.y - bounds.min.y);
    // Keep caller-owned position/rotation/scale untouched by animation.
    var rig = new THREE.Group();
    rig.scale.setScalar(scale);
    model.position.x -= (bounds.min.x + bounds.max.x) / 2;
    model.position.y -= bounds.min.y;
    model.position.z -= (bounds.min.z + bounds.max.z) / 2;
    rig.add(model); root.add(rig);
    root.updateMatrixWorld(true);
    var bones = Object.create(null), rest = Object.create(null), entries = [];
    model.traverse(function (bone) {
      if (!bone.isBone) return;
      var name = key(bone.name), inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
      bones[name] = bone;
      var item = { bone: bone, q: bone.quaternion.clone(), p: bone.position.clone(), s: bone.scale.clone(),
        x: new THREE.Vector3(1, 0, 0).applyQuaternion(inv),
        y: new THREE.Vector3(0, 1, 0).applyQuaternion(inv),
        z: new THREE.Vector3(0, 0, 1).applyQuaternion(inv) };
      rest[name] = item; entries.push(item);
    });
    var q = new THREE.Quaternion(), time = 0, modeTime = 0, lastMode = "", phase = serial++ * 1.73;
    function pose(name, x, y, z) {
      var r = rest[name];
      if (!r) return;
      r.bone.quaternion.copy(r.q);
      r.bone.quaternion.multiply(q.setFromAxisAngle(r.x, x || 0));
      r.bone.quaternion.multiply(q.setFromAxisAngle(r.y, y || 0));
      r.bone.quaternion.multiply(q.setFromAxisAngle(r.z, z || 0));
    }
    function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
    function update(dt, mode, amount) {
      dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 1)) : 0;
      mode = mode || "idle";
      amount = Number.isFinite(amount) ? Math.max(0, Math.min(1, amount)) : 1;
      if (mode !== lastMode) { modeTime = 0; lastMode = mode; }
      time += dt; modeTime += dt;
      entries.forEach(function (r) { r.bone.quaternion.copy(r.q); r.bone.position.copy(r.p); r.bone.scale.copy(r.s); });
      rig.position.y = 0;
      var breath = Math.sin(time * 1.8 + phase) * amount;
      pose("Chest", breath * 0.025, 0, 0);
      pose("Head", 0, Math.sin(time * 0.7 + phase) * 0.055 * amount, 0);
      pose("UpperArmL", 0.035 * breath, 0, -0.06);
      pose("UpperArmR", -0.025 * breath, 0, 0.06);
      if (mode === "sit" || mode === "work" || mode === "play") {
        rig.position.y = -height * 0.13;
        pose("ThighL", 1.38, 0, -0.05); pose("ThighR", 1.38, 0, 0.05);
        pose("ShinL", -1.32, 0, 0); pose("ShinR", -1.32, 0, 0);
        pose("UpperArmL", 0.26, 0, -0.18); pose("UpperArmR", 0.26, 0, 0.18);
        pose("LowerArmL", 0.38, 0, 0); pose("LowerArmR", 0.38, 0, 0);
      }
      if (mode === "work") {
        // Four seconds: reach, hold bottle with L / twist cap with R, retract.
        var cycle = modeTime % 4;
        var reach = smooth(cycle) * smooth(4 - cycle) * amount;
        var twist = cycle > 1 && cycle < 3 ? Math.sin((cycle - 1) * Math.PI * 4) * amount : 0;
        pose("Chest", -0.11 * reach + breath * 0.015, 0, 0);
        pose("Head", -0.08 * reach, 0, 0);
        pose("UpperArmL", 0.26 + 0.70 * reach, 0.06 * reach, -0.27);
        pose("UpperArmR", 0.26 + 0.88 * reach, -0.10 * reach, 0.23);
        pose("LowerArmL", 0.38 + 0.28 * reach, 0, -0.10 * reach);
        pose("LowerArmR", 0.38 + 0.40 * reach, 0, 0.14 * reach);
        pose("HandL", -0.12 * reach, 0, 0.12 * reach);
        pose("HandR", -0.22 * reach, 0.58 * twist, 0.12 * twist);
      } else if (mode === "walk") {
        var step = Math.sin(time * 8), swing = step * amount;
        rig.position.y = Math.abs(step) * height * 0.012 * amount;
        pose("ThighL", 0.52 * swing, 0, 0); pose("ThighR", -0.52 * swing, 0, 0);
        pose("ShinL", -Math.max(0, -swing) * 0.65, 0, 0);
        pose("ShinR", -Math.max(0, swing) * 0.65, 0, 0);
        pose("UpperArmL", -0.38 * swing, 0, -0.08); pose("UpperArmR", 0.38 * swing, 0, 0.08);
        pose("LowerArmL", 0.12, 0, 0); pose("LowerArmR", 0.12, 0, 0);
      } else if (mode === "play") {
        var wave = Math.sin(time * 5 + phase) * amount;
        pose("UpperArmL", 0.55 * amount, 0, -0.18 * amount);
        pose("UpperArmR", 0.55 * amount, 0, 0.18 * amount);
        pose("LowerArmL", 0.7 * amount, 0, 0.04 * wave);
        pose("LowerArmR", 0.7 * amount, 0, -0.04 * wave);
        pose("HandL", 0.05 * wave, 0, 0); pose("HandR", -0.08 * wave, 0, 0);
        pose("Head", -0.13, 0.025 * wave, 0);
      }
    }
    update(0, "idle");
    return { root: root, update: update, bones: bones };
  }
  global.FrogActor = { ready: ready, create: create };
})(window);
