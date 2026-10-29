# Stride One — touch-free expo kiosk

A booth kiosk prototype that demos a product while staff are busy. A webcam tracks
the visitor's hand with [Google MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker);
pointing at a part of the exploded shoe opens a short explainer for that part.

## How it works

| Visitor does | Kiosk does |
| --- | --- |
| Nobody around, or nothing hovered | The whole shoe slowly rotates back and forth and floats, with an overview of the product |
| Raises a hand | A cursor follows the index fingertip |
| Moves over a part (or its label) | The shoe holds still and just that piece breaks away from the shoe (attached pieces ride along), glows, and the rest fade back; its info appears bottom-left |
| Moves to another part | The first piece slots back in and the new one breaks away |
| Moves off the shoe | The shoe is whole again and the panel shows the overview |

Hover is the whole interaction: no clicking, holding or pinching needed.

**Camera view:** the camera always tracks hands, but the video of the visitor is hidden by default so nobody has to
look at themselves. `SHOW CAMERA VIEW` in the bottom-right corner (or `c`) brings up a small preview with the tracked
hand drawn on it, which is handy for staff setting up.

**Camera on/off:** `TURN CAMERA OFF` (or `o`) releases the webcam entirely. Touch and mouse hover/click keep working the
same way, so it still runs on a touchscreen or with no camera. `TURN CAMERA ON` starts tracking again.

Staff keys: `←/→` cycle parts, `c` shows/hides the camera view, `o` turns the camera off/on, `f` toggles fullscreen.

## Code map

- `lib/product.ts` — product name and per-part copy. Swap this to demo another product.
- `lib/shoe.ts` — sliced 3D shoe geometry (ported from the "B · Centre stage" design reference).
- `lib/useHandTracking.ts` — webcam + MediaPipe loop; reports the fingertip each frame; can be switched off.
- `app/kiosk/Kiosk.tsx` — hover hit-testing, pull-apart animation, attract mode, camera view toggle, layout.
- Tuning constants (hover settle time, easing speed, idle timeout…) are at the top of `Kiosk.tsx`.

The hand model ships in `public/models/`, and `npm run dev` / `npm run build` copy the MediaPipe WASM runtime into
`public/mediapipe/`, so the kiosk works without internet once built (expo Wi-Fi is unreliable).
Camera access needs `localhost` or HTTPS.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000 and allow camera access.
