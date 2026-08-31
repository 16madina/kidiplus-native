import { useMemo } from "react";
import Svg, { Circle, G, Path } from "react-native-svg";
import {
  DEFI_PLUS_HIT_S,
  DEFI_PLUS_NAME_HOLD_S,
  PHASE,
  cruise,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  range,
  smootherstep,
} from "../../lib/defi-plus";

type Props = { t: number; width: number; height: number };

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function meetingPair(t: number, w: number, cx: number) {
  const meet = cruise(range(t, 0.06, PHASE.enterEnd));
  const nest = smootherstep(range(t, PHASE.enterEnd, PHASE.medalReady));
  const gap = lerp(w * 0.17, w * 0.1, nest);
  return {
    meet,
    nest,
    defiX: lerp(cx - w * 0.42, cx - gap, meet),
    plusX: lerp(cx + w * 0.42, cx + gap, meet),
  };
}

function energyPoint(
  u: number,
  t: number,
  side: number,
  w: number,
  cx: number,
  cy: number,
  homeX: number,
  coil: number,
  phase: number,
  spread: number,
) {
  const trail = lerp(w * 0.4, w * 0.04, coil);
  const followX = homeX + side * lerp(trail, 0, u);
  const wave = Math.sin(u * Math.PI * 2.15 + t * 4.6 + phase) * lerp(spread, 5, coil);
  const frizz = Math.sin(u * Math.PI * 5.4 + t * 7.2 + phase * 1.8) * lerp(spread * 0.32, 2, coil);
  const followY = cy + wave + frizz;
  const turns = 1.7 + coil * 1.05;
  const ang = -side * u * Math.PI * 2 * turns + t * (1.7 + coil * 1.6) + phase;
  const r = lerp(w * 0.15, w * 0.195, coil);
  return {
    x: lerp(followX, cx + Math.cos(ang) * r, coil),
    y: lerp(followY, cy + Math.sin(ang) * r * 0.93, coil),
  };
}

function toPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  return d;
}

function filamentPath(
  t: number,
  side: number,
  homeX: number,
  w: number,
  cx: number,
  cy: number,
  coil: number,
  grow: number,
  phase: number,
  spread: number,
) {
  const steps = 12;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const u = lerp(1 - s * grow, s, coil);
    pts.push(energyPoint(u, t, side, w, cx, cy, homeX, coil, phase, spread));
  }
  return toPath(pts);
}

export function defiPlusTitlePair(t: number, width: number, height: number) {
  const cx = width / 2;
  const cy = height * 0.33;
  const pair = meetingPair(t, width, cx);
  const coil = smootherstep(range(t, 2.45, PHASE.medalReady));
  const titleFade = 1 - smootherstep(range(t, PHASE.medalReady - 0.28, PHASE.medalReady + 0.28));
  return {
    cy,
    defiX: pair.defiX,
    plusX: pair.plusX,
    meet: pair.meet,
    coil,
    fade: titleFade,
    defiRot: lerp(-4.5, 0, pair.meet),
    plusRot: lerp(4.5, 0, pair.meet),
    shrink: lerp(1, 0.88, coil),
  };
}

export function defiPlusMedalFrame(t: number, width: number, height: number) {
  const medal = smootherstep(range(t, 4.35, PHASE.medalReady + 0.4));
  const split = easeOutCubic(range(t, DEFI_PLUS_HIT_S + 0.08, DEFI_PLUS_HIT_S + 0.95));
  const fade =
    1 -
    range(
      t,
      DEFI_PLUS_HIT_S + 1.15 + DEFI_PLUS_NAME_HOLD_S,
      DEFI_PLUS_HIT_S + 1.85 + DEFI_PLUS_NAME_HOLD_S,
    );
  return {
    on: medal,
    split,
    fade,
    cx: width / 2,
    cy: height * 0.33,
    r: width * 0.205 * 0.92,
    dx: lerp(0, width * 0.48, split),
  };
}

