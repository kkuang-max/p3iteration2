"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildShoe } from "@/lib/shoe";
import { LEFT_LABELS, PARTS, PART_ORDER, PRODUCT, RIGHT_LABELS, type PartId } from "@/lib/product";
import { useHandTracking, type HandFrame } from "@/lib/useHandTracking";
import styles from "./kiosk.module.css";

const ACCENT = "#BFD8FF";
const STAGE_W = 1280;
const STAGE_H = 720;

// Interaction tuning.
const DWELL_MS = 850; // hold over a part this long to open it
const SWIPE_SPEED = 1.1; // screen-widths per second that counts as a swipe
const SWIPE_COOLDOWN_MS = 450;
const PINCH_ON = 0.28; // thumb–index distance / palm size
const PINCH_OFF = 0.42;
const IDLE_MS = 9000; // no one around → attract mode
const ATTRACT_STEP_MS = 3200;
const HAND_MARGIN = 0.12; // ignore the outer edge of the camera frame
const SMOOTHING = 0.45;
const TRAIL_LEN = 10;
const HOVER_GRACE_MS = 250; // keep hover through brief misses at part edges
const TELEPORT = 0.25; // a jump this far (screen widths) in one frame is a tracking glitch, not a swipe

type Mode = "attract" | "engaged";

const partAt = (x: number, y: number): PartId | null => {
  const el = document.elementFromPoint(x, y);
  const part = el?.closest("[data-part]")?.getAttribute("data-part");
  return (part as PartId) ?? null;
};

