import * as THREE from 'three';
import { COURSE } from './course.js';
import { ENGINE, createPlayer, stepPlayer, resetPlayer, respawnPlayer } from './engine.js';
import { createAvatar } from './avatar.js';

const $=id=>document.getElementById(id);
const canvas=$('game');
const keys=new Set();
const player=createPlayer();
let freshJump=false, paused=false, accumulator=0, lastTime=0, toastTimer;
let seenMovement=false;
const moveCodes={up:'ArrowUp',left:'ArrowLeft',down:'ArrowDown',right:'ArrowRight'};

function toast(text) {
  $('toast').textContent=text; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1800);
}
function clearInput() { keys.clear(); freshJump=false; document.querySelectorAll('.active').forEach(node=>node.classList.remove('active')); }
function setPaused(value) {
  paused=value; clearInput(); accumulator=0;
  document.body.classList.toggle('paused',paused);
  $('pause').textContent=paused?'계속하기 · ESC':'잠깐 쉬기 · ESC';
  if(!paused) canvas.focus();
}
function keyDown(code) {
  if(code==='Space'&&!keys.has(code)) freshJump=true;
  keys.add(code);
}
window.addEventListener('keydown',event=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
  if(event.repeat) return;
  if(event.code==='Escape'){setPaused(!paused);return;}
  if(event.code==='KeyR'){if($('win').open)$('win').close();respawnPlayer(player);toast('저장된 위치로 돌아왔어요.');return;}
  if(!paused) keyDown(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',clearInput);
canvas.addEventListener('pointerdown',()=>canvas.focus());
$('pause').addEventListener('click',()=>setPaused(!paused));
function restart() { if($('win').open)$('win').close(); resetPlayer(player); clearInput(); setPaused(false); toast('처음부터 다시 시작해요.'); }
$('reset').addEventListener('click',restart);
$('again').addEventListener('click',restart);
for(const button of [...document.querySelectorAll('[data-move]'),$('jump-button')]) {
  const code=button.id==='jump-button'?'Space':moveCodes[button.dataset.move];
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);if(!paused){keyDown(code);button.classList.add('active');}});
  const release=()=>{keys.delete(code);button.classList.remove('active');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
function input() {
  return {x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),
    z:Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')),freshJump};
}

try {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xd7eaf0);
  scene.fog=new THREE.Fog(0xd7eaf0,30,105);
  const camera=new THREE.PerspectiveCamera(49,innerWidth/innerHeight,0.1,180);
  const hemi=new THREE.HemisphereLight(0xf5fbff,0x9dbb9b,2.3);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff4d7,2.5);sun.position.set(-12,20,6);sun.castShadow=true;
  Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:70});
  sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-0.0005;scene.add(sun);scene.add(sun.target);
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:0.9,flatShading:true});
  const stone=mat(0xb1b8a0), grass=mat(0xbfe184), camp=mat(0x90ddd3), summit=mat(0xf2d489);
  function mesh(geometry,material,x,y,z){const object=new THREE.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;scene.add(object);return object;}
  function numberLabel(p) {
    const image=document.createElement('canvas');image.width=128;image.height=64;
    const context=image.getContext('2d');context.fillStyle=p.checkpoint?'#126c66':'#435b3a';context.font='bold 40px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(p.finish?'GOAL':p.checkpoint?`CAMP ${p.id}`:String(p.id),64,32);
    const label=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(p.width*.75,1.5),0.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(image),transparent:true,depthWrite:false}));
    label.rotation.x=-Math.PI/2;label.position.set(p.x,p.y+0.035,p.z+p.depth*.25);scene.add(label);
  }
  for(const p of COURSE) {
    mesh(new THREE.BoxGeometry(p.width,ENGINE.slab,p.depth),stone,p.x,p.y-ENGINE.slab/2,p.z);
    mesh(new THREE.BoxGeometry(p.width,0.06,p.depth),p.finish?summit:p.checkpoint?camp:grass,p.x,p.y-0.02,p.z);
    const taper=mesh(new THREE.ConeGeometry(Math.min(p.width,p.depth)*.56,1.1,5),stone,p.x,p.y-1.1,p.z);taper.rotation.z=Math.PI;
    numberLabel(p);
    if(p.finish||p.checkpoint){
      const edge=p.x+p.width*.3;
      mesh(new THREE.CylinderGeometry(.025,.025,1.5,6),mat(0x60746c),edge,p.y+.75,p.z);
      mesh(new THREE.BoxGeometry(.48,.3,.025),mat(p.finish?0xe99b42:0x31afa8),edge+.22,p.y+1.28,p.z);
    }
  }
  const mountainColors=[0xb1c9be,0xbaccbf,0xc4d5c7];
  for(let i=0;i<16;i++) {
    const side=i%2?-1:1,z=12-i*7,height=12+(i%5)*3;
    mesh(new THREE.ConeGeometry(9+(i%3)*3,height,5),mat(mountainColors[i%3]),side*(22+(i%4)*5),-8,z);
  }
  const clouds=[];
  const cloudMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,opacity:.8});
  for(let i=0;i<12;i++){
    const cloud=new THREE.Group();
    for(let j=0;j<3;j++){const puff=new THREE.Mesh(new THREE.SphereGeometry(1.5+j*.2,8,6),cloudMat);puff.position.set(j*1.8,Math.sin(j)*.5,0);puff.scale.y=.55;cloud.add(puff);}
    cloud.position.set((i%2?-1:1)*(12+i%3*7),-4-i%3,-8-i*5);cloud.userData.baseX=cloud.position.x;scene.add(cloud);clouds.push(cloud);
  }
  const avatar=await createAvatar(scene);
  $('loading').hidden=true;
  document.body.dataset.ready='true';
  document.body.dataset.avatarStatus=avatar.kind;
  $('course-count').textContent=COURSE.length;
  const stageNames=['움직임부터 만들어요','이동을 확인했어요','점프를 확인했어요','산길이 생겼어요','작은 발판에 도전해요','중간 쉼터가 생겼어요','내 캐릭터와 함께해요'];
  function telemetry() {
    seenMovement ||= Math.hypot(player.vx,player.vz)>.05;
    const stage=avatar.kind==='rigged'?6:COURSE.some(p=>p.checkpoint)?5:COURSE.some(p=>p.width<2||p.depth<2)?4:COURSE.length>1?3:player.jumps>0?2:seenMovement?1:0;
    document.body.dataset.player=JSON.stringify({x:player.x,y:player.y,z:player.z,vx:player.vx,vy:player.vy,vz:player.vz,grounded:player.grounded,checkpointId:player.checkpointId,won:player.won,platformId:player.platformId,spawn:player.spawn,jumps:player.jumps,falls:player.falls});
    document.body.dataset.courseCount=String(COURSE.length);
    document.body.dataset.avatarStatus=avatar.kind;
    document.body.dataset.animation=String(avatar.animation);
    document.body.dataset.stage=String(stage);
    document.body.dataset.paused=String(paused);
    $('height').textContent=player.y.toFixed(1);$('camp').textContent=player.checkpointId?String(player.checkpointId):'시작';
    $('animation').textContent=avatar.animation;
    $('stage-title').textContent=`단계 ${stage} · ${stageNames[stage]}`;
    $('objective').innerHTML=COURSE.length>1?`표시된 발판 번호를 따라 올라가요.<br>정상까지 ${COURSE.length-1}번의 점프!`:'아직 시작 발판 하나예요.<br>첫 요청문으로 이동 코드를 만들어 보세요.';
    document.querySelectorAll('[data-step]').forEach(node=>node.classList.toggle('done',Number(node.dataset.step)<=stage));
  }
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
  addEventListener('resize',resize);resize();
  const cameraGoal=new THREE.Vector3();
  const lookAt=new THREE.Vector3();
  camera.position.set(player.x+5.5,player.y+7.5,player.z+10);
  function frame(time) {
    const dt=Math.min((time-lastTime)/1000||0,0.05);lastTime=time;
    if(!paused&&!player.won){
      accumulator+=dt;
      while(accumulator>=1/120){
        const events=stepPlayer(player,input(),1/120);freshJump=false;accumulator-=1/120;
        if(events.includes('checkpoint'))toast(`${player.checkpointId}번 쉼터 저장!`);
        if(events.includes('fall'))toast('저장된 위치에서 다시 도전해요.');
        if(events.includes('win')){$('win').showModal();clearInput();break;}
      }
    }
    avatar.object.position.set(player.x,player.y,player.z);
    if(Math.hypot(player.vx,player.vz)>.05)avatar.object.rotation.y=Math.atan2(-player.vx,-player.vz);
    if(!paused)avatar.update(player,dt);
    cameraGoal.set(player.x+5.5,player.y+7.5,player.z+10);camera.position.lerp(cameraGoal,1-Math.exp(-dt*7));
    lookAt.set(player.x-.9,player.y+.5,player.z-2.3);camera.lookAt(lookAt);
    sun.position.z=player.z+6;sun.target.position.set(player.x,player.y,player.z);
    clouds.forEach((cloud,index)=>cloud.position.x=cloud.userData.baseX+Math.sin(time*.0001+index)*1.2);
    telemetry();renderer.render(scene,camera);requestAnimationFrame(frame);
  }
  telemetry();requestAnimationFrame(frame);
} catch(error) {
  document.body.dataset.ready='error';document.body.dataset.avatarStatus='error';
  $('loading').textContent=`준비 중 오류: ${error.message}`;
  console.error(error);
}
