import * as THREE from 'three';
import { COURSE } from './course.js';
import { createPlayer, resetPlayer, respawnPlayer, stepPlayer } from './physics.js';
import { createWorld } from './world.js';
import { createCharacter } from './character.js';
import { getDemoInput } from './demo.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
let renderer, scene, camera, world, character, light;
const player = createPlayer();
let phase = 'intro', returnPhase = 'intro';
let demoPlaying = false, modelFacing = Math.PI;
let lastTime = performance.now(), accumulator = 0, worldTime = 0;
let jumpQueued = false, toastTimer, flashTimer, hudTimer = 0;
const keys = new Set();
const moveKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space']);
const lookTarget = new THREE.Vector3(0, 2, -10);
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const summit = COURSE[COURSE.length - 1];
const checkpoints = COURSE.filter(platform => platform.checkpoint);
// Each course layout has its own records, including the narrower landing targets.
const RECORD_KEY = 'summit-best-precision-v3';
let muted = true, audioContext = null, confetti = null, celebrationAge = 0;
try { muted = localStorage.getItem('summit-sound') !== 'on'; } catch {}

function formatTime(value, tenths = false) {
  const seconds = Math.max(0, value);
  const min = String(Math.floor(seconds / 60)).padStart(2,'0');
  const sec = String(Math.floor(seconds % 60)).padStart(2,'0');
  return `${min}:${sec}${tenths ? '.' + Math.floor((seconds % 1) * 10) : ''}`;
}
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2900);
}
function clearInput() { keys.clear(); jumpQueued = false; accumulator = 0; }
function updateSoundButton() {
  $('sound-label').textContent = muted ? 'OFF' : 'ON';
  $('sound-button').setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
  $('sound-button').title = muted ? '소리 켜기' : '소리 끄기';
}
async function wakeAudio() {
  if (muted) return;
  try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); await audioContext.resume(); } catch {}
}
function note(frequency, when, length, volume = .045, type = 'sine') {
  if (muted || !audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const time = audioContext.currentTime + when;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, time + length);
  oscillator.connect(gain); gain.connect(audioContext.destination);
  oscillator.start(time); oscillator.stop(time + length + .03);
}
function sound(event) {
  if (event === 'jump') { note(380,0,.13); note(570,.055,.12,.025); }
  if (event === 'land') note(130,0,.085,.025,'triangle');
  if (event === 'checkpoint') [523,659,784].forEach((f,i) => note(f,i*.12,.3));
  if (event === 'fall') { note(240,0,.16,.03); note(180,.1,.2,.025); }
  if (event === 'win') [523,659,784,1046].forEach((f,i) => note(f,i*.16,.5,.06));
}
function setPhase(next) {
  phase = next;
  $('welcome').hidden = next !== 'intro';
  const inGame = next === 'playing' || next === 'paused' || next === 'won';
  $('hud').hidden = !inGame;
  $('route-progress').hidden = !inGame;
  $('playing-tip').hidden = !inGame;
  $('touch-controls').hidden = next !== 'playing' || !matchMedia('(pointer:coarse)').matches;
  canvas.dataset.phase = next;
}
function setupCourseUI() {
  $('jump-count').textContent = COURSE.length - 1;
  $('checkpoint-count').textContent = checkpoints.length;
  const stops = [COURSE[0], ...checkpoints, summit];
  const routeLine = document.querySelector('.route-line');
  const routeNames = document.querySelector('.route-names');
  routeLine.replaceChildren();
  routeNames.replaceChildren();
  stops.forEach((platform, index) => {
    if (index) routeLine.append(document.createElement('span'));
    const dot = document.createElement('i');
    dot.className = `route-dot${platform.finish ? ' summit-dot' : ''}`;
    dot.dataset.stage = platform.id;
    if (platform.finish) dot.textContent = '▲';
    routeLine.append(dot);
    const name = document.createElement('span');
    name.textContent = index === 0 ? '출발' : platform.finish ? '정상' : `쉼터 ${index}`;
    routeNames.append(name);
  });
}
function updateHUD() {
  const height = Math.max(0, Math.round(player.y * 5));
  $('height-value').innerHTML = `${height}<span>m</span>`;
  $('height-fill').style.width = `${THREE.MathUtils.clamp(player.y / summit.y * 100, 0, 100)}%`;
  $('time-value').textContent = formatTime(player.elapsed, true);
  $('falls-value').textContent = player.falls;
  const nextCheckpoint = checkpoints.findIndex(platform => platform.id > player.checkpointId);
  const destination = nextCheckpoint < 0 ? '마지막 정상 도전' : `쉼터 ${nextCheckpoint + 1}을 향해`;
  $('route-caption').textContent = player.won ? '정상 도착! 수고했어요.' : `${player.highestId} / ${summit.id} · ${destination}`;
  document.querySelectorAll('.route-dot').forEach(dot => dot.classList.toggle('reached', Number(dot.dataset.stage) <= (player.won ? summit.id : player.checkpointId)));
  // Read-only, DOM-backed telemetry for classroom diagnostics and browser verification.
  canvas.dataset.player = JSON.stringify({x:+player.x.toFixed(3),y:+player.y.toFixed(3),z:+player.z.toFixed(3),grounded:player.grounded,platform:player.platformId,checkpoint:player.checkpointId,highest:player.highestId,falls:player.falls,jumps:player.jumps,won:player.won,elapsed:+player.elapsed.toFixed(3)});
  canvas.dataset.drawcalls = renderer?.info.render.calls || 0;
}
function clearConfetti() {
  if (!confetti) return;
  scene.remove(confetti);
  confetti.geometry.dispose(); confetti.material.dispose(); confetti = null;
}
function celebrate() {
  clearConfetti(); celebrationAge = 0;
  const positions = [], colors = [], velocity = [];
  const palette = ['#ed8b55','#d7ec90','#ffffff','#73c0b8'].map(c => new THREE.Color(c));
  for (let i = 0; i < 100; i++) {
    positions.push(player.x, player.y + 1.5, player.z);
    const color = palette[i % 4]; colors.push(color.r,color.g,color.b);
    const angle = Math.random() * Math.PI * 2;
    velocity.push(Math.cos(angle)*(1+Math.random()*2),3+Math.random()*4,Math.sin(angle)*(1+Math.random()*2));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  confetti = new THREE.Points(geometry,new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:1}));
  confetti.userData.velocity = velocity; scene.add(confetti);
}
function finish() {
  setPhase('won'); clearInput(); celebrate();
  $('final-time').textContent = formatTime(player.elapsed,true);
  $('final-falls').textContent = `${player.falls}회`;
  $('final-jumps').textContent = `${player.jumps}번`;
  let best = null;
  if (!demoPlaying) try {
    const previous = Number(localStorage.getItem(RECORD_KEY));
    if (!previous || player.elapsed < previous) { localStorage.setItem(RECORD_KEY,String(player.elapsed)); best = '나의 새로운 최고 기록!'; }
    else best = `나의 최고 기록 ${formatTime(previous,true)}`;
  } catch {}
  $('best-record').textContent = demoPlaying ? '시범 기록은 개인 최고 기록에 저장되지 않아요.' : best || '나만의 첫 등반 기록';
  $('finish-title').textContent=demoPlaying?'시범 등반 완료!':'드디어, 정상!';
  $('finish-copy').innerHTML=demoPlaying?'이제 내 손으로 도전할 차례예요.<br>발판 끝에서 점프하는 타이밍을 기억하세요!':'한 번 더 도전한 당신이<br>이 산의 새로운 등반가예요.';
  $('again-button').textContent=demoPlaying?'직접 도전하기 ↗':'한 번 더 도전 ↗';
  $('game-announcement').textContent = `정상 도착! 등반 시간 ${formatTime(player.elapsed)}, 재도전 ${player.falls}회.`;
  setTimeout(() => { if (phase === 'won') $('win-dialog').showModal(); }, 1000);
}
function onEvent(event) {
  sound(event);
  if (event === 'checkpoint') {
    world.checkpointReached(player.checkpointId);
    notify(`⚑ 쉼터 ${checkpoints.findIndex(platform => platform.id === player.checkpointId) + 1} 도착! 여기서 다시 출발할 수 있어요.`);
  }
  if (event === 'fall') {
    $('fall-flash').classList.add('active');
    clearTimeout(flashTimer); flashTimer=setTimeout(()=>$('fall-flash').classList.remove('active'),120);
    camera.position.set(player.x,player.y+7.8,player.z+11.5);
    lookTarget.set(player.x,player.y+1,player.z-2.8);
    notify(player.checkpointId ? '괜찮아요! 마지막 쉼터에서 다시 도전.' : '다시 한 번! 발판 끝에서 점프해 보세요.');
  }
  if (event === 'win') finish();
}
function startGame(rebuild = false, demo = false) {
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  clearInput(); clearConfetti();
  if (rebuild) { world.dispose(); world=createWorld(scene,COURSE); }
  resetPlayer(player,COURSE[0]);
  $('game-announcement').textContent='';
  demoPlaying=demo;document.body.dataset.mode=demo?'demo':'play';
  document.querySelector('.course-label').innerHTML=demo?'<span class="live-dot"></span> 시범 등반 <span class="divider">/</span> 방향키를 누르면 직접 도전':'<span class="live-dot"></span> 도전 코스 <span class="divider">/</span> 바람의 능선';
  setPhase('playing'); updateHUD(); wakeAudio(); canvas.focus();
  notify(demo?'시범 등반 중 · 발판 끝에서 점프하는 모습을 보세요.':'WASD로 이동 · 발판 끝에서 SPACE로 점프!');
}
function pause() {
  if (phase !== 'playing') return;
  returnPhase='playing'; setPhase('paused'); clearInput(); $('pause-dialog').showModal();
}
function resume() {
  $('pause-dialog').close(); clearInput();
  setPhase(returnPhase); if (returnPhase === 'playing') canvas.focus();
}
function returnToCheckpoint() {
  if (phase !== 'playing') return;
  if (demoPlaying) { startGame(true,false); return; }
  player.falls++; respawnPlayer(player,COURSE.find(p=>p.id===player.checkpointId)||COURSE[0]);
  clearInput(); onEvent('fall'); updateHUD();
}
function fatal(error) {
  console.error(error);
  $('error-panel').hidden=false;
  $('error-message').textContent=`게임을 불러오지 못했습니다. 실행 서버와 WebGL 지원 여부를 확인해 주세요. ${error.message || error}`;
}