export default function Kiosk() {
  const [selected, setSelected] = useState<PartId>("outsole");
  const [hover, setHover] = useState<PartId | null>(null);
  const [mode, setMode] = useState<Mode>("attract");
  const [handVisible, setHandVisible] = useState(false);
  const [explode, setExplode] = useState(0.3);
  const [scale, setScale] = useState(1);
  const [showCam, setShowCam] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const camCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const dwellRef = useRef<SVGCircleElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);

  // Mutable interaction state that changes every frame and shouldn't re-render.
  const ix = useRef({
    x: 0,
    y: 0,
    t: 0,
    hasPos: false,
    hoverPart: null as PartId | null,
    hoverSince: 0,
    lastHit: 0,
    dwellDone: false,
    lastSwipe: 0,
    pinching: false,
    lastActive: 0,
    trail: [] as [number, number][],
  });

  const select = useCallback((part: PartId) => {
    ix.current.lastActive = performance.now();
    setMode("engaged");
    setSelected(part);
  }, []);

  const updateHover = useCallback((part: PartId | null, now: number) => {
    const s = ix.current;
    if (part !== s.hoverPart) {
      s.hoverPart = part;
      s.hoverSince = now;
      s.dwellDone = false;
      setHover(part);
    }
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
          updateHover(null, now);
          setHandVisible(false);
        }
        return;
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const span = 1 - HAND_MARGIN * 2;
      const tx = Math.min(Math.max((hand.x - HAND_MARGIN) / span, 0), 1) * vw;
      const ty = Math.min(Math.max((hand.y - HAND_MARGIN) / span, 0), 1) * vh;

      if (!s.hasPos) {
        s.x = tx;
        s.y = ty;
        s.t = now;
        s.hasPos = true;
        setHandVisible(true);
      }
      const px = s.x;
      const py = s.y;
      const dt = Math.max(now - s.t, 1) / 1000;
      s.x += (tx - s.x) * (1 - SMOOTHING);
      s.y += (ty - s.y) * (1 - SMOOTHING);
      s.t = now;
      s.lastActive = now;
      const jump = Math.hypot(tx - px, ty - py) / vw;
      const speed = jump > TELEPORT ? 0 : Math.hypot(s.x - px, s.y - py) / dt / vw;

      setMode("engaged");

      if (cursor) {
        cursor.style.opacity = "1";
        cursor.style.transform = `translate(${s.x}px, ${s.y}px)`;
      }
      s.trail.push([s.x, s.y]);
      if (s.trail.length > TRAIL_LEN) s.trail.shift();
      trailRef.current?.setAttribute("points", s.trail.map((p) => p.join(",")).join(" "));

      let part = partAt(s.x, s.y);
      if (part) s.lastHit = now;
      else if (now - s.lastHit < HOVER_GRACE_MS) part = s.hoverPart;
      updateHover(part, now);

      // Swiping across a part opens it straight away.
      if (part && speed > SWIPE_SPEED && now - s.lastSwipe > SWIPE_COOLDOWN_MS) {
        s.lastSwipe = now;
        s.dwellDone = true;
        select(part);
      }

      // Pinch (thumb to index) is a quick "click".
      if (!s.pinching && hand.pinch < PINCH_ON) {
        s.pinching = true;
        if (part) {
          s.dwellDone = true;
          select(part);
        }
      } else if (s.pinching && hand.pinch > PINCH_OFF) {
        s.pinching = false;
      }

      // Holding still over a part fills the dwell ring, then opens it.
      const progress = part && !s.dwellDone ? Math.min((now - s.hoverSince) / DWELL_MS, 1) : 0;
      dwellRef.current?.style.setProperty("stroke-dashoffset", String(1 - progress));
      if (part && !s.dwellDone && progress >= 1) {
        s.dwellDone = true;
        select(part);
      }
    },
    [select, updateHover],
  );

  const status = useHandTracking(videoRef, camCanvasRef, onHand, ACCENT);

  // ---- Mouse / touch fallback (staff testing, touchscreens) ---------------
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ix.current.hasPos) return; // a tracked hand takes priority
      ix.current.lastActive = performance.now();
      updateHover(partAt(e.clientX, e.clientY), performance.now());
    };
    const down = (e: PointerEvent) => {
      const part = partAt(e.clientX, e.clientY);
      if (part) select(part);
      else ix.current.lastActive = performance.now();
    };
    const key = (e: KeyboardEvent) => {
      const i = PART_ORDER.indexOf(selected);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") select(PART_ORDER[(i + 1) % PART_ORDER.length]);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") select(PART_ORDER[(i - 1 + PART_ORDER.length) % PART_ORDER.length]);
      if (e.key === "c") setShowCam((v) => !v);
      if (e.key === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [select, updateHover, selected]);

  // ---- Attract mode: nobody around → cycle parts to catch the eye ----------
  useEffect(() => {
    const id = setInterval(() => {
      if (!ix.current.hasPos && performance.now() - ix.current.lastActive > IDLE_MS) setMode("attract");
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode !== "attract") return;
    const id = setInterval(() => {
      setSelected((cur) => PART_ORDER[(PART_ORDER.indexOf(cur) + 1) % PART_ORDER.length]);
    }, ATTRACT_STEP_MS);
    return () => clearInterval(id);
  }, [mode]);

  // ---- Explode: assembled while idle, fully exploded once someone engages --
  useEffect(() => {
    const target = mode === "engaged" ? 1 : 0.3;
    let raf = 0;
    let cur = explode;
    const tick = () => {
      cur += (target - cur) * 0.08;
      if (Math.abs(target - cur) < 0.004) cur = target;
      setExplode(cur);
      if (cur !== target) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target changes
  }, [mode]);

  // ---- Fit the 1280×720 artboard to any screen -----------------------------
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const slices = useMemo(
    () => buildShoe({ w: 700, accent: ACCENT, explode, sel: selected, hover }),
    [explode, selected, hover],
  );

  const info = PARTS[selected];
  const engaged = mode === "engaged";
  const camOk = status !== "no-camera" && status !== "error";
  const headline = !engaged
    ? camOk
      ? "WAVE YOUR HAND TO EXPLORE"
      : "TAP TO EXPLORE"
    : !camOk
      ? "TAP A PART"
      : handVisible
        ? "POINT AT A PART"
        : "STEP IN AND RAISE A HAND";
  const subline = !engaged
    ? "Every part of this shoe has a story. Take a look inside."
    : camOk
      ? "Hold still to open it, or swipe straight across it."
      : "Tap any part of the shoe, or its name.";

  const label = (id: PartId) => {
    const on = id === selected;
    const hov = id === hover && !on;
    return (
      <span
        key={id}
        data-part={id}
        className={styles.label}
        style={{ color: on ? "#FFFFFF" : hov ? "#DCE6FF" : undefined, fontWeight: on ? 700 : 500 }}
      >
        <span
          className={styles.dot}
          style={{ background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, opacity: on ? 1 : hov ? 0.5 : 0 }}
        />
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
                    data-part={pt.hit ? pt.part : undefined}
                    d={pt.d}
                    transform={pt.tf}
                    fill={pt.fill}
                    stroke={pt.stroke}
                    strokeWidth={pt.sw}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={pt.op}
                    style={{ pointerEvents: pt.hit ? "visiblePainted" : "none" }}
                  />
                ))}
              </svg>
            ))}
          </div>
        </div>

        <div className={styles.labelsLeft}>{LEFT_LABELS.map(label)}</div>
        <div className={styles.labelsRight}>{RIGHT_LABELS.map(label)}</div>

        <div key={selected} className={styles.info}>
          <span className={styles.infoTitle}>{info.label}</span>
          <span className={styles.infoBlurb}>{info.blurb}</span>
          <span className={styles.infoSpecs}>{info.specs}</span>
        </div>

        <div className={styles.cam} style={{ opacity: showCam && camOk ? 1 : 0 }}>
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
          {camOk ? "SWIPE / POINT / WAVE" : STATUS_TEXT[status]}
        </div>
      </div>

      {/* Hand cursor lives outside the scaled stage so it maps 1:1 to the screen. */}
      <svg className={styles.trail} aria-hidden="true">
        <polyline ref={trailRef} fill="none" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">
        <svg width="64" height="64" viewBox="-32 -32 64 64">
          <circle r="9" fill={ACCENT} />
          <circle r="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
          <circle
            ref={dwellRef}
            r="22"
            fill="none"
            stroke={ACCENT}
            strokeWidth="3"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset="1"
            transform="rotate(-90)"
            strokeLinecap="round"
          />
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
