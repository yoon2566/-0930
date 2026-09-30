import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CHARACTER_HEIGHT = 1.6;
const MAX_GLB_BYTES = 25 * 1024 * 1024;
const TAU = Math.PI * 2;

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
    if (node.isSkinnedMesh) node.skeleton?.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

function makeExplorer() {
  const model = new THREE.Group();
  model.name = '기본 탐험가 — 코드로 만든 임시 캐릭터';
  const figure = new THREE.Group();
  model.add(figure);
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.82, metalness: 0, flatShading: true, ...options,
  });
  const colors = {
    jacket: material(0x1fb7ad), trim: material(0x127b83), skin: material(0xf4c394),
    nose: material(0xe4a377), cheeks: material(0xec967d), pants: material(0xe5d6b5),
    socks: material(0x344856), boots: material(0x314456), sole: material(0x192d3b),
    pack: material(0xff913b), pocket: material(0xf3b44e), strap: material(0x176e76),
    cap: material(0x29c5c2), capBand: material(0x189da4), eye: material(0x243648),
    cream: material(0xfff5dc), badge: material(0xffd667),
  };
  const mesh = (geometry, mat, parent, x = 0, y = 0, z = 0) => {
    const result = new THREE.Mesh(geometry, mat);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  const capsule = (r, length, mat, parent, x, y, z) =>
    mesh(new THREE.CapsuleGeometry(r, length, 4, 8), mat, parent, x, y, z);
  const sphere = (r, mat, parent, x, y, z) =>
    mesh(new THREE.SphereGeometry(r, 12, 8), mat, parent, x, y, z);
  const box = (x, y, z, mat, parent, px, py, pz) =>
    mesh(new THREE.BoxGeometry(x, y, z), mat, parent, px, py, pz);

  const body = new THREE.Group();
  figure.add(body);
  const torso = mesh(new THREE.CylinderGeometry(0.235, 0.20, 0.44, 10),
    colors.jacket, body, 0, 0.91, 0);
  torso.scale.z = 0.74;
  const hem = mesh(new THREE.CylinderGeometry(0.205, 0.21, 0.055, 10),
    colors.trim, body, 0, 0.695, 0);
  hem.scale.z = 0.75;
  capsule(0.009, 0.36, colors.cream, body, 0, 0.91, -0.177);
  box(0.025, 0.045, 0.018, colors.badge, body, 0, 1.022, -0.19);
  const collar = mesh(new THREE.TorusGeometry(0.108, 0.027, 4, 12),
    colors.trim, body, 0, 1.13, 0);
  collar.rotation.x = Math.PI / 2;
  capsule(0.073, 0.07, colors.skin, body, 0, 1.155, 0);

  const pack = capsule(0.175, 0.17, colors.pack, body, 0, 0.91, 0.21);
  pack.scale.z = 0.7;
  const pocket = capsule(0.102, 0.055, colors.pocket, body, 0, 0.83, 0.335);
  pocket.rotation.z = Math.PI / 2;
  pocket.scale.z = 0.4;
  box(0.20, 0.015, 0.012, colors.cream, body, 0, 0.874, 0.38);
  for (const side of [-1, 1]) {
    const strap = box(0.043, 0.365, 0.023, colors.strap, body,
      side * 0.137, 0.925, -0.163);
    strap.rotation.z = side * 0.08;
    box(0.055, 0.033, 0.033, colors.badge, body, side * 0.144, 0.845, -0.18);
  }
  const handle = mesh(new THREE.TorusGeometry(0.073, 0.018, 4, 10, Math.PI),
    colors.strap, body, 0, 1.165, 0.24);
  handle.scale.x = 0.8;

  const head = new THREE.Group();
  head.position.y = 1.34;
  body.add(head);
  const face = sphere(0.223, colors.skin, head, 0, 0, 0);
  face.scale.set(0.96, 1.02, 0.91);
  for (const side of [-1, 1]) {
    sphere(0.042, colors.skin, head, side * 0.211, -0.008, 0);
    const eye = sphere(0.021, colors.eye, head, side * 0.071, 0.01, -0.19);
    eye.scale.set(0.8, 1.15, 0.6);
    sphere(0.006, colors.cream, head, side * 0.071 - 0.005, 0.017, -0.204);
    const cheek = sphere(0.028, colors.cheeks, head, side * 0.126, -0.041, -0.163);
    cheek.scale.set(1, 0.55, 0.28);
    const brow = box(0.035, 0.012, 0.008, colors.eye, head, side * 0.074, 0.052, -0.192);
    brow.rotation.z = side * 0.07;
  }
  const nose = sphere(0.031, colors.nose, head, 0, -0.023, -0.207);
  nose.scale.set(0.77, 0.9, 0.82);
  const smile = mesh(new THREE.TorusGeometry(0.039, 0.006, 4, 12, Math.PI),
    colors.eye, head, 0, -0.049, -0.198);
  smile.rotation.z = Math.PI;
  const hat = mesh(new THREE.SphereGeometry(0.233, 12, 6, 0, TAU, 0, Math.PI / 2),
    colors.cap, head, 0, 0.063, 0);
  hat.scale.set(1.02, 0.87, 0.94);
  const hatBand = mesh(new THREE.TorusGeometry(0.214, 0.027, 4, 12),
    colors.capBand, head, 0, 0.068, 0);
  hatBand.rotation.x = Math.PI / 2;
  hatBand.scale.y = 0.95;
  const brim = capsule(0.035, 0.205, colors.capBand, head, 0, 0.059, -0.203);
  brim.rotation.z = Math.PI / 2;
  brim.scale.z = 1.9;
  const badge = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.009, 6),
    colors.badge, head, 0, 0.142, -0.202);
  badge.rotation.x = Math.PI / 2;

  const limbs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.117, 0.66, 0);
    figure.add(leg);
    capsule(0.101, 0.145, colors.pants, leg, 0, -0.111, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    leg.add(knee);
    capsule(0.079, 0.135, colors.socks, knee, 0, -0.09, 0);
    const boot = capsule(0.09, 0.075, colors.boots, knee, 0, -0.247, -0.041);
    boot.rotation.x = Math.PI / 2;
    boot.scale.y = 1.13;
    const sole = box(0.19, 0.042, 0.26, colors.sole, knee, 0, -0.318, -0.045);
    sole.receiveShadow = true;
    box(0.106, 0.035, 0.018, colors.pocket, knee, 0, -0.224, -0.165);

    const arm = new THREE.Group();
    arm.position.set(side * 0.267, 1.078, 0);
    body.add(arm);
    capsule(0.077, 0.14, colors.jacket, arm, 0, -0.107, 0);
    const elbow = new THREE.Group();
    elbow.position.y = -0.218;
    arm.add(elbow);
    capsule(0.065, 0.115, colors.jacket, elbow, 0, -0.075, 0);
    capsule(0.067, 0.01, colors.trim, elbow, 0, -0.168, 0);
    const hand = sphere(0.074, colors.skin, elbow, 0, -0.233, 0);
    hand.scale.set(0.88, 1.06, 0.91);
    limbs.push({ side, leg, knee, arm, elbow });
  }

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const scale = CHARACTER_HEIGHT / (bounds.max.y - bounds.min.y);
  model.scale.setScalar(scale);
  model.position.y = -bounds.min.y * scale;
  const baseY = model.position.y;
  let phase = 0;
  let motion = 0;

  return {
    model,
    update(dt, state, time) {
      const speed = Math.hypot(state.vx || 0, state.vz || 0);
      const moving = speed > 0.08 && state.grounded && !state.won;
      motion = THREE.MathUtils.damp(motion, moving ? Math.min(speed / 3.8, 1) : 0, 12, dt);
      phase += dt * (5 + speed * 1.25);
      const stride = Math.sin(phase);
      const inAir = !state.grounded && !state.won;
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, moving ? -0.055 : 0, 10, dt);
      body.rotation.z = Math.sin(phase) * motion * 0.032;
      head.rotation.z = state.won ? Math.sin(time * 3) * 0.06 : Math.sin(time * 1.8) * 0.018;
      model.position.y = baseY + (state.won ? Math.abs(Math.sin(time * 4)) * 0.055
        : motion * Math.abs(Math.sin(phase * 2)) * 0.027 + Math.sin(time * 2.4) * 0.005);
      for (const limb of limbs) {
        const swing = stride * limb.side;
        limb.leg.rotation.x = inAir ? 0.24 : swing * motion * 0.68;
        limb.knee.rotation.x = inAir ? -0.65 : -Math.max(0, -swing) * motion * 0.58;
        limb.arm.rotation.x = inAir ? -0.45 : -swing * motion * 0.69;
        limb.arm.rotation.z = state.won ? limb.side * 2.64 : limb.side * (inAir ? 0.45 : 0.065);
        limb.elbow.rotation.x = state.won ? 0 : (inAir ? 0.38 : 0.16 + motion * 0.2);
      }
    },
  };
}

