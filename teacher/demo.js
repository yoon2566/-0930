const nextPlatformByPlayer = new WeakMap();

/** Teacher demonstration controller. Only returns input; never changes player state.
 * Call before each normal fixed-timestep stepPlayer call.
 */
export function getDemoInput(player, course) {
  const neutral = { x: 0, z: 0, jumpPressed: false, jumpHeld: false };
  if (!player || player.won || !course?.length) return neutral;

  const current = course.find(platform => platform.id === player.platformId);
  // Choose from the actual supporting platform after every landing or respawn.
  // highestId deliberately stays high after falling and cannot select the next jump.
  if (player.grounded && current) {
    nextPlatformByPlayer.set(player, course.find(platform => platform.id > current.id)?.id);
  }
  const targetId = nextPlatformByPlayer.get(player);
  const target = course.find(platform => platform.id === targetId)
    || course.find(platform => platform.id > player.checkpointId);
  if (!target) return neutral;

  let goalX = target.x;
  let goalZ = target.z;
  let jumpPressed = false;

  if (player.grounded && current && current.id < target.id) {
    const directionX = target.x - current.x;
    const directionZ = target.z - current.z;
    const distance = Math.hypot(directionX, directionZ);
    if (distance === 0) return neutral;
    const unitX = directionX / distance;
    const unitZ = directionZ / distance;
    // Approach a point inside the edge, leaving room for the player's feet.
    const inset = Math.min(0.3, Math.min(current.width, current.depth) * 0.18);
    const travel = Math.min(
      (current.width / 2 - inset) / Math.max(Math.abs(unitX), 0.001),
      (current.depth / 2 - inset) / Math.max(Math.abs(unitZ), 0.001),
    );
    goalX = current.x + unitX * travel;
    goalZ = current.z + unitZ * travel;

    if (Math.hypot(goalX - player.x, goalZ - player.z) < 0.15) {
      jumpPressed = true;
      goalX = target.x;
      goalZ = target.z;
    }
  }

  const dx = goalX - player.x;
  const dz = goalZ - player.z;
  const distance = Math.hypot(dx, dz);
  return {
    x: distance > 0.12 ? dx / distance : 0,
    z: distance > 0.12 ? dz / distance : 0,
    jumpPressed,
    // A one-step tap releases during flight, so every later jump is a fresh press.
    jumpHeld: jumpPressed,
  };
}
