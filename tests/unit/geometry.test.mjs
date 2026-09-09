import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, LOGICAL_W, LOGICAL_H, nailPolygon, polygonBounds, pointInPolygon,
  interpolate, buildHand, hitNail, hitNailLoose, hitFinger, fingerTip, axisPoint, widthAt,
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

test('a short nail ends at the fingertip and a long one reaches past it', () => {
  const gap = shape => {
    const hand = buildHand(shape);
    return fingerTip(hand.fingers[2]).y - hand.nails[2].bounds.minY;   // + is past the tip
  };
  for (const shape of ['round', 'square']) {
    const g = gap(shape);
    assert.ok(Math.abs(g) < 8, `${shape} nail should end at the fingertip, off by ${g.toFixed(1)}`);
  }
  assert.ok(gap('oval') > 10, 'oval reaches past the fingertip');
  assert.ok(gap('almond') > gap('oval'), 'almond is longer than oval');
  assert.ok(gap('pointed') > gap('almond'), 'pointed is longest');
});

test('nails are nearly as wide as the fingertip they sit on', () => {
  const hand = buildHand('round');
  hand.nails.forEach((n, i) => {
    const ratio = n.rect.w / hand.fingers[i].wt;
    assert.ok(ratio > 0.8 && ratio < 0.95, `${n.finger} nail/finger width ${ratio.toFixed(2)}`);
  });
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
  assert.ok(Math.abs(middle.angle) < 0.1, `middle is nearly straight, got ${middle.angle}`);
  // the fingers fan out: each one leans further right than the last
  const leans = hand.nails.slice(1).map(n => n.angle);
  for (let i = 1; i < leans.length; i++) assert.ok(leans[i] > leans[i - 1], 'fingers fan outward');
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

test('hand proportions match a real hand: fingers are shorter than the palm', () => {
  const hand = buildHand('round');
  const tip = fingerTip(hand.fingers[2]);
  const webY = hand.web.n1.y;
  const visibleFinger = webY - tip.y;
  const palm = hand.web.wristL.y - webY;
  const ratio = visibleFinger / palm;
  assert.ok(ratio > 0.7 && ratio < 1.0, `finger/palm ratio ${ratio.toFixed(2)} should be about 0.8`);
  // hand breadth across the four fingers is close to the palm's length
  const breadth = hand.web.pinkyOuter.x - hand.web.indexOuter.x;
  assert.ok(breadth / palm > 0.65 && breadth / palm < 1.0, `breadth/palm ${(breadth / palm).toFixed(2)}`);
});

test('adjacent fingers share a web notch exactly, so the outline cannot seam', () => {
  const hand = buildHand('round');
  for (let i = 1; i < 4; i++) {
    assert.deepEqual(hand.anchors[i].R, hand.anchors[i + 1].L, `notch between finger ${i} and ${i + 1}`);
  }
});

test('the whole hand stays inside the logical space', () => {
  for (const shape of SHAPES) {
    const hand = buildHand(shape);
    for (const f of hand.fingers) {
      for (const side of [-1, 1]) for (const t of [0, 0.5, 1]) {
        const p = axisPoint(f, t);
        const off = (widthAt(f, t) / 2) * side;
        assert.ok(p.x + off > -10 && p.x + off < LOGICAL_W + 10, `${f.name} x ${p.x + off}`);
        assert.ok(p.y > 0 && p.y < LOGICAL_H + 10, `${f.name} y ${p.y}`);
      }
    }
  }
});

test('hitFinger finds a finger anywhere along it and -1 on the palm', () => {
  const hand = buildHand('round');
  hand.fingers.forEach((f, i) => {
    for (const t of [0.2, 0.5, 0.9]) {
      const p = axisPoint(f, t);
      assert.equal(hitFinger(hand, p.x, p.y), i, `${f.name} at t=${t}`);
    }
  });
  assert.equal(hitFinger(hand, 350, 700), -1);  // middle of the palm
  assert.equal(hitFinger(hand, 330, 760), -1);  // near the wrist
  assert.equal(hitFinger(hand, 300, 700), -1);  // below the thumb's root, still palm
  assert.equal(hitFinger(hand, 580, 120), -1);  // empty corner
});