function inspectGLB(arrayBuffer) {
  if (arrayBuffer.byteLength < 20) throw new Error('GLB 파일이 비어 있거나 손상되었습니다.');
  const view = new DataView(arrayBuffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) {
    throw new Error('GLB 2.0 파일을 선택해 주세요. FBX와 .gltf 파일은 지원하지 않습니다.');
  }
  if (view.getUint32(8, true) !== arrayBuffer.byteLength) throw new Error('GLB 파일의 길이 정보가 맞지 않습니다.');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || 20 + jsonLength > arrayBuffer.byteLength) {
    throw new Error('GLB 모델 정보가 올바르지 않습니다.');
  }
  let json;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, 20, jsonLength)).replace(/\0+$/g, ''));
  } catch {
    throw new Error('GLB 모델 정보를 읽지 못했습니다.');
  }
  for (const entry of [...(json.buffers || []), ...(json.images || [])]) {
    if (entry.uri && !entry.uri.startsWith('data:')) {
      throw new Error('텍스처와 데이터를 파일 안에 포함한 GLB로 다시 내보내 주세요. 외부 파일은 불러오지 않습니다.');
    }
  }
  const decoderExtensions = ['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression'];
  if ((json.extensionsUsed || []).some((extension) => decoderExtensions.includes(extension))) {
    throw new Error('압축되지 않은 일반 GLB로 내보내 주세요. Draco·KTX2·Meshopt 압축은 이 시작본에서 지원하지 않습니다.');
  }
  return json;
}

