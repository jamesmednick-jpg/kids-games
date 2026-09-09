import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, LOGICAL_W, LOGICAL_H, nailPolygon, polygonBounds, pointInPolygon,
  interpolate, buildHand, hitNail, hitNailLoose,
} from '../../nail-salon/geometry.js';

const RECT = { x: 100, y: 100, w: 60, h: 80 };

test('SHAPES lists the five spec shapes', () => {
  assert.deepEqual(SHAPES, ['round', 'square', 'oval', 'almond', 'pointed']);
});

test('logical space is 600 by 800', () => {
  assert.equal(LOGICAL_W, 600);
  assert.equal(LOGICAL_H, 800);
});

for (const shape of SHAPES) {
  test(`nailPolygon(${shape}) stays inside its rect and has many points`, () => {
    const pts = nailPolygon(shape, RECT);
    assert.ok(pts.length >= 40);
    for (const [x, y] of pts) {
      assert.ok(x >= RECT.x - 1e-9 && x <= RECT.x + RECT.w + 1e-9, `x ${x}`);
      assert.ok(y >= RECT.y - 1e-9 && y <= RECT.y + RECT.h + 1e-9, `y ${y}`);
    }
  });

  test(`nailPolygon(${shape}) contains the rect center`, () => {
    const pts = nailPolygon(shape, RECT);
    assert.ok(pointInPolygon(RECT.x + RECT.w / 2, RECT.y + RECT.h / 2, pts));
  });
}

test('square tip is nearly flat, pointed tip is a point', () => {
  const sq = nailPolygon('square', RECT);
  const topSq = sq.slice(0, 25).map(p => p[1]);
  assert.ok(Math.max(...topSq) - Math.min(...topSq) < RECT.w * 0.1);

  const pt = nailPolygon('pointed', RECT);
  // the middle top sample is the highest point and corners are much lower
  assert.ok(pt[12][1] < pt[0][1] - RECT.w * 0.5);
});

test('round nail excludes its top corners', () => {
  const pts = nailPolygon('round', RECT);
  assert.equal(pointInPolygon(RECT.x + 1, RECT.y + 1, pts), false);
  assert.equal(pointInPolygon(RECT.x + RECT.w - 1, RECT.y + 1, pts), false);
});

test('polygonBounds', () => {
  assert.deepEqual(polygonBounds([[1, 5], [4, 2], [3, 9]]), { minX: 1, minY: 2, maxX: 4, maxY: 9 });
});

test('pointInPolygon on a square', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(pointInPolygon(5, 5, sq), true);
  assert.equal(pointInPolygon(15, 5, sq), false);
  assert.equal(pointInPolygon(-1, -1, sq), false);
});

test('interpolate returns evenly spaced points ending at b', () => {
  const pts = interpolate({ x: 0, y: 0 }, { x: 10, y: 0 }, 2.5);
  assert.deepEqual(pts, [{ x: 2.5, y: 0 }, { x: 5, y: 0 }, { x: 7.5, y: 0 }, { x: 10, y: 0 }]);
});

test('interpolate for a short hop returns just b', () => {
  assert.deepEqual(interpolate({ x: 0, y: 0 }, { x: 1, y: 1 }, 5), [{ x: 1, y: 1 }]);
});

test('buildHand has five nails inside the logical space and no overlaps', () => {
  for (const shape of SHAPES) {
    const hand = buildHand(shape);
    assert.equal(hand.nails.length, 5);
    assert.deepEqual(hand.nails.map(n => n.finger), ['thumb', 'index', 'middle', 'ring', 'pinky']);
    for (const n of hand.nails) {
      assert.ok(n.bounds.minX >= 0 && n.bounds.maxX <= LOGICAL_W);
      assert.ok(n.bounds.minY >= 0 && n.bounds.maxY <= LOGICAL_H);
    }
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const a = hand.nails[i].bounds, b = hand.nails[j].bounds;
      const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
      assert.equal(overlap, false, `${shape}: nails ${i} and ${j} overlap`);
    }
  }
});

test('longer shapes extend the nail upward, not downward', () => {
  const round = buildHand('round').nails[1].rect;
  const pointed = buildHand('pointed').nails[1].rect;
  assert.equal(round.y + round.h, pointed.y + pointed.h);
  assert.ok(pointed.y < round.y);
});

test('hitNail finds the nail under a point and -1 elsewhere', () => {
  const hand = buildHand('round');
  hand.nails.forEach((n, i) => {
    assert.equal(hitNail(hand, n.center.x, n.center.y), i);
  });
  assert.equal(hitNail(hand, 350, 700), -1); // palm
  assert.equal(hitNail(hand, -5, -5), -1);
});

test('nails carry an angle, pivot and global center; thumb leans left, middle is straight', () => {
  const hand = buildHand('round');
  const [thumb, , middle] = hand.nails;
  assert.ok(thumb.angle < -0.4, `thumb angle ${thumb.angle}`);
  assert.equal(middle.angle, 0);
  for (const n of hand.nails) {
    assert.ok(Number.isFinite(n.pivot.x) && Number.isFinite(n.pivot.y));
    // center sits inside the polygon and inside the bounds
    assert.ok(pointInPolygon(n.center.x, n.center.y, n.points));
    assert.ok(n.center.x > n.bounds.minX && n.center.x < n.bounds.maxX);
  }
  // the thumb nail really is rotated: its polygon is wider than its local rect
  assert.ok(thumb.bounds.maxX - thumb.bounds.minX > thumb.rect.w * 1.1);
});

test('hitNailLoose accepts taps a little outside the nail, but not far away', () => {
  const hand = buildHand('round');
  const m = hand.nails[2];
  const justLeft = { x: m.bounds.minX - 15, y: m.center.y };
  assert.equal(hitNail(hand, justLeft.x, justLeft.y), -1);
  assert.equal(hitNailLoose(hand, justLeft.x, justLeft.y, 25), 2);
  assert.equal(hitNailLoose(hand, 350, 700, 25), -1);
  assert.equal(hitNailLoose(hand, m.center.x, m.bounds.maxY + 60, 25), -1); // down the finger, near nothing
});
