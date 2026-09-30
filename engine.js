import { COURSE } from './course.js';
import { applyMovement } from './movement.js';
import { applyJump } from './jump.js';
import { onLand } from './checkpoints.js';

// 교사 제공: 학생이 만든 속도와 점프를 실제 중력/충돌에 연결합니다.
export const ENGINE = Object.freeze({ gravity: 20, radius: 0.25, height: 1.4, slab: 0.6, fallDistance: 8 });

export function createPlayer() {
  const start = COURSE[0];
  return { x:start.x, y:start.y, z:start.z, vx:0, vy:0, vz:0, grounded:true,
    platformId:start.id, checkpointId:start.id, spawn:{x:start.x,y:start.y,z:start.z},
    won:false, falls:0, jumps:0, elapsed:0 };
}

export function resetPlayer(player) { Object.assign(player, createPlayer()); }

export function respawnPlayer(player) {
  Object.assign(player, player.spawn, {vx:0,vy:0,vz:0,grounded:true,platformId:player.checkpointId,won:false});
}

function moveHorizontally(player, nextY, dt) {
  const dx = player.vx * dt, dz = player.vz * dt;
  let x = player.x + dx, z = player.z + dz;
  for (const p of COURSE) {
    if (nextY >= p.y - 0.0001 || nextY + ENGINE.height <= p.y - ENGINE.slab + 0.0001) continue;
    const left=p.x-p.width/2-ENGINE.radius, right=p.x+p.width/2+ENGINE.radius;
    const front=p.z-p.depth/2-ENGINE.radius, back=p.z+p.depth/2+ENGINE.radius;
    if (player.z>front && player.z<back) {
      if (dx>0 && player.x<=left && x>left) { x=left; player.vx=0; }
      if (dx<0 && player.x>=right && x<right) { x=right; player.vx=0; }
    }
    if (x>left && x<right) {
      if (dz>0 && player.z<=front && z>front) { z=front; player.vz=0; }
      if (dz<0 && player.z>=back && z<back) { z=back; player.vz=0; }
    }
  }
  player.x=x; player.z=z;
}

export function stepPlayer(player, input, dt=1/120) {
  if (player.won) return [];
  const events=[];
  const wasGrounded=player.grounded, previousPlatform=player.platformId;
  applyMovement(player,input,dt);
  applyJump(player,input,dt);
  if (wasGrounded && !player.grounded && player.vy>0) { player.jumps++; events.push('jump'); }
  const previousY=player.y;
  player.vy-=ENGINE.gravity*dt;
  let nextY=previousY+player.vy*dt;
  moveHorizontally(player,nextY,dt);
  player.grounded=false; player.platformId=null;
  let landing=null;
  if (player.vy<=0) {
    for (const p of COURSE) {
      const inside=Math.abs(player.x-p.x)<=p.width/2+0.15 && Math.abs(player.z-p.z)<=p.depth/2+0.15;
      if (inside && previousY>=p.y-0.0001 && nextY<=p.y+0.0001 && (!landing || p.y>landing.y)) landing=p;
    }
  }
  if (landing) {
    nextY=landing.y; player.vy=0; player.grounded=true; player.platformId=landing.id;
    if (!wasGrounded || previousPlatform!==landing.id) {
      const beforeCheckpoint=player.checkpointId;
      onLand(player,landing);
      events.push('land');
      if (player.checkpointId!==beforeCheckpoint) events.push('checkpoint');
    }
    if (landing.finish) { player.won=true; events.push('win'); }
  }
  player.y=nextY;
  player.elapsed+=dt;
  if (player.y<player.spawn.y-ENGINE.fallDistance || Math.abs(player.x)>45 || player.z>25 || player.z< -70) {
    player.falls++;
    respawnPlayer(player);
    events.push('fall');
  }
  return events;
}