function validateModel(model) {
  let meshes = 0;
  let textureCount = 0;
  const checkedTextures = new Set();
  model.traverse((node) => {
    if (!node.isMesh) return;
    if (node.geometry?.getAttribute('position')?.count > 0) meshes += 1;
    node.castShadow = true;
    node.receiveShadow = true;
    for (const material of [].concat(node.material || [])) {
      for (const texture of Object.values(material)) {
        if (!texture?.isTexture || checkedTextures.has(texture)) continue;
        checkedTextures.add(texture);
        const data = texture.image || texture.source?.data;
        if (!data || !Number.isFinite(data.width) || !Number.isFinite(data.height)
          || data.width <= 0 || data.height <= 0) {
          throw new Error('캐릭터 텍스처를 읽지 못했습니다. 텍스처를 포함한 GLB로 다시 내보내 주세요.');
        }
        textureCount += 1;
      }
    }
  });
  if (!meshes) throw new Error('표시할 3D 메시가 없는 GLB 파일입니다.');
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z, ...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
    || size.y < 0.000001) {
    throw new Error('캐릭터의 크기를 계산하지 못했습니다. 모델과 뼈대의 변환을 확인해 주세요.');
  }
  return { bounds, size, meshCount: meshes, textureCount };
}

function matchClips(clips) {
  const find = (pattern) => clips.find((clip) => pattern.test(clip.name.toLowerCase()));
  const idle = find(/idle|standing|stand$|rest|대기|서있/);
  const run = find(/run|jog|sprint|달리/);
  const walk = find(/walk|걷/);
  const jump = find(/jump|leap|hop|점프/);
  const win = find(/victory|celebrat|dance|win|승리/);
  return { idle, run, walk, jump, win };
}

