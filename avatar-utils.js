import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 교사 제공: 기본 도형 모델과 파일 로딩/크기 보정만 담당합니다.
// Idle/Run 재생과 어떤 모델을 쓸지는 학생 avatar.js가 결정합니다.
export function createPracticeAvatar() {
  const root=new THREE.Group();
  const materials={ jacket:new THREE.MeshStandardMaterial({color:0x14b8a6,roughness:0.8}),
    skin:new THREE.MeshStandardMaterial({color:0xf5c39e}),
    pants:new THREE.MeshStandardMaterial({color:0x243746}),
    pack:new THREE.MeshStandardMaterial({color:0xf2a04a}) };
  function box(w,h,d,material,x,y,z) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.position.set(x,y,z); mesh.castShadow=true; root.add(mesh); return mesh;
  }
  box(0.42,0.48,0.28,materials.jacket,0,0.85,0);
  box(0.17,0.52,0.2,materials.pants,-0.12,0.28,0);
  box(0.17,0.52,0.2,materials.pants,0.12,0.28,0);
  box(0.13,0.45,0.17,materials.jacket,-0.29,0.82,0);
  box(0.13,0.45,0.17,materials.jacket,0.29,0.82,0);
  box(0.33,0.39,0.2,materials.pack,0,0.85,0.23);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,12,8),materials.skin);
  head.position.y=1.27; head.castShadow=true; root.add(head);
  for(const x of [-0.065,0.065]) box(0.025,0.035,0.014,materials.pants,x,1.29,-0.184);
  return root;
}

export async function loadRiggedAvatar(url) {
  const gltf=await new GLTFLoader().loadAsync(url);
  const model=gltf.scene;
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model,true);
  const size=bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y<=0) throw new Error('캐릭터 크기를 읽을 수 없습니다.');
  const center=bounds.getCenter(new THREE.Vector3());
  const object=new THREE.Group();
  const scaled=new THREE.Group();
  scaled.scale.setScalar(1.4/size.y);
  scaled.rotation.y=Math.PI;
  const origin=new THREE.Group();
  origin.position.set(-center.x,-bounds.min.y,-center.z);
  origin.add(model); scaled.add(origin); object.add(scaled);
  model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  return {object,animationRoot:model,clips:gltf.animations};
}
