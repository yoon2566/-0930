import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE } from './course.js';
import { SETTINGS, createPlayer, resetPlayer, stepPlayer } from './physics.js';
import { getDemoInput } from './demo.js';

const DT = 1 / 120;
const idle = { x: 0, z: 0, jumpPressed: false, jumpHeld: false };
const tick = (player, input = idle, course = COURSE) => stepPlayer(player, input, DT, course);

test('jump rises, returns to the exact platform top, and emits one landing', () => {
  const player = createPlayer();
  const events = tick(player, { ...idle, jumpPressed: true, jumpHeld: true });
  let peak = player.y;
  for (let i = 0; i < 180; i++) {
    events.push(...tick(player));
    peak = Math.max(peak, player.y);
  }
  assert.ok(peak > 2.3 && peak < 2.5, `peak ${peak}`);
  assert.equal(player.y, COURSE[0].y);
  assert.equal(player.grounded, true);
  assert.deepEqual(events, ['jump', 'land']);
});

test('holding Space and repeated midair taps cannot create extra jumps', () => {
  const player = createPlayer();
  tick(player, { ...idle, jumpPressed: true, jumpHeld: true });
  for (let i = 0; i < 240; i++) tick(player, { ...idle, jumpPressed: true, jumpHeld: true });
  assert.equal(player.jumps, 1);
  assert.equal(player.grounded, true);
  tick(player);
  tick(player, { ...idle, jumpPressed: true, jumpHeld: true });
  for (let i = 0; i < 60; i++) tick(player, { ...idle, jumpPressed: i % 2 === 0, jumpHeld: i % 2 === 0 });
  assert.equal(player.jumps, 2);
});

test('falling respawns at the latest checkpoint and preserves progress and elapsed time', () => {
  const player = createPlayer();
  const checkpoint = COURSE.filter(platform => platform.checkpoint)[1];
  Object.assign(player, { x: checkpoint.x, z: checkpoint.z, y: checkpoint.y + 0.01, vy: -2, grounded: false });
  const events = tick(player);
  assert.ok(events.includes('checkpoint'));
  assert.equal(player.checkpointId, checkpoint.id);
  player.x = 30;
  player.y = checkpoint.y - SETTINGS.fallDistance - 1;
  player.grounded = false;
  const elapsed = player.elapsed;
  assert.ok(tick(player).includes('fall'));
  assert.equal(player.falls, 1);
  assert.equal(player.highestId, checkpoint.id);
  assert.deepEqual([player.x, player.y, player.z], [checkpoint.x, checkpoint.y, checkpoint.z]);
  assert.ok(player.elapsed > elapsed);
  resetPlayer(player, COURSE[0]);
  assert.equal(player.elapsed, 0);
  assert.equal(player.falls, 0);
  assert.equal(player.checkpointId, 0);
});

test('the side of a higher platform cannot be walked through', () => {
  const wall = { id: 1, x: 0, y: 1.2, z: -3.2, width: 4, depth: 2, checkpoint: false, finish: false };
  const ground = { ...COURSE[0], width: 30, depth: 30 };
  const player = createPlayer();
  for (let i = 0; i < 240; i++) tick(player, { ...idle, z: -1 }, [ground, wall]);
  assert.ok(player.z >= wall.z + wall.depth / 2 + SETTINGS.radius - 0.0001, `z=${player.z}`);
  assert.equal(player.y, 0);
});

test('the summit wins exactly once and stops the clock', () => {
  const player = createPlayer();
  const summit = COURSE.at(-1);
  Object.assign(player, { x: summit.x, z: summit.z, y: summit.y + 0.01, vy: -2, grounded: false });
  assert.ok(tick(player).includes('win'));
  const elapsed = player.elapsed;
  assert.deepEqual(tick(player), []);
  assert.equal(player.elapsed, elapsed);
  assert.equal(player.won, true);
});

test('a short step off an edge permits a coyote jump, but the grace period expires', () => {
  const player = createPlayer();
  player.z = -(COURSE[0].depth / 2 + SETTINGS.radius);
  tick(player);
  assert.equal(player.grounded, false);
  for (let i = 0; i < 4; i++) tick(player);
  assert.ok(tick(player, { ...idle, jumpPressed: true, jumpHeld: true }).includes('jump'));
  assert.ok(player.vy > 0);

  resetPlayer(player, COURSE[0]);
  player.z = -(COURSE[0].depth / 2 + SETTINGS.radius);
  for (let i = 0; i < 30; i++) tick(player);
  assert.equal(tick(player, { ...idle, jumpPressed: true, jumpHeld: true }).includes('jump'), false);
  assert.equal(player.jumps, 0);
});

