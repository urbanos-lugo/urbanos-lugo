/** A stop's dot on the screen, and the width of its name there. */
export interface NamedDot {
  x: number;
  y: number;
  width: number;
  /** Its own size where it is not the layer's: a trip's boarding stop sits under a pin. */
  radius?: number;
}

/** Where a name is written: its anchor, and how the text sits on it (canvas textAlign). */
export interface NamePlace {
  x: number;
  y: number;
  align: 'left' | 'right' | 'center';
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The box a name takes on the screen, from where it is written and how wide and tall it is. */
export function nameBox(place: NamePlace, width: number, height: number): Box {
  const left = place.align === 'left' ? place.x : place.align === 'right' ? place.x - width : place.x - width / 2;
  return { left, right: left + width, top: place.y - height / 2, bottom: place.y + height / 2 };
}

/**
 * Which written name a tap landed on, with `reach` pixels around each for a finger: a name a
 * dozen pixels tall is a thin target, and it is the thing on the map that says which stop it
 * is. Names never overlap (placeNames), so the first box that holds the point is the one.
 */
export function nameAt<T>(names: { item: T; box: Box }[], x: number, y: number, reach: number): T | null {
  const hit = names.find(({ box }) => x >= box.left - reach && x <= box.right + reach && y >= box.top - reach && y <= box.bottom + reach);
  return hit ? hit.item : null;
}

/**
 * How far a pin has to move, in px, to stop covering the pins it gives way to, `size` apart
 * centre to centre: straight away from each one it sits on, up and to the left when two
 * coincide, and not at all once they no longer touch, so zoomed in it is back on its point.
 * Pushed again while it still touches one: away from the second boarding pin alone, A was
 * left on the first.
 */
export function giveWay(at: { x: number; y: number }, others: { x: number; y: number }[], size: number): [number, number] {
  let { x, y } = at;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const o of others) {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d >= size - 0.01) continue;
      const [ux, uy] = d > 0.5 ? [(x - o.x) / d, (y - o.y) / d] : [-Math.SQRT1_2, -Math.SQRT1_2];
      x += ux * (size - d);
      y += uy * (size - d);
      moved = true;
    }
    if (!moved) break;
  }
  return [x - at.x, y - at.y];
}

/** Which of placeNames' four sides a name was written on: 0 right of its dot, 1 left, 2 above, 3 below. */
export const sideOf = (place: NamePlace, dot: { y: number }): number => (place.align === 'left' ? 0 : place.align === 'right' ? 1 : place.y < dot.y ? 2 : 3);

/** The four places a name can take beside its dot, `off` from its centre, in sideOf's order. */
function sidesOf(d: NamedDot, off: number, height: number): (Box & { place: NamePlace })[] {
  const row = { top: d.y - height / 2, bottom: d.y + height / 2 };
  const centred = { left: d.x - d.width / 2, right: d.x + d.width / 2 };
  return [
    { left: d.x + off, right: d.x + off + d.width, ...row, place: { x: d.x + off, y: d.y, align: 'left' } },
    { left: d.x - off - d.width, right: d.x - off, ...row, place: { x: d.x - off, y: d.y, align: 'right' } },
    { ...centred, top: d.y - off - height, bottom: d.y - off, place: { x: d.x, y: d.y - off - height / 2, align: 'center' } },
    { ...centred, top: d.y + off, bottom: d.y + off + height, place: { x: d.x, y: d.y + off + height / 2, align: 'center' } },
  ];
}

/** Where a name on `side` (sideOf) sits beside its dot now: a name fading out keeps to its dot. */
export const placeOn = (d: NamedDot, side: number, view: { radius: number; gap: number; height: number }): NamePlace =>
  sidesOf(d, (d.radius ?? view.radius) + view.gap, view.height)[side].place;

/**
 * Where each stop's name goes beside its dot, taken in the order given, so the first ones
 * win: on the side it had before (`prefer`, by sideOf) while that is still usable, else to
 * the right of the dot while that stays on the screen, else to the left, else above or below
 * it, and not at all where it would cover a name already written, another stop's dot or a
 * point kept clear (the reader). Written one over another, two names could not be read; a
 * name over a dot hid the stop it lay on, and over the reader, where you are. Chosen afresh
 * each frame of a pan, a name crossing the screen's edge went left there and right again a
 * few pixels on. Pure screen geometry, so it can be checked without a map.
 *
 * `avoid` is what a name would rather not cover, a landmark's icon and name: a side clear of
 * it is taken first, and one over it only when there is no other. A stop's name is what the
 * map is read for, so it is never left out for a landmark's: the landmark is hidden instead (StopNames).
 */
export function placeNames(
  dots: NamedDot[],
  view: { width: number; radius: number; gap: number; height: number; edge: number; keepClear?: { x: number; y: number; radius?: number }[]; avoid?: Box[] },
  prefer: (number | undefined)[] = [],
): (NamePlace | null)[] {
  const { width, radius, gap, height, edge, keepClear = [], avoid = [] } = view;
  const around = ({ x, y, radius: r = radius }: { x: number; y: number; radius?: number }): Box => ({ left: x - r, right: x + r, top: y - r, bottom: y + r });
  const taken = dots.map(around);
  const clear = keepClear.map(around);
  return dots.map((d, i) => {
    const sides = sidesOf(d, (d.radius ?? radius) + gap, height);
    // Each side only while it stays on the screen, except the left of a dot with no room on its right, which has nowhere better.
    const roomRight = sides[0].right <= width - edge;
    const usable = sides.filter((s, k) => (k === 0 ? roomRight : k === 1 ? s.left >= edge || !roomRight : s.left >= edge && s.right <= width - edge));
    const kept = prefer[i] === undefined ? -1 : usable.indexOf(sides[prefer[i]!]);
    const order = kept > 0 ? [usable[kept], ...usable.filter((_, k) => k !== kept)] : usable;
    for (const shy of [true, false]) {
      for (const side of order) {
        const hits = (b: Box) => side.left < b.right && side.right > b.left && side.top < b.bottom && side.bottom > b.top;
        // Its own dot is not in the way.
        if (taken.some((b, j) => j !== i && hits(b)) || clear.some(hits) || (shy && avoid.some(hits))) continue;
        taken.push(side);
        return side.place;
      }
    }
    return null;
  });
}
