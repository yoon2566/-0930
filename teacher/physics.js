export const SETTINGS = Object.freeze({
  speed: 6.5,
  acceleration: 40,
  airAcceleration: 26,
  deceleration: 46,
  gravity: 24,
  jumpSpeed: 10.8,
  radius: 0.28,
  height: 1.35,
  platformThickness: 0.8,
  coyoteTime: 0.11,
  jumpBuffer: 0.13,
  fallDistance: 12,
});

const EPSILON = 0.0001;
const approach = (value, target, amount) => value < target
  ? Math.min(value + amount, target)
  : Math.max(value - amount, target);

export function createPlayer() {
  return {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    grounded: true,
    platformId: 0, checkpointId: 0, highestId: 0,
    falls: 0, jumps: 0, won: false, elapsed: 0,
    _coyote: SETTINGS.coyoteTime,
    _jumpBuffer: 0,
    _jumpWasHeld: false,
  };
}

export function respawnPlayer(player, platform) {
  player.x = platform.x;
  player.y = platform.y;
  player.z = platform.z;
  player.vx = player.vy = player.vz = 0;
  player.grounded = true;
  player.platformId = platform.id;
  player._coyote = SETTINGS.coyoteTime;
  player._jumpBuffer = 0;
  // Preserve the key latch: holding Space during a fall must not cause a new jump.
  return player;
}

export function resetPlayer(player, platform) {
  Object.assign(player, createPlayer());
  player.checkpointId = platform.id;
  player.highestId = platform.id;
  return respawnPlayer(player, platform);
}

function overlapsTop(x, z, platform) {
  // A little foot overlap makes edge landings forgiving without extending the course.
  const foot = SETTINGS.radius * 0.65;
  return Math.abs(x - platform.x) <= platform.width / 2 + foot
    && Math.abs(z - platform.z) <= platform.depth / 2 + foot;
}

function horizontalMove(player, dx, dz, nextY, platforms) {
  const radius = SETTINGS.radius;
  let nextX = player.x + dx;
  let nextZ = player.z + dz;
  for (const platform of platforms) {
    const bottom = platform.y - SETTINGS.platformThickness;
    if (nextY >= platform.y - EPSILON || nextY + SETTINGS.height <= bottom + EPSILON) continue;
    const left = platform.x - platform.width / 2 - radius;
    const right = platform.x + platform.width / 2 + radius;
    const front = platform.z - platform.depth / 2 - radius;
    const back = platform.z + platform.depth / 2 + radius;
    if (player.z > front && player.z < back) {
      if (dx > 0 && player.x <= left && nextX > left) { nextX = left; player.vx = 0; }
      if (dx < 0 && player.x >= right && nextX < right) { nextX = right; player.vx = 0; }
    }
    if (nextX > left && nextX < right) {
      if (dz > 0 && player.z <= front && nextZ > front) { nextZ = front; player.vz = 0; }
      if (dz < 0 && player.z >= back && nextZ < back) { nextZ = back; player.vz = 0; }
    }
  }
  player.x = nextX;
  player.z = nextZ;
}

/** Advance once, using a fixed timestep (recommended: 1 / 120 second).
 * Input x/z are world-space movement; jumpPressed is a fresh key/button press.
 * Returns event names: jump, land, checkpoint, fall, win.
 */
export function stepPlayer(player, input, dt, platforms) {
  if (player.won || !Number.isFinite(dt) || dt <= 0 || platforms.length === 0) return [];
  dt = Math.min(dt, 1 / 30);
  const events = [];
  player.elapsed += dt;
  const wasGrounded = player.grounded;
  player._coyote = wasGrounded ? SETTINGS.coyoteTime : Math.max(0, player._coyote - dt);
  player._jumpBuffer = Math.max(0, player._jumpBuffer - dt);
  if (input.jumpPressed && !player._jumpWasHeld) player._jumpBuffer = SETTINGS.jumpBuffer;
  player._jumpWasHeld = Boolean(input.jumpHeld);

  let moveX = Number.isFinite(input.x) ? input.x : 0;
  let moveZ = Number.isFinite(input.z) ? input.z : 0;
  const length = Math.hypot(moveX, moveZ);
  if (length > 1) { moveX /= length; moveZ /= length; }
  const acceleration = wasGrounded ? SETTINGS.acceleration : SETTINGS.airAcceleration;
  const rate = length > 0 ? acceleration : SETTINGS.deceleration;
  player.vx = approach(player.vx, moveX * SETTINGS.speed, rate * dt);
  player.vz = approach(player.vz, moveZ * SETTINGS.speed, rate * dt);

  if (player._jumpBuffer > 0 && player._coyote > 0) {
    player.vy = SETTINGS.jumpSpeed;
    player.grounded = false;
    player.platformId = null;
    player._coyote = 0;
    player._jumpBuffer = 0;
    player.jumps += 1;
    events.push('jump');
  }

  const previousY = player.y;
  player.vy -= SETTINGS.gravity * dt;
  let nextY = previousY + player.vy * dt;
  horizontalMove(player, player.vx * dt, player.vz * dt, nextY, platforms);
  player.grounded = false;
  player.platformId = null;

  if (player.vy <= 0) {
    let landing = null;
    for (const platform of platforms) {
      if (previousY >= platform.y - EPSILON && nextY <= platform.y + EPSILON
          && overlapsTop(player.x, player.z, platform)
          && (!landing || platform.y > landing.y)) landing = platform;
    }
    if (landing) {
      nextY = landing.y;
      player.vy = 0;
      player.grounded = true;
      player.platformId = landing.id;
      player.highestId = Math.max(player.highestId, landing.id);
      if (!wasGrounded) events.push('land');
      if (landing.checkpoint && landing.id > player.checkpointId) {
        player.checkpointId = landing.id;
        events.push('checkpoint');
      }
      if (landing.finish) { player.won = true; events.push('win'); }
    }
  }
  player.y = nextY;

  const checkpoint = platforms.find(platform => platform.id === player.checkpointId) || platforms[0];
  if (player.y < checkpoint.y - SETTINGS.fallDistance
      || Math.abs(player.x - checkpoint.x) > 90 || Math.abs(player.z - checkpoint.z) > 110) {
    player.falls += 1;
    respawnPlayer(player, checkpoint);
    events.push('fall');
  }
  return events;
}