test('a jump pressed immediately before landing is buffered and executes on landing', () => {
  const player = createPlayer();
  Object.assign(player, { y: 0.09, vy: -4, grounded: false, _coyote: 0 });
  tick(player, { ...idle, jumpPressed: true, jumpHeld: true });
  const events = [];
  for (let i = 0; i < 10; i++) events.push(...tick(player, { ...idle, jumpHeld: true }));
  assert.deepEqual(events, ['land', 'jump']);
  assert.equal(player.jumps, 1);
  assert.ok(player.y > 0);
});

test('diagonal movement has the same maximum speed as straight movement', () => {
  const player = createPlayer();
  const ground = { ...COURSE[0], width: 80, depth: 80 };
  for (let i = 0; i < 120; i++) tick(player, { ...idle, x: 1, z: 1 }, [ground]);
  assert.ok(Math.abs(Math.hypot(player.vx, player.vz) - SETTINGS.speed) < 0.00001);
});

test('the smallest stone has a reduced landing boundary in both horizontal axes', () => {
  const tiny = COURSE.reduce((smallest, platform) => platform.width * platform.depth < smallest.width * smallest.depth ? platform : smallest);
  const footTolerance = SETTINGS.radius * 0.65;
  assert.ok(tiny.width <= 0.85 && tiny.depth <= 0.85);
  assert.ok(tiny.width * tiny.depth < 0.73, 'visible landing surface is below 0.73 square metres');

  const dropAt = (dx, dz) => {
    const player = createPlayer();
    Object.assign(player, { x: tiny.x + dx, z: tiny.z + dz, y: tiny.y + 0.01, vy: -2, grounded: false, _coyote: 0 });
    tick(player);
    return player;
  };
  const insideX = tiny.width / 2 + footTolerance - 0.01;
  const insideZ = tiny.depth / 2 + footTolerance - 0.01;
  assert.equal(dropAt(insideX, insideZ).platformId, tiny.id);
  assert.equal(dropAt(insideX + 0.04, 0).grounded, false, 'missing the X edge must fall');
  assert.equal(dropAt(0, insideZ + 0.04).grounded, false, 'missing the Z edge must fall');
});

test('every successive platform is reachable using actual movement and jump inputs', () => {
  const player = createPlayer();
  const visited = new Set([0]);
  const events = [];
  for (let frame = 0; frame < 120 * 90 && !player.won; frame++) {
    const before = JSON.stringify(player);
    const input = getDemoInput(player, COURSE);
    assert.equal(JSON.stringify(player), before, 'demo returns inputs without changing player state');
    events.push(...tick(player, input));
    if (player.platformId !== null) visited.add(player.platformId);
  }
  assert.equal(player.falls, 0, `falls=${player.falls}, highest=${player.highestId}`);
  assert.equal(player.won, true, `highest=${player.highestId}, position=${player.x},${player.y},${player.z}`);
  assert.deepEqual([...visited], COURSE.map(platform => platform.id));
  assert.equal(events.filter(event => event === 'checkpoint').length, COURSE.filter(platform => platform.checkpoint).length);
  assert.equal(player.jumps, COURSE.length - 1);
  console.log(`Reachability: all ${COURSE.length} platforms, ${player.jumps} jumps, ${player.falls} falls, ${player.elapsed.toFixed(2)} seconds.`);
});

test('demo recovers from a real fall and replays platforms after its checkpoint', () => {
  const player = createPlayer();
  const checkpoint = COURSE.filter(platform => platform.checkpoint)[1];
  const fallFromId = checkpoint.id + 3;
  const revisited = new Set();
  let forcingFall = false;
  let causedFall = false;

  for (let frame = 0; frame < 120 * 90 && !player.won; frame++) {
    if (!causedFall && player.grounded && player.platformId === fallFromId) forcingFall = true;
    const input = forcingFall ? { ...idle, x: 1 } : getDemoInput(player, COURSE);
    const events = tick(player, input);
    if (events.includes('fall')) {
      assert.equal(player.checkpointId, checkpoint.id);
      assert.equal(player.highestId, fallFromId, 'progress survives the fall');
      assert.equal(player.platformId, checkpoint.id);
      forcingFall = false;
      causedFall = true;
    }
    if (causedFall && player.platformId !== null) revisited.add(player.platformId);
  }

  assert.equal(causedFall, true, 'a real movement input must cause the fall');
  assert.equal(player.falls, 1, 'demo must recover without another fall');
  assert.equal(player.won, true);
  assert.deepEqual([...revisited], COURSE.filter(platform => platform.id >= checkpoint.id).map(platform => platform.id));
});
