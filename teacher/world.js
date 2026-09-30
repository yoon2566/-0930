import * as THREE from 'three';

// The top of every slab is exactly course.y. The painted ledges keep the
// complete rectangular landing area visible, including its four corners.
export function createWorld(scene, course) {
  const root = new THREE.Group();
  root.name = 'Alpine trail';
  scene.add(root);
  scene.background = new THREE.Color('#b9dfef');
  scene.fog = new THREE.Fog('#c6e2ed', 85, 195);

  const courseBounds = new THREE.Box3();
  for (const platform of course) {
    courseBounds.expandByPoint(new THREE.Vector3(platform.x - platform.width / 2, platform.y, platform.z - platform.depth / 2));
    courseBounds.expandByPoint(new THREE.Vector3(platform.x + platform.width / 2, platform.y, platform.z + platform.depth / 2));
  }
  const courseCenter = courseBounds.getCenter(new THREE.Vector3());
  const courseSize = courseBounds.getSize(new THREE.Vector3());
  const checkpointNumbers = new Map(course.filter(platform => platform.checkpoint).map((platform, index) => [platform.id, index + 1]));

  let seed = 49281;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });
  const mats = {
    grass: material('#77ba75'), grassEdge: material('#689c61'),
    sand: material('#c4a783'), sandLight: material('#dbc19a'),
    bark: material('#735c48'), pine: material('#398875'), pineLight: material('#4e9d83'),
    stone: material('#91a59a'), cream: material('#ffefcb'), orange: material('#f38a4d'),
    checkpoint: material('#ffc16a'), active: material('#61d5aa'), dark: material('#344e54'),
  };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 6);
  const ball = new THREE.IcosahedronGeometry(1, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.08, 1, 5);
  const flagGeo = new THREE.PlaneGeometry(1.05, 0.62, 5, 2);
  const flags = [];
  const cloudGroups = [];
  const checkpointGroups = new Map();
  const birds = [];
  const flowerPositions = [];
  const pebblePositions = [];

  function mesh(geometry, mat, parent = root) {
    const object = new THREE.Mesh(geometry, mat);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function block(parent, x, y, z, sx, sy, sz, mat) {
    const object = mesh(box, mat, parent);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }

  function rockyUnderside(platform, island) {
    const { width: w, depth: d } = platform;
    const outline = [
      [-0.5, -0.5], [0, -0.5], [0.5, -0.5], [0.5, 0],
      [0.5, 0.5], [0, 0.5], [-0.5, 0.5], [-0.5, 0],
    ];
    const height = 2.7 + random() * 1.7;
    const rings = [
      outline.map(([x, z]) => new THREE.Vector3(x * w, -0.8, z * d)),
      outline.map(([x, z]) => new THREE.Vector3(x * w * (0.82 + random() * 0.1), -1.3 - random() * 0.5, z * d * (0.8 + random() * 0.12))),
      outline.map(([x, z]) => new THREE.Vector3(x * w * (0.3 + random() * 0.2), -height, z * d * (0.3 + random() * 0.2))),
    ];
    const vertices = [];
    const colors = [];
    const palette = ['#bc9d79', '#ad8d6e', '#d0b18a', '#a08469', '#c5a37c'].map(c => new THREE.Color(c));
    function triangle(a, b, c, level) {
      vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
      const color = palette[Math.floor(random() * palette.length)].clone().multiplyScalar(level === 2 ? 0.86 : 1);
      for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
    }
    for (let level = 0; level < 2; level++) {
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        triangle(rings[level][i], rings[level + 1][i], rings[level][j], level);
        triangle(rings[level][j], rings[level + 1][i], rings[level + 1][j], level);
      }
    }
    const tip = new THREE.Vector3(w * 0.03, -height - 1, -d * 0.08);
    for (let i = 0; i < 8; i++) triangle(rings[2][i], tip, rings[2][(i + 1) % 8], 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    mesh(geometry, material('#ffffff', { vertexColors: true, flatShading: true, side: THREE.DoubleSide }), island);
  }

  function pine(parent, x, y, z, size) {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    tree.scale.setScalar(size);
    parent.add(tree);
    const trunk = mesh(trunkGeo, mats.bark, tree);
    trunk.position.y = 0.52;
    for (let i = 0; i < 3; i++) {
      const crown = mesh(cone, i % 2 ? mats.pineLight : mats.pine, tree);
      crown.scale.set(0.49 - i * 0.105, 0.83 - i * 0.06, 0.49 - i * 0.105);
      crown.position.y = 0.85 + i * 0.38;
      crown.rotation.y = i * 0.5;
    }
  }

  function makeText(text, width = 256) {
    const canvas = new OffscreenCanvas(width, 96);
    const context = canvas.getContext('2d');
    context.fillStyle = '#314c4e';
    context.fillRect(0, 0, width, 96);
    context.strokeStyle = '#e6d7ad';
    context.lineWidth = 4;
    context.strokeRect(6, 6, width - 12, 84);
    context.fillStyle = '#fff2cc';
    context.font = `bold ${text.length > 5 ? 32 : 51}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, 50);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
  }

  function sign(parent, x, z, label, wide = false, cliffMounted = false, scale = 1) {
    if (cliffMounted) {
      // The number stays readable from the following camera without occupying
      // any of the small island's landing surface.
      const board = mesh(box, [mats.bark, mats.bark, mats.bark, mats.bark, makeText(label, wide ? 384 : 128), mats.bark], parent);
      board.position.set(x, -0.43, z + 0.035 * scale);
      board.scale.set((wide ? 1.42 : 0.51) * scale, 0.35 * scale, 0.07 * scale);
      return;
    }
    block(parent, x, 0.39, z, 0.09, 0.78, 0.1, mats.bark);
    const board = mesh(box, [mats.bark, mats.bark, mats.bark, mats.bark, makeText(label, wide ? 384 : 128), mats.bark], parent);
    board.position.set(x, 0.87, z);
    board.scale.set(wide ? 1.62 : 0.61, wide ? 0.41 : 0.44, 0.09);
  }

  function flag(parent, x, z, id, summit = false, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    parent.add(group);
    const poleHeight = summit ? 3.2 : 2.5;
    block(group, 0, poleHeight / 2, 0, 0.085, poleHeight, 0.085, mats.bark);
    const finial = mesh(ball, mats.cream, group);
    finial.position.y = poleHeight + 0.06;
    finial.scale.setScalar(0.1);
    const clothMat = material(summit ? '#ef6845' : '#ffb759', { side: THREE.DoubleSide });
    const cloth = mesh(flagGeo.clone(), clothMat, group);
    cloth.position.set(0.55, poleHeight - 0.43, 0.01);
    cloth.rotation.y = -0.22;
    flags.push({ cloth, phase: random() * Math.PI * 2 });
    const foot = mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.12, 7), mats.sandLight, group);
    foot.position.y = 0.06;
    if (!summit) {
      const ring = mesh(new THREE.RingGeometry(0.7, 0.8, 32), material('#ffd47f', { side: THREE.DoubleSide }), group);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.012;
      checkpointGroups.set(id, { cloth, ring });
    }
  }

  course.forEach((platform, index) => {
    const island = new THREE.Group();
    island.name = `Trail island ${platform.id}`;
    island.position.set(platform.x, platform.y, platform.z);
    root.add(island);
    const { width: w, depth: d } = platform;
    // Three clearly defined ledge bands make the landable top easy to read.
    block(island, 0, -0.51, 0, w, 0.58, d, mats.sand);
    block(island, 0, -0.165, 0, w, 0.11, d, mats.sandLight);
    const grassMats = [mats.grassEdge, mats.grassEdge, mats.grass, mats.grassEdge, mats.grassEdge, mats.grassEdge];
    block(island, 0, -0.055, 0, w, 0.11, d, grassMats);
    rockyUnderside(platform, island);

    const side = index % 2 ? -1 : 1;
    const shortEdge = Math.min(w, d);
    const compact = shortEdge < 3.6;
    const previous = course[index - 1];
    const next = course[index + 1];
    const routes = [previous, next].filter(Boolean).map(neighbor => new THREE.Vector2(neighbor.x - platform.x, neighbor.z - platform.z));
    const distanceFromRoute = point => Math.min(...routes.map(route => {
      const t = THREE.MathUtils.clamp(point.dot(route) / Math.max(route.lengthSq(), 0.0001), 0, 1);
      return point.distanceTo(route.clone().multiplyScalar(t));
    }), point.length());
    const corners = [-1, 1].flatMap(x => [-1, 1].map(z => {
      const position = new THREE.Vector2(x * Math.max(0, w / 2 - 0.54), z * Math.max(0, d / 2 - 0.54));
      return { position, xSign: x, zSign: z, clearance: distanceFromRoute(position) };
    })).sort((a, b) => b.clearance - a.clearance);
    const flagCorner = corners[0];
    // Select corners from the actual entry/exit directions, rather than
    // placing a tree directly across the next zigzag jump.
    if (w >= 4.3 && d >= 3.5) {
      const treeCorner = corners.find(corner => corner.clearance >= 1 && (!(platform.checkpoint || platform.finish) || corner.position.distanceTo(flagCorner.position) > 1.8));
      if (treeCorner) pine(island, treeCorner.position.x, 0, treeCorner.position.y, index === 0 ? 1.13 : 0.75);
    }

    if (platform.finish) {
      flag(island, flagCorner.xSign * (w / 2 - 0.85), flagCorner.zSign * (d / 2 - 0.85), platform.id, true);
      sign(island, 0, d / 2, 'SUMMIT', true, true);
      // A soft cream target is flush with the ground; it is not a collider.
      const target = mesh(new THREE.RingGeometry(0.68, 0.77, 40), mats.cream, island);
      target.rotation.x = -Math.PI / 2;
      target.position.y = 0.008;
    } else if (platform.checkpoint) {
      const flagScale = Math.min(1, Math.min(w, d) / 3.6);
      const inset = 0.85 * flagScale;
      flag(island, flagCorner.xSign * (w / 2 - inset), flagCorner.zSign * (d / 2 - inset), platform.id, false, flagScale);
      sign(island, 0, d / 2, `CAMP ${checkpointNumbers.get(platform.id)}`, true, true);
    } else {
      sign(island, 0, d / 2, String(index + 1).padStart(2, '0'), false, true, Math.min(1, shortEdge / 1.25));
    }

    // Flush trail marks point toward the actual next platform, including
    // sideways jumps. There are no raised decorations in the landing area.
    // Tiny footholds stay completely clear so both feet and all four edges
    // remain visible when judging a landing.
    if (next && shortEdge >= 1.6) {
      const markScale = Math.min(1, shortEdge / 2.2);
      const direction = new THREE.Vector2(next.x - platform.x, next.z - platform.z).normalize();
      const edgeDistance = Math.min((w / 2 - 0.25) / Math.max(Math.abs(direction.x), 0.001), (d / 2 - 0.25) / Math.max(Math.abs(direction.y), 0.001));
      for (let i = 0; i < 3; i++) {
        const stone = mesh(ball, mats.sandLight, island);
        const across = (i - 1) * (compact ? 0.19 : 0.28) * markScale;
        stone.scale.set((compact ? 0.07 : 0.1) * markScale, 0.012, (compact ? 0.1 : 0.14) * markScale);
        stone.position.set(direction.x * edgeDistance - direction.y * across, 0.008, direction.y * edgeDistance + direction.x * across);
        stone.rotation.y = Math.atan2(direction.x, direction.y);
      }
    }
    for (let i = 0; i < (shortEdge < 2.3 ? 0 : compact ? 3 : 7); i++) {
      const flowerX = side * (w / 2 - 0.1 - random() * (compact ? 0.12 : 0.4));
      const flowerZ = (random() - 0.5) * (d - 0.5);
      flowerPositions.push({ x: platform.x + flowerX, y: platform.y, z: platform.z + flowerZ, color: i % 3 });
    }
    for (let i = 0; i < (compact ? 0 : 3); i++) {
      pebblePositions.push({ x: platform.x - side * (w / 2 - 0.18 - random() * 0.2), y: platform.y + 0.055, z: platform.z + (random() - 0.5) * (d - 1), size: 0.075 + random() * 0.055 });
    }
  });

  // Small accents are instanced so the scene stays light on classroom PCs.
  const dummy = new THREE.Object3D();
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.17, 3), mats.grassEdge, flowerPositions.length);
  root.add(stems);
  flowerPositions.forEach((p, i) => {
    dummy.position.set(p.x, p.y + 0.09, p.z); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
  });
  ['#ffedaf', '#faab9f', '#d7c2ec'].forEach((color, colorIndex) => {
    const positions = flowerPositions.filter(p => p.color === colorIndex);
    const blooms = new THREE.InstancedMesh(ball, material(color), positions.length);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.19, p.z); dummy.scale.set(0.055, 0.035, 0.055); dummy.updateMatrix();
      blooms.setMatrixAt(i, dummy.matrix);
    });
    root.add(blooms);
  });
  const pebbles = new THREE.InstancedMesh(ball, mats.stone, pebblePositions.length);
  pebblePositions.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z); dummy.scale.set(p.size * 1.5, p.size * 0.75, p.size); dummy.rotation.set(0, random() * Math.PI, 0); dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  });
  root.add(pebbles);

  // Large quiet shapes frame the course while preserving a clear foreground.
  const mountainMaterials = ['#93bbc1', '#83adb9', '#7b9da9', '#a3c6ca'].map(c => material(c));
  const snow = material('#e7f0e7');
  function mountain(x, z, radius, height, depth) {
    const group = new THREE.Group();
    group.position.set(x, courseBounds.min.y - 32, z);
    root.add(group);
    const body = mesh(new THREE.ConeGeometry(radius, height, 5), mountainMaterials[depth % 4], group);
    body.position.y = height / 2;
    body.rotation.y = random() * Math.PI;
    body.castShadow = false;
    body.receiveShadow = false;
    const capRatio = 0.25;
    const cap = mesh(new THREE.ConeGeometry(radius * capRatio + 0.04, height * capRatio, 5), snow, group);
    cap.position.y = height * (1 - capRatio / 2) + 0.035;
    cap.rotation.y = body.rotation.y;
    cap.castShadow = false;
    cap.receiveShadow = false;
  }
  for (let i = 0; i < 14; i++) {
    const angle = -Math.PI * 0.12 + i / 13 * Math.PI * 1.25;
    const distance = 83 + random() * 35;
    mountain(courseCenter.x + Math.cos(angle) * (distance + courseSize.x / 2), courseCenter.z - Math.sin(angle) * (distance + courseSize.z * 0.35), 15 + random() * 13, 32 + random() * 32 + courseSize.y * 0.6, i);
  }
  const ridgePairs = Math.max(2, Math.ceil(courseSize.z / 45));
  for (let i = 0; i < ridgePairs; i++) {
    const progress = i / Math.max(1, ridgePairs - 1);
    const z = THREE.MathUtils.lerp(courseBounds.max.z - 8, courseBounds.min.z - 14, progress);
    mountain(courseBounds.min.x - 59, z, 22, 48 + courseSize.y * progress, i + 1);
    mountain(courseBounds.max.x + 64, z - 20, 24, 56 + courseSize.y * progress, i + 2);
  }

  const cloudMat = new THREE.MeshBasicMaterial({ color: '#f1f6ef', transparent: true, opacity: 0.86, depthWrite: false });
  const cloudShade = new THREE.MeshBasicMaterial({ color: '#dcebf0', transparent: true, opacity: 0.68, depthWrite: false });
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  const cloudCount = Math.min(30, Math.max(19, Math.ceil(courseSize.z / 4.5)));
  for (let i = 0; i < cloudCount; i++) {
    const group = new THREE.Group();
    const side = i % 2 ? -1 : 1;
    const progress = random();
    group.position.set(courseCenter.x + side * (courseSize.x / 2 + 11 + random() * 30), courseBounds.min.y + courseSize.y * progress * 0.85 - 8 - random() * 8, THREE.MathUtils.lerp(courseBounds.max.z + 18, courseBounds.min.z - 30, progress));
    group.userData.originX = group.position.x;
    group.userData.phase = random() * 6.28;
    for (let puff = 0; puff < 4; puff++) {
      const shape = mesh(cloudGeometry, i % 3 ? cloudMat : cloudShade, group);
      shape.position.set(puff * 2.5 - 3.7, random() * 0.5, random() * 1.6);
      shape.scale.set(3.2 + random() * 1.8, 0.8 + random(), 1.5 + random());
      shape.castShadow = false;
      shape.receiveShadow = false;
    }
    root.add(group);
    cloudGroups.push(group);
  }

  const sky = new THREE.Mesh(new THREE.SphereGeometry(215, 20, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#87c7e4') }, bottom: { value: new THREE.Color('#e5f0ec') } },
    vertexShader: 'varying vec3 vPosition; void main(){ vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){ float h = clamp(normalize(vPosition).y * 0.85 + 0.24, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }',
  }));
  sky.position.copy(courseCenter);
  root.add(sky);

  const wingGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0.08, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 0.08, 0)]);
  for (let i = 0; i < 5; i++) {
    const bird = new THREE.Line(wingGeometry.clone(), new THREE.LineBasicMaterial({ color: '#648595' }));
    bird.position.set(courseCenter.x - 22 + i * 2, courseBounds.max.y + 10 + i % 2, courseBounds.min.z - 16 - i * 2);
    bird.userData.originX = bird.position.x;
    bird.userData.originY = bird.position.y;
    bird.userData.phase = i * 0.8;
    root.add(bird);
    birds.push(bird);
  }

  return {
    update(time, player) {
      // Keep the backdrop enclosing the camera throughout a longer climb.
      // Radius 215 remains inside the existing camera's far plane of 300.
      if (player && Number.isFinite(player.x) && Number.isFinite(player.y) && Number.isFinite(player.z)) sky.position.set(player.x, player.y, player.z);
      flags.forEach(({ cloth, phase }) => {
        const positions = cloth.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const amount = (x + 0.525) / 1.05;
          positions.setZ(i, Math.sin(time * 3.1 - x * 4 + phase) * 0.11 * amount);
        }
        positions.needsUpdate = true;
        cloth.geometry.computeVertexNormals();
      });
      cloudGroups.forEach(group => { group.position.x = group.userData.originX + Math.sin(time * 0.05 + group.userData.phase) * 1.7; });
      birds.forEach((bird, i) => {
        bird.position.x = bird.userData.originX + Math.sin(time * 0.09 + i * 0.08) * 11;
        bird.position.y = bird.userData.originY + Math.sin(time * 0.8 + i) * 0.22;
        const attribute = bird.geometry.attributes.position;
        attribute.setY(0, Math.sin(time * 3 + bird.userData.phase) * 0.13);
        attribute.setY(2, Math.sin(time * 3 + bird.userData.phase) * 0.13);
        attribute.needsUpdate = true;
      });
    },
    checkpointReached(id) {
      const checkpoint = checkpointGroups.get(id);
      if (checkpoint) {
        checkpoint.cloth.material.color.set('#71d8b0');
        checkpoint.ring.material.color.set('#b3f4d6');
      }
    },
    dispose() {
      const geometries = new Set();
      const materials = new Set();
      root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => { mat.map?.dispose(); mat.dispose(); });
      scene.remove(root);
    },
  };
}