try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,300);
  camera.position.set(16,13,17); camera.lookAt(0,3,-16);
  scene.add(new THREE.HemisphereLight('#e3f7ff','#b3a084',2.15));
  light=new THREE.DirectionalLight('#fff5d8',2.5); light.position.set(15,27,10);
  light.castShadow=true; light.shadow.mapSize.set(1024,1024);
  Object.assign(light.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:85});
  light.shadow.bias=-.0003; light.shadow.normalBias=.04;
  scene.add(light,light.target);
  world=createWorld(scene,COURSE); character=createCharacter(scene);
  resetPlayer(player,COURSE[0]); character.update(0,player,0);
  $('start-label').textContent='등반 시작'; $('start-button').disabled=false;
  setupCourseUI(); updateSoundButton(); updateHUD(); canvas.dataset.ready='true';

  $('start-button').addEventListener('click',()=>startGame());
  $('demo-button').addEventListener('click',()=>startGame(true,true));
  $('again-button').addEventListener('click',()=>startGame(true));
  $('restart-button').addEventListener('click',()=>startGame(true));
  $('view-summit').addEventListener('click',()=>{ $('win-dialog').close(); notify('정상 도착! 한 번 더 도전하려면 R을 누르세요.'); });
  $('resume-button').addEventListener('click',resume);
  $('pause-dialog').addEventListener('cancel',e=>{ e.preventDefault(); resume(); });
  $('win-dialog').addEventListener('cancel',e=>{ e.preventDefault(); $('win-dialog').close(); });
  $('help-button').addEventListener('click',()=>{
    returnPhase=phase; if (phase==='playing') setPhase('paused'); clearInput();
    $('resume-button').textContent=phase==='intro'?'알겠어요':'계속 오르기 ↗';
    $('pause-dialog').showModal();
  });
  $('sound-button').addEventListener('click',()=>{
    muted=!muted; try{localStorage.setItem('summit-sound',muted?'off':'on');}catch{}
    updateSoundButton(); wakeAudio();
  });
  $('character-button').addEventListener('click',()=>{
    returnPhase=phase; if(phase==='playing')setPhase('paused'); clearInput(); $('character-dialog').showModal();
  });
  function closeCharacter(){ $('character-dialog').close(); setPhase(returnPhase); clearInput(); if(phase==='playing')canvas.focus(); }
  $('close-character').addEventListener('click',closeCharacter);
  $('character-dialog').addEventListener('cancel',e=>{e.preventDefault();closeCharacter();});
  $('default-character').addEventListener('click',()=>{
    character.useDefault(); $('model-name').textContent='기본 등산가'; $('model-detail').textContent='대기 · 달리기 · 점프';
    $('model-message').textContent='기본 등산가로 돌아왔어요.'; $('model-message').classList.remove('error');
    $('model-file').value=''; canvas.dataset.character='default';
    $('flip-character').hidden=true;
  });
  $('flip-character').addEventListener('click',()=>{modelFacing=modelFacing===0?Math.PI:0;character.setFacingOffset(modelFacing);$('model-message').textContent='캐릭터 앞뒤 방향을 바꿨어요.';});
  $('model-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0]; if(!file)return;
    $('model-message').textContent='캐릭터를 불러오는 중…'; $('model-message').classList.remove('error');
    $('close-character').disabled=true; $('model-file').disabled=true;
    try {
      const info=await character.loadGLB(file);
      $('model-name').textContent=info.name;
      $('model-detail').textContent=info.animations.length?`애니메이션 ${info.animations.length}개`:'포함된 애니메이션 없음';
      $('model-message').textContent=info.animations.length?'캐릭터를 적용했어요. 움직임과 정면 방향을 확인해 주세요.':'모델을 적용했어요. 동작이 없는 모델은 자세가 고정됩니다.';
      canvas.dataset.character=file.name;
      modelFacing=Math.PI;$('flip-character').hidden=false;
    } catch(error){ $('model-message').textContent=error.message||'파일을 불러오지 못했어요.'; $('model-message').classList.add('error'); }
    finally { $('close-character').disabled=false; $('model-file').disabled=false; $('model-file').value=''; }
  });
  window.addEventListener('keydown',event=>{
    if(event.target instanceof HTMLInputElement)return;
    if(moveKeys.has(event.code)&&phase==='playing')event.preventDefault();
    if(event.code==='Escape'&&!document.querySelector('dialog[open]')){event.preventDefault();pause();return;}
    if(event.code==='KeyR'&&!event.repeat&&!document.querySelector('dialog[open]')){if(phase==='won')startGame(true);else returnToCheckpoint();return;}
    if(phase!=='playing')return;
    if(demoPlaying&&moveKeys.has(event.code))startGame(true,false);
    if(event.code==='Space'&&!keys.has('Space')&&!event.repeat)jumpQueued=true;
    keys.add(event.code);
  });
  window.addEventListener('keyup',event=>keys.delete(event.code));
  window.addEventListener('blur',()=>{clearInput();pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  const touchMap={up:'KeyW',left:'KeyA',down:'KeyS',right:'KeyD'};
  document.querySelectorAll('[data-move]').forEach(button=>{
    const code=touchMap[button.dataset.move];
    button.addEventListener('pointerdown',event=>{event.preventDefault();if(demoPlaying)startGame(true,false);button.setPointerCapture(event.pointerId);keys.add(code);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(code));
  });
  $('touch-jump').addEventListener('pointerdown',event=>{event.preventDefault();if(demoPlaying)startGame(true,false);event.target.setPointerCapture(event.pointerId);jumpQueued=true;keys.add('Space');});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('touch-jump').addEventListener(name,()=>keys.delete('Space'));
  canvas.dataset.character='default';

  // Share the classroom asset while keeping the built-in explorer available if loading fails.
  async function loadProvidedCharacter() {
    $('model-file').disabled=true; $('default-character').disabled=true;
    $('model-message').textContent='수업용 캐릭터를 불러오는 중…';
    try {
      const response=await fetch('../assets/class_character.glb', {signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`캐릭터 파일 응답: ${response.status}`);
      const file=new File([await response.blob()],'class_character.glb',{type:'model/gltf-binary'});
      const info=await character.loadGLB(file);
      $('model-name').textContent='수업용 캐릭터';
      $('model-detail').textContent=`애니메이션 ${info.animations.length}개 · 대기 / 달리기`;
      $('model-message').textContent='수업용 캐릭터를 적용했어요. 다른 GLB 파일로 바꿀 수도 있어요.';
      canvas.dataset.character=file.name;
      modelFacing=Math.PI; $('flip-character').hidden=false;
    } catch(error) {
      $('model-message').textContent='수업용 캐릭터를 불러오지 못해 기본 등산가를 사용해요. GLB 파일을 직접 선택할 수 있어요.';
    } finally {
      $('model-file').disabled=false; $('default-character').disabled=false;
    }
  }
  void loadProvidedCharacter();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt=Math.min((now-lastTime)/1000,.06); lastTime=now; worldTime+=dt;
    if(phase==='playing') {
      accumulator+=dt;
      while(accumulator>=1/120&&phase==='playing') {
        const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
        const z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
        const input=demoPlaying?getDemoInput(player,COURSE):{x,z,jumpPressed:jumpQueued,jumpHeld:keys.has('Space')};
        const events=stepPlayer(player,input,1/120,COURSE);
        jumpQueued=false; accumulator-=1/120;
        for(const event of events)onEvent(event);
      }
    }
    world.update(worldTime,player);
    character.update(phase==='paused'?0:dt,player,worldTime);
    if(phase==='intro') {
      desiredCamera.set(16+Math.sin(worldTime*.08)*1.5,13,17);
      desiredLook.set(-1,3,-16);
    } else {
      const floor=COURSE.find(p=>p.id===player.checkpointId)?.y||0;
      const cameraY=Math.max(player.y,floor-1.5);
      desiredCamera.set(player.x,cameraY+7.8,player.z+11.5);
      desiredLook.set(player.x,cameraY+1.0,player.z-2.8);
    }
    const smoothing=1-Math.exp(-dt*5);
    camera.position.lerp(desiredCamera,smoothing);lookTarget.lerp(desiredLook,smoothing);camera.lookAt(lookTarget);
    light.position.set(player.x+15,player.y+27,player.z+10);
    light.target.position.set(player.x,player.y,player.z-6);
    if(confetti) {
      celebrationAge+=dt;
      const positions=confetti.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const v=confetti.userData.velocity;v[i*3+1]-=dt*4;
        positions.setXYZ(i,positions.getX(i)+v[i*3]*dt,positions.getY(i)+v[i*3+1]*dt,positions.getZ(i)+v[i*3+2]*dt);
      }
      positions.needsUpdate=true;confetti.material.opacity=Math.max(0,1-celebrationAge/4);
      if(celebrationAge>4)clearConfetti();
    }
    renderer.render(scene,camera);
    hudTimer+=dt;if(hudTimer>.08){updateHUD();hudTimer=0;}
  }
  requestAnimationFrame(frame);
} catch(error) { fatal(error); }
