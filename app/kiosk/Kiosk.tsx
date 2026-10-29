"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildHitLayers, buildShoe, NO_PULL } from "@/lib/shoe";
import { LEFT_LABELS, PARTS, PART_ORDER, PRODUCT, RIGHT_LABELS, type PartId } from "@/lib/product";
import { useHandTracking, type HandFrame } from "@/lib/useHandTracking";
import styles from "./kiosk.module.css";

const ACCENT = "#BFD8FF";
const STAGE_W = 1280;
const STAGE_H = 720;

// Interaction tuning.
const HOVER_SETTLE_MS = 120; // hover this long before a part pulls out (stops flicker when sweeping across)
const HOVER_GRACE_MS = 250; // keep hover through brief tracking misses at part edges
const IDLE_MS = 9000; // no one around → attract mode
const ATTRACT_STEP_MS = 3200;
const HAND_MARGIN = 0.12; // ignore the outer edge of the camera frame
const SMOOTHING = 0.45;
const TRAIL_LEN = 10;
// Easing time constants (seconds): smaller = snappier.
const TAU_PULL = 0.16;
const TAU_EXPLODE = 0.35;

type Mode = "attract" | "engaged";
type Anim = { explode: number; focus: number; pull: Record<PartId, number> };

const partAt = (x: number, y: number): PartId | null => {
  const el = document.elementFromPoint(x, y);
  const part = el?.closest("[data-part]")?.getAttribute("data-part");
  return (part as PartId) ?? null;
};

