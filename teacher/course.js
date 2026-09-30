// Platform y is the walkable top surface, in metres. Edit this list to build a course.
export const COURSE = [
  { id: 0, x: 0, y: 0, z: 0, width: 7, depth: 6, checkpoint: false, finish: false },
  // Practice: even the first stepping stones need deliberate landings.
  { id: 1, x: -1, y: 1, z: -5.4, width: 2, depth: 2, checkpoint: false, finish: false },
  { id: 2, x: 0.8, y: 2.1, z: -9.8, width: 1.9, depth: 1.9, checkpoint: false, finish: false },
  { id: 3, x: -1, y: 3.3, z: -14.1, width: 1.7, depth: 1.8, checkpoint: false, finish: false },
  { id: 4, x: 0.8, y: 4.6, z: -18.3, width: 1.6, depth: 1.6, checkpoint: false, finish: false },
  { id: 5, x: 0, y: 5.8, z: -23.1, width: 5.5, depth: 4.4, checkpoint: true, finish: false },
  // Traverse: narrow in both axes, with diagonal direction changes.
  { id: 6, x: -2.2, y: 7.1, z: -29, width: 1.4, depth: 1.4, checkpoint: false, finish: false },
  { id: 7, x: -0.4, y: 8.35, z: -33.2, width: 1.35, depth: 1.35, checkpoint: false, finish: false },
  { id: 8, x: 1.6, y: 9.6, z: -37.4, width: 1.3, depth: 1.3, checkpoint: false, finish: false },
  { id: 9, x: -0.4, y: 10.85, z: -41.5, width: 1.25, depth: 1.25, checkpoint: false, finish: false },
  { id: 10, x: -2.3, y: 12.15, z: -45.6, width: 1.2, depth: 1.2, checkpoint: false, finish: false },
  { id: 11, x: 0, y: 13.35, z: -50.3, width: 5.5, depth: 4.4, checkpoint: true, finish: false },
  // Ridge: one-metre stones. Control speed before changing direction.
  { id: 12, x: 2.2, y: 14.7, z: -56.1, width: 1, depth: 1, checkpoint: false, finish: false },
  { id: 13, x: 0.5, y: 16, z: -60, width: 0.95, depth: 1, checkpoint: false, finish: false },
  { id: 14, x: -1.2, y: 17.35, z: -63.9, width: 0.9, depth: 0.95, checkpoint: false, finish: false },
  { id: 15, x: 0.5, y: 18.7, z: -67.7, width: 0.9, depth: 0.9, checkpoint: false, finish: false },
  { id: 16, x: 2.3, y: 19.95, z: -72.5, width: 5.2, depth: 4.2, checkpoint: true, finish: false },
  // Final approach: barely wider than the character, then a broad summit.
  { id: 17, x: 0.3, y: 21.35, z: -78.2, width: 0.9, depth: 0.9, checkpoint: false, finish: false },
  { id: 18, x: -1.4, y: 22.75, z: -82, width: 0.85, depth: 0.85, checkpoint: false, finish: false },
  { id: 19, x: 0, y: 24.1, z: -86.8, width: 6, depth: 5.5, checkpoint: false, finish: true },
];
