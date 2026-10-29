// Exploded, sliced shoe geometry from the "Centre stage" design reference.
// Each part is extruded into Z by stacking 2D slices that shrink towards the
// part's half-depth, which reads as a soft 3D volume under CSS perspective.

import type { PartId } from "./product";

type PartGeom = {
  id: PartId;
  d: string;
  hd: number; // half-depth in Z
  k: number; // how much slices shrink towards the edges
  o: [number, number]; // scale origin
  tp: number; // top of the sheen highlight
  lace?: boolean;
  sole?: boolean;
};

export type SlicePath = {
  key: string;
  d: string;
  tf: string;
  fill: string;
  stroke: string;
  sw: number;
  op: number;
};

export type Slice = { z: string; parts: SlicePath[] };

// Invisible hit shapes per part, at its front, middle and back so the whole
// extruded volume responds. They cover the part's resting spot *and* where it
// has been pulled to, so a part sliding out from under the cursor keeps its hover.
export type HitLayer = { key: string; part: PartId; z: string; paths: { key: string; d: string; tf: string; lace: boolean }[] };

const GEOM: PartGeom[] = [
  { id: "upper", d: "M56,212 L64,118 Q68,90 96,86 L168,84 Q196,104 228,110 L340,128 Q440,146 506,170 Q560,190 566,212 L120,206 Z", hd: 70, k: 0.22, o: [310, 206], tp: 86 },
  { id: "heel", d: "M56,212 L64,118 Q68,94 92,88 L118,92 Q106,150 128,208 Z", hd: 74, k: 0.2, o: [90, 208], tp: 90 },
  { id: "toe", d: "M478,160 Q548,178 566,212 L476,210 Q462,184 478,160 Z", hd: 72, k: 0.25, o: [520, 210], tp: 162 },
  { id: "tongue", d: "M168,84 Q170,48 200,36 L236,40 Q248,74 236,112 L228,110 Q196,104 168,84 Z", hd: 34, k: 0.25, o: [205, 110], tp: 38 },
  { id: "laces", d: "M222,110 L250,92 M252,114 L280,98 M282,119 L310,104 M312,124 L340,110", hd: 48, k: 0, o: [280, 124], tp: 92, lace: true },
  { id: "midsole", d: "M52,238 L580,238 Q586,222 566,212 L120,206 Q70,204 56,212 Q46,222 52,238 Z", hd: 78, k: 0.12, o: [316, 222], tp: 207 },
  { id: "outsole", d: "M58,262 L548,262 Q578,262 580,244 L580,238 L52,238 Q44,250 58,262 Z", hd: 76, k: 0.1, o: [316, 250], tp: 239, sole: true },
];

// How far [dx, dy, grow] each part breaks away from the assembled shoe when hovered.
const PULL: Record<PartId, [number, number, number]> = {
  upper: [0, -64, 0.04],
  heel: [-74, -14, 0.06],
  toe: [70, -18, 0.06],
  tongue: [-14, -92, 0.08],
  laces: [16, -66, 0.06],
  midsole: [0, 58, 0.03],
  outsole: [0, 96, 0.03],
};

// Pieces attached to a pulled part travel with it, so nothing ends up buried:
// the tongue and laces ride on the upper, the outsole drops with the midsole.
const CARRY: Partial<Record<PartId, { by: PartId; d: [number, number] }[]>> = {
  tongue: [{ by: "upper", d: [0, -64] }],
  laces: [{ by: "upper", d: [0, -64] }],
  outsole: [{ by: "midsole", d: [0, 58] }],
};

export const NO_PULL = Object.fromEntries(GEOM.map((p) => [p.id, 0])) as Record<PartId, number>;

const hx = (h: string) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
const mix = (a: string, b: string, t: number) =>
  "#" +
  hx(a)
    .map((v, j) => Math.round(v + (hx(b)[j] - v) * t).toString(16).padStart(2, "0"))
    .join("");

export type ShoeOptions = {
  w: number;
  accent: string;
  pull: Record<PartId, number>; // 0..1 per part, animated
  focus: number; // 0..1, how far the parts that aren't pulled out fade back
};

const partTransform = (p: PartGeom, o: ShoeOptions, s: number) => {
  const pull = o.pull[p.id];
  const [px, py, grow] = PULL[p.id];
  let dx = px * pull;
  let dy = py * pull;
  for (const c of CARRY[p.id] ?? []) {
    dx += c.d[0] * o.pull[c.by];
    dy += c.d[1] * o.pull[c.by];
  }
  const sc = s * (1 + grow * pull);
  return `translate(${dx.toFixed(1)},${dy.toFixed(1)}) translate(${p.o[0]},${p.o[1]}) scale(${sc.toFixed(3)}) translate(${-p.o[0]},${-p.o[1]})`;
};

export function buildShoe(o: ShoeOptions): Slice[] {
  const k = o.w / 620;
  const A = o.accent;
  const N = 22;
  const zm = 80;
  const step = (2 * zm) / (N - 1);
  const slices: Slice[] = [];

  for (let i = 0; i < N; i++) {
    const z = -zm + step * i;
    const parts: SlicePath[] = [];
    for (const p of GEOM) {
      if (Math.abs(z) > p.hd) continue;
      const front = z + step > p.hd;
      const pull = o.pull[p.id];
      const s = 1 - p.k * Math.pow(z / p.hd, 2);
      const tf = partTransform(p, o, s);

      const fade = 0.5 * o.focus * (1 - pull);
      const light = mix(p.sole ? "#E2D7D7" : "#F8F3F1", "#2D3554", fade);
      const dark = mix(p.sole ? "#857883" : "#A3949F", "#131826", fade);
      const c = front ? light : mix(dark, light, 0.25 + 0.6 * ((z + zm) / (2 * zm)));
      let n = 0;
      const push = (x: Omit<SlicePath, "key" | "d" | "tf"> & { tf?: string }) =>
        parts.push({ d: p.d, tf, ...x, key: `${p.id}-${n++}` });

      if (front && pull > 0.02) {
        push({ fill: "none", stroke: A, sw: p.lace ? 14 : 10, op: 0.35 * pull });
      }
      if (p.lace) {
        push({ fill: "none", stroke: c, sw: 7, op: 1 });
        continue;
      }
      push({
        fill: c,
        stroke: front ? (pull > 0.5 ? A : mix(light, dark, 0.35)) : c,
        sw: front ? 1.2 + 1.3 * pull : 2.4,
        op: 1,
      });
      if (front) {
        const cx = p.o[0];
        const tp = p.tp;
        push({
          fill: "#FFFFFF",
          stroke: "none",
          sw: 0,
          op: 0.35 * (1 - fade),
          tf: `${tf} translate(${cx},${tp}) scale(0.78,0.42) translate(${-cx},${-tp})`,
        });
      }
    }
    slices.push({ z: (z * k).toFixed(1), parts });
  }
  return slices;
}

export function buildHitLayers(o: ShoeOptions): HitLayer[] {
  const k = o.w / 620;
  const rest = { ...o, pull: NO_PULL };
  return GEOM.flatMap((p) =>
    [1, 0, -1].map((depth) => {
      const s = 1 - p.k * depth * depth;
      const paths = [{ key: "rest", d: p.d, tf: partTransform(p, rest, s), lace: !!p.lace }];
      if (o.pull[p.id] > 0.02) paths.push({ key: "pulled", d: p.d, tf: partTransform(p, o, s), lace: !!p.lace });
      return { key: `${p.id}${depth}`, part: p.id, z: (depth * p.hd * k).toFixed(1), paths };
    }),
  );
}
