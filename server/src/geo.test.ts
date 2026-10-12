import { describe, expect, it } from 'vitest';
import { buildShape, pointAt, project, slice } from './geo.js';

// ~1.1 km east-west line at the equator-ish scale, with a return leg.
const line = buildShape([[45, 12], [45, 12.01], [45, 12.02]]);

describe('geo', () => {
  it('projects a point onto the shape', () => {
    const p = project(line, [45.0005, 12.01])!;
    expect(p.along).toBeCloseTo(line.cum[1], -1);
    expect(p.offset).toBeLessThan(60);
  });

  it('respects minAlong on looping shapes', () => {
    const loop = buildShape([[45, 12], [45, 12.01], [45.01, 12.01], [45.0001, 12.01], [45.0001, 12]]);
    const early = project(loop, [45.00002, 12.005])!;
    const late = project(loop, [45.00002, 12.005], loop.cum[3])!;
    expect(late.along).toBeGreaterThan(early.along);
  });

  it('slices between two distances', () => {
    const path = slice(line, line.cum[1] / 2, line.cum[1] * 1.5);
    expect(path[0]).toEqual(pointAt(line, line.cum[1] / 2));
    expect(path).toContainEqual([45, 12.01]);
    expect(path.length).toBe(3);
  });
});