/** Movement/physics are owned by the game. This module owns only the visible avatar. */
export function createCharacter(scene) {
  const root = new THREE.Group();
  root.name = 'PlayerCharacter';
  scene.add(root);
  const explorer = makeExplorer();
  root.add(explorer.model);
  let custom = null;
  let mixer = null;
  let actions = {};
  let activeAction = null;
  let requestId = 0;
  let facingOffset = 0;
  let info = defaultInfo();

  function defaultInfo() {
    return {
      name: '기본 탐험가', file: null, source: 'procedural', isCustom: false,
      animations: [], animationCount: 0, hasSkin: false, height: CHARACTER_HEIGHT,
      description: '코드로 만든 임시 캐릭터입니다. 대기·달리기·점프 동작은 코드 애니메이션이며, 리깅 파일이 아닙니다.',
      facingOffset: 0,
    };
  }
  function clearCustom() {
    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    }
    if (custom) {
      root.remove(custom);
      disposeObject(custom);
    }
    custom = null;
    mixer = null;
    actions = {};
    activeAction = null;
  }
  function useDefault() {
    requestId += 1;
    clearCustom();
    explorer.model.visible = true;
    facingOffset = 0;
    info = defaultInfo();
  }

  async function loadGLB(file) {
    if (!file || typeof file.arrayBuffer !== 'function' || !/\.glb$/i.test(file.name || '')) {
      throw new Error('.glb 캐릭터 파일을 선택해 주세요.');
    }
    if (!file.size || file.size > MAX_GLB_BYTES) throw new Error('0바이트보다 크고 25MB 이하인 GLB 파일을 선택해 주세요.');
    const thisRequest = ++requestId;
    const buffer = await file.arrayBuffer();
    inspectGLB(buffer);
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (/^(?:blob:|data:)/i.test(url)) return url;
      throw new Error('외부 주소를 사용하는 모델입니다. 모든 데이터를 GLB 안에 포함해 주세요.');
    });
    const loader = new GLTFLoader(manager);
    let candidate = null;
    try {
      const gltf = await loader.parseAsync(buffer, '');
      candidate = gltf.scene;
      const checked = validateModel(candidate);
      if (thisRequest !== requestId) throw new Error('다른 캐릭터 선택으로 불러오기가 취소되었습니다.');
      const center = checked.bounds.getCenter(new THREE.Vector3());
      const wrapper = new THREE.Group();
      wrapper.name = 'UploadedGLBCharacter';
      wrapper.scale.setScalar(CHARACTER_HEIGHT / checked.size.y);
      const origin = new THREE.Group();
      origin.position.set(-center.x, -checked.bounds.min.y, -center.z);
      origin.add(candidate);
      wrapper.add(origin);
      // Most exported humanoids face +Z. The optional setter lets the UI correct other files.
      wrapper.rotation.y = Math.PI;
      const clips = (gltf.animations || []).filter((clip) => clip.duration > 0 && clip.tracks.length > 0);
      const matched = matchClips(clips);
      const nextMixer = clips.length ? new THREE.AnimationMixer(candidate) : null;
      const nextActions = {};
      if (nextMixer) {
        const fallback = matched.idle || clips[0];
        nextActions.idle = nextMixer.clipAction(fallback);
        nextActions.run = nextMixer.clipAction(matched.run || matched.walk || fallback);
        nextActions.win = nextMixer.clipAction(matched.win || fallback);
        if (matched.jump) {
          nextActions.jump = nextMixer.clipAction(matched.jump);
          nextActions.jump.setLoop(THREE.LoopOnce, 1);
          nextActions.jump.clampWhenFinished = true;
        }
      }
      let hasSkin = false;
      candidate.traverse((node) => { if (node.isSkinnedMesh) hasSkin = true; });
      const nextInfo = {
        name: file.name.replace(/\.glb$/i, ''), file: file.name, source: 'glb', isCustom: true,
        animations: clips.map((clip) => clip.name || '(이름 없는 동작)'), animationCount: clips.length,
        matchedAnimations: Object.fromEntries(Object.entries(matched).filter(([, clip]) => clip).map(([key, clip]) => [key, clip.name])),
        hasSkin, meshCount: checked.meshCount, textureCount: checked.textureCount,
        height: CHARACTER_HEIGHT, facingOffset: Math.PI,
        description: clips.length
          ? `${clips.length}개 동작 포함. 동작 이름으로 대기·달리기·점프를 연결합니다. 인식하지 못한 이름은 첫 동작을 사용합니다.`
          : '애니메이션이 없는 GLB입니다. 캐릭터 이동과 점프는 가능하지만 몸의 동작은 재생되지 않습니다.',
      };
      clearCustom();
      custom = wrapper;
      mixer = nextMixer;
      actions = nextActions;
      explorer.model.visible = false;
      root.add(custom);
      facingOffset = Math.PI;
      info = nextInfo;
      candidate = null;
      return { name: info.name, animations: [...info.animations] };
    } catch (error) {
      if (candidate) disposeObject(candidate);
      if (error instanceof Error) throw error;
      throw new Error('GLB를 불러오지 못했습니다.');
    }
  }

  function update(dt, state, time = 0) {
    dt = THREE.MathUtils.clamp(dt || 0, 0, 0.1);
    root.position.set(state.x || 0, state.y || 0, state.z || 0);
    const vx = state.vx || 0;
    const vz = state.vz || 0;
    const speed = Math.hypot(vx, vz);
    if (speed > 0.08) {
      const desired = Math.atan2(-vx, -vz);
      const difference = Math.atan2(Math.sin(desired - root.rotation.y), Math.cos(desired - root.rotation.y));
      root.rotation.y += difference * (1 - Math.exp(-dt * 14));
    }
    if (!custom) {
      explorer.update(dt, state, time);
      return;
    }
    if (!mixer) return;
    const next = state.won ? actions.win
      : !state.grounded && actions.jump ? actions.jump
        : speed > 0.12 ? actions.run : actions.idle;
    if (next && next !== activeAction) {
      activeAction?.fadeOut(0.16);
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.16).play();
      activeAction = next;
    }
    if (activeAction === actions.run && activeAction !== actions.jump && speed > 0.12) {
      activeAction.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4.5, 0.65, 1.5));
    } else {
      activeAction?.setEffectiveTimeScale(1);
    }
    mixer.update(dt);
  }

  function setFacingOffset(radians) {
    if (!custom || !Number.isFinite(radians)) return;
    facingOffset = radians;
    custom.rotation.y = radians;
    info.facingOffset = radians;
  }

  return {
    root, update, loadGLB, useDefault, setFacingOffset,
    getInfo: () => ({ ...info, animations: [...info.animations], facingOffset }),
    dispose() {
      requestId += 1;
      clearCustom();
      disposeObject(explorer.model);
      scene.remove(root);
    },
  };
}