/** Procedural Défi Plus motion — same beats as the web canvas, drawn with SVG. */
export function DefiPlusMotionScene({ t, width: w, height: h }: Props) {
  const cx = w / 2;
  const cy = h * 0.33;
  const scene = useMemo(() => {
    const pair = meetingPair(t, w, cx);
    const grow = smootherstep(range(t, 0.04, 0.95));
    const coil = smootherstep(range(t, 2.45, PHASE.medalReady));
    const medal = smootherstep(range(t, 4.35, PHASE.medalReady + 0.4));
    const threadFade = 1 - smootherstep(range(t, PHASE.medalReady + 0.05, PHASE.medalReady + 0.6));
    const impact = range(t, DEFI_PLUS_HIT_S - 0.05, DEFI_PLUS_HIT_S + 0.6);
    const shardsOn =
      lerp(0, 0.4, range(t, PHASE.medalReady - 0.2, PHASE.medalReady + 0.5)) *
      (1 - range(t, DEFI_PLUS_HIT_S - 0.1, DEFI_PLUS_HIT_S + 0.15) * 0.35);
    const pull =
      easeInOutCubic(range(t, 0.3, PHASE.braidEnd)) *
      (1 - range(t, PHASE.medalReady - 0.2, PHASE.medalReady + 0.4));

    const beards = [
      { phase: 0.05, spread: 26, width: 6.2 },
      { phase: 0.55, spread: 17, width: 4.6 },
      { phase: 1.1, spread: 31, width: 3.8 },
    ];
    const threads = beards.flatMap((b, i) => [
      {
        key: `l${i}`,
        d: filamentPath(t, -1, pair.defiX, w, cx, cy, coil, grow, b.phase, b.spread),
        color: "#50E6FF",
        width: b.width,
        alpha: 0.55 * grow * threadFade,
      },
      {
        key: `r${i}`,
        d: filamentPath(t, 1, pair.plusX, w, cx, cy, coil, grow, Math.PI + b.phase, b.spread),
        color: "#F5C542",
        width: b.width,
        alpha: 0.55 * grow * threadFade,
      },
    ]);

    const shards =
      shardsOn > 0.04
        ? Array.from({ length: 18 }, (_, i) => {
            const jitter = Math.sin(t * 11 + i * 2.1) * 0.03;
            const ang = (i / 18) * Math.PI * 2 + jitter;
            const left = Math.cos(ang) < 0;
            const inner = w * 0.23;
            const outer = inner + w * (0.08 + hash(i) * 0.28) * shardsOn;
            const flick = 0.45 + 0.55 * Math.abs(Math.sin(t * 16 + i));
            return {
              key: `s${i}`,
              d: `M${(cx + Math.cos(ang) * inner).toFixed(1)} ${(cy + Math.sin(ang) * inner).toFixed(1)} L${(
                cx + Math.cos(ang) * outer
              ).toFixed(1)} ${(cy + Math.sin(ang) * outer).toFixed(1)}`,
              color: left ? "#5AEBFF" : "#FFD246",
              alpha: 0.38 * shardsOn * flick,
              width: 0.7 + hash(i + 11) * 2,
            };
          })
        : [];

    const orbits =
      medal > 0.72
        ? Array.from({ length: 4 }, (_, i) => {
            const left = i % 2 === 0;
            const r = w * 0.22;
            const on = medal * 0.4 * (1 - range(t, DEFI_PLUS_HIT_S + 0.05, DEFI_PLUS_HIT_S + 0.35));
            const pts: { x: number; y: number }[] = [];
            for (let s = 0; s <= 16; s++) {
              const u = s / 16;
              const ang = u * Math.PI * 1.8 + t * (1.6 + i * 0.07) + i * 0.7;
              const rad = r + Math.sin(ang * 3 + i) * 10 + (i % 5) * 4;
              pts.push({
                x: cx + Math.cos(ang) * rad * (left ? 1.05 : 0.95),
                y: cy + Math.sin(ang) * rad * 0.86,
              });
            }
            return {
              key: `o${i}`,
              d: toPath(pts),
              color: left ? "#50E6FF" : "#FFCD46",
              alpha: 0.5 * on,
              width: 1.2 + (i % 3) * 0.4,
            };
          })
        : [];

    const sparks = Array.from({ length: 14 }, (_, i) => {
      const side: 0 | 1 = i < 7 ? 0 : 1;
      const life = (hash(i + 3) + t * 0.22) % 1;
      const x0 = side === 0 ? w * hash(i) * 0.42 : w * 0.58 + w * hash(i + 1) * 0.42;
      const y0 = h * 0.14 + h * 0.4 * hash(i + 2);
      const x = lerp(x0, cx, pull * 0.55);
      const y = lerp(y0, cy, pull * 0.55) + Math.sin(t * 6 + i) * 6;
      const dx = x - cx;
      const dy = y - cy;
      const hide = dx * dx + dy * dy < (w * 0.2) ** 2;
      return {
        key: `p${i}`,
        x,
        y,
        r: 1.1 + hash(i + 8) * 1.8,
        color: side === 0 ? "#50EBFF" : "#FFD246",
        alpha: hide ? 0 : (1 - life) * (t < 0.12 ? t / 0.12 : 1) * 0.55,
      };
    });

    const chargeU = range(t, PHASE.medalReady + 0.2, DEFI_PLUS_HIT_S - 0.1);
    const chargeOn = medal > 0.02 && t < DEFI_PLUS_HIT_S && chargeU > 0.01;
    const chargeR = w * 0.205 * 0.92 * 1.07;
    const circ = 2 * Math.PI * chargeR;

    const hit = easeOutCubic(range(t, DEFI_PLUS_HIT_S, DEFI_PLUS_HIT_S + 0.28));
    const hitFade = 1 - range(t, DEFI_PLUS_HIT_S + 0.1, DEFI_PLUS_HIT_S + 0.5);
    const flash = (1 - range(t, DEFI_PLUS_HIT_S, DEFI_PLUS_HIT_S + 0.16)) * 0.16;

    return { threads, shards, orbits, sparks, chargeOn, chargeU, chargeR, circ, hit, hitFade, flash, impact };
  }, [t, w, h, cx, cy]);

  if (w < 8 || h < 8) return null;

  return (
    <Svg width={w} height={h} style={{ position: "absolute", top: 0, left: 0 }}>
      {scene.flash > 0.01 ? (
        <Circle cx={cx} cy={cy} r={Math.max(w, h)} fill={`rgba(255,255,255,${scene.flash})`} />
      ) : null}
      {scene.threads.map((th) =>
        th.alpha > 0.03 && th.d ? (
          <Path
            key={th.key}
            d={th.d}
            stroke={th.color}
            strokeWidth={th.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={th.alpha}
          />
        ) : null,
      )}
      {scene.orbits.map((o) =>
        o.alpha > 0.03 && o.d ? (
          <Path
            key={o.key}
            d={o.d}
            stroke={o.color}
            strokeWidth={o.width}
            strokeLinecap="round"
            fill="none"
            opacity={o.alpha}
          />
        ) : null,
      )}
      {scene.shards.map((s) => (
        <Path key={s.key} d={s.d} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" opacity={s.alpha} />
      ))}
      {scene.sparks.map((p) =>
        p.alpha > 0.04 ? (
          <Circle key={p.key} cx={p.x} cy={p.y} r={p.r} fill={p.color} opacity={p.alpha} />
        ) : null,
      )}
      {scene.chargeOn ? (
        <G>
          <Circle
            cx={cx}
            cy={cy}
            r={scene.chargeR}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={scene.chargeR * 0.075}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={scene.chargeR}
            stroke="#9CEFFF"
            strokeWidth={scene.chargeR * 0.09}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${scene.circ}`}
            strokeDashoffset={scene.circ * (1 - scene.chargeU)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={scene.chargeR}
            stroke="#FFF4C2"
            strokeWidth={scene.chargeR * 0.042}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${scene.circ}`}
            strokeDashoffset={scene.circ * (1 - scene.chargeU)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        </G>
      ) : null}
      {scene.impact > 0 && scene.hitFade > 0.02 ? (
        <Circle
          cx={cx}
          cy={cy}
          r={lerp(4, w * 0.12, scene.hit)}
          stroke={`rgba(255,240,180,${0.8 * scene.hitFade})`}
          strokeWidth={3}
          fill="none"
        />
      ) : null}
    </Svg>
  );
}