export default function Kiosk() {
  const [active, setActive] = useState<PartId>("outsole");
  const [mode, setMode] = useState<Mode>("attract");
  const [handVisible, setHandVisible] = useState(false);
  const [showSelf, setShowSelf] = useState(false); // camera keeps tracking either way
  const [scale, setScale] = useState(1);
  const [anim, setAnim] = useState<Anim>({ explode: 0.3, focus: 0.5, pull: { ...NO_PULL, outsole: 1 } });

  const videoRef = useRef<HTMLVideoElement>(null);
  const camCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);

  // Mutable interaction state that changes every frame and shouldn't re-render.
  const ix = useRef({
    x: 0,
    y: 0,
    hasPos: false,
    hoverPart: null as PartId | null,
    hoverSince: 0,
    lastHit: 0,
    lastActive: 0,
    trail: [] as [number, number][],
    active: "outsole" as PartId,
    mode: "attract" as Mode,
  });

  const activate = useCallback((part: PartId) => {
    const s = ix.current;
    s.lastActive = performance.now();
    s.active = part;
    s.mode = "engaged";
    setMode("engaged");
    setActive(part);
  }, []);

  const hoverAt = useCallback((part: PartId | null, now: number) => {
    const s = ix.current;
    if (part) s.lastHit = now;
    else if (now - s.lastHit < HOVER_GRACE_MS) part = s.hoverPart;
    if (part !== s.hoverPart) {
      s.hoverPart = part;
      s.hoverSince = now;
    }
    cursorRef.current?.toggleAttribute("data-over", !!part);
  }, []);

  // ---- Hand input -------------------------------------------------------
  const onHand = useCallback(
    (hand: HandFrame | null) => {
      const s = ix.current;
      const now = performance.now();
      const cursor = cursorRef.current;

      if (!hand) {
        if (s.hasPos) {
          s.hasPos = false;
          s.trail = [];
          trailRef.current?.setAttribute("points", "");
          cursor?.style.setProperty("opacity", "0");
          s.lastHit = 0;
          hoverAt(null, now);
          setHandVisible(false);
        }
        return;
      }

      const span = 1 - HAND_MARGIN * 2;
      const tx = Math.min(Math.max((hand.x - HAND_MARGIN) / span, 0), 1) * window.innerWidth;
      const ty = Math.min(Math.max((hand.y - HAND_MARGIN) / span, 0), 1) * window.innerHeight;

      if (!s.hasPos) {
        s.x = tx;
        s.y = ty;
        s.hasPos = true;
        setHandVisible(true);
      }
      s.x += (tx - s.x) * (1 - SMOOTHING);
      s.y += (ty - s.y) * (1 - SMOOTHING);
      s.lastActive = now;
      if (s.mode !== "engaged") {
        s.mode = "engaged";
        setMode("engaged");
      }

      if (cursor) {
        cursor.style.opacity = "1";
        cursor.style.transform = `translate(${s.x}px, ${s.y}px)`;
      }
      s.trail.push([s.x, s.y]);
      if (s.trail.length > TRAIL_LEN) s.trail.shift();
      trailRef.current?.setAttribute("points", s.trail.map((p) => p.join(",")).join(" "));

      hoverAt(partAt(s.x, s.y), now);
    },
    [hoverAt],
  );

  const status = useHandTracking(videoRef, camCanvasRef, onHand, ACCENT);
  const camOk = status !== "no-camera" && status !== "error";

  // ---- Mouse / touch (staff testing, touchscreens, camera off) -------------
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ix.current.hasPos) return; // a tracked hand takes priority
      ix.current.lastActive = performance.now();
      hoverAt(partAt(e.clientX, e.clientY), performance.now());
    };
    const down = (e: PointerEvent) => {
      const part = partAt(e.clientX, e.clientY);
      if (part) activate(part);
      else ix.current.lastActive = performance.now();
    };
    const key = (e: KeyboardEvent) => {
      const i = PART_ORDER.indexOf(ix.current.active);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") activate(PART_ORDER[(i + 1) % PART_ORDER.length]);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") activate(PART_ORDER[(i - 1 + PART_ORDER.length) % PART_ORDER.length]);
      if (e.key === "c") setShowSelf((v) => !v);
      if (e.key === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    const leave = () => hoverAt(null, 0);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [activate, hoverAt]);

  // ---- Attract mode: nobody around → cycle parts to catch the eye ----------
  useEffect(() => {
    const id = setInterval(() => {
      const s = ix.current;
      if (s.mode === "attract") {
        s.active = PART_ORDER[(PART_ORDER.indexOf(s.active) + 1) % PART_ORDER.length];
        setActive(s.active);
      }
    }, ATTRACT_STEP_MS);
    return () => clearInterval(id);
  }, []);

  // ---- Animation loop: settle hover, ease explode / pull / focus -----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const cur: Anim = { explode: 0.3, focus: 0.5, pull: { ...NO_PULL, outsole: 1 } };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = ix.current;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (s.hoverPart && s.hoverPart !== s.active && now - s.hoverSince >= HOVER_SETTLE_MS) activate(s.hoverPart);
      if (s.mode === "engaged" && !s.hasPos && now - s.lastActive > IDLE_MS) {
        s.mode = "attract";
        setMode("attract");
      }

      const engaged = s.mode === "engaged";
      const ease = (from: number, to: number, tau: number) => {
        const v = from + (to - from) * (1 - Math.exp(-dt / tau));
        return Math.abs(to - v) < 0.002 ? to : v;
      };
      let changed = false;
      const step = (from: number, to: number, tau: number) => {
        const v = ease(from, to, tau);
        if (v !== from) changed = true;
        return v;
      };
      cur.explode = step(cur.explode, engaged ? 1 : 0.3, TAU_EXPLODE);
      cur.focus = step(cur.focus, engaged ? 1 : 0.5, TAU_EXPLODE);
      for (const id of PART_ORDER) cur.pull[id] = step(cur.pull[id], id === s.active ? 1 : 0, TAU_PULL);
      if (changed) setAnim({ explode: cur.explode, focus: cur.focus, pull: { ...cur.pull } });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activate]);

  // ---- Fit the 1280×720 artboard to any screen -----------------------------
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const shoeOpts = useMemo(() => ({ w: 700, accent: ACCENT, ...anim }), [anim]);
  const slices = useMemo(() => buildShoe(shoeOpts), [shoeOpts]);
  const hitLayers = useMemo(() => buildHitLayers(shoeOpts), [shoeOpts]);

  const info = PARTS[active];
  const engaged = mode === "engaged";
  const headline = !engaged
    ? camOk
      ? "WAVE YOUR HAND TO EXPLORE"
      : "TOUCH TO EXPLORE"
    : !camOk
      ? "HOVER OVER A PART"
      : handVisible
        ? "POINT AT A PART"
        : "STEP IN AND RAISE A HAND";
  const subline = !engaged
    ? "Every part of this shoe has a story. Take a look inside."
    : camOk
      ? "Move over any part to pull it out."
      : "Move over any part, or tap its name.";

  const label = (id: PartId) => {
    const on = id === active;
    return (
      <span key={id} data-part={id} className={styles.label} style={{ color: on ? "#FFFFFF" : undefined, fontWeight: on ? 700 : 500 }}>
        <span className={styles.dot} style={{ background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, opacity: on ? 1 : 0 }} />
        {PARTS[id].label}
      </span>
    );
  };

  return (
    <div className={styles.viewport}>
      <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
        <div aria-hidden="true" className={styles.frame} />
        <div className={styles.eyebrow}>
          {PRODUCT.name} / {PRODUCT.tagline}
        </div>

        <div className={styles.headline}>
          <span key={headline} className={styles.headlineTitle}>
            {headline}
          </span>
          <span className={styles.headlineSub}>{subline}</span>
        </div>

        <div className={styles.shadow} />
        <div className={styles.shoeWrap}>
          <div className={styles.shoe}>
            {slices.map((sl, i) => (
              <svg
                key={i}
                viewBox="0 -110 620 480"
                width="700"
                height="542"
                aria-hidden="true"
                className={styles.slice}
                style={{ transform: `translateZ(${sl.z}px)` }}
              >
                {sl.parts.map((pt) => (
                  <path
                    key={pt.key}
                    d={pt.d}
                    transform={pt.tf}
                    fill={pt.fill}
                    stroke={pt.stroke}
                    strokeWidth={pt.sw}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={pt.op}
                  />
                ))}
              </svg>
            ))}
            {hitLayers.map((layer) => (
              <svg
                key={layer.key}
                viewBox="0 -110 620 480"
                width="700"
                height="542"
                aria-hidden="true"
                className={styles.slice}
                style={{ transform: `translateZ(${layer.z}px)` }}
              >
                {layer.paths.map((hp) => (
                  <path
                    key={hp.key}
                    data-part={layer.part}
                    d={hp.d}
                    transform={hp.tf}
                    fill="transparent"
                    stroke="transparent"
                    strokeWidth={hp.lace ? 18 : 6}
                    strokeLinecap="round"
                    className={styles.hit}
                  />
                ))}
              </svg>
            ))}
          </div>
        </div>

        <div className={styles.labelsLeft}>{LEFT_LABELS.map(label)}</div>
        <div className={styles.labelsRight}>{RIGHT_LABELS.map(label)}</div>

        <div key={active} className={styles.info}>
          <span className={styles.infoTitle}>{info.label}</span>
          <span className={styles.infoBlurb}>{info.blurb}</span>
          <span className={styles.infoSpecs}>{info.specs}</span>
        </div>

        <div className={styles.cam} style={{ opacity: camOk && showSelf ? 1 : 0 }}>
          <video ref={videoRef} className={styles.camVideo} muted playsInline />
          <canvas ref={camCanvasRef} width={320} height={180} className={styles.camVideo} />
        </div>

        <div className={styles.hint}>
          <span
            className={styles.statusDot}
            data-status={status}
            title={STATUS_TEXT[status]}
            style={status === "tracking" ? { background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` } : undefined}
          />
          {camOk ? "POINT / HOVER" : STATUS_TEXT[status]}
          {camOk && (
            <button
              type="button"
              className={styles.camToggle}
              aria-pressed={showSelf}
              onClick={() => setShowSelf((v) => !v)}
            >
              {showSelf ? "HIDE CAMERA VIEW" : "SHOW CAMERA VIEW"}
            </button>
          )}
        </div>
      </div>

      {/* Hand cursor lives outside the scaled stage so it maps 1:1 to the screen. */}
      <svg className={styles.trail} aria-hidden="true">
        <polyline ref={trailRef} fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
        <svg width="64" height="64" viewBox="-32 -32 64 64">
          <circle r="9" fill={ACCENT} />
          <circle r="22" fill="none" stroke={ACCENT} strokeWidth="3" className={styles.cursorRing} />
        </svg>
      </div>
    </div>
  );
}

const STATUS_TEXT = {
  loading: "STARTING CAMERA…",
  ready: "CAMERA READY",
  tracking: "HAND DETECTED",
  "no-camera": "NO CAMERA · TOUCH OR CLICK TO EXPLORE",
  error: "TRACKING UNAVAILABLE · TOUCH OR CLICK TO EXPLORE",
} as const;
