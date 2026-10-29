# Stride One — touch-free expo kiosk

A booth kiosk prototype that demos a product while staff are busy. A webcam tracks
the visitor's hand with [Google MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker);
pointing at a part of the exploded shoe opens a short explainer for that part.

## How it works

| Visitor does | Kiosk does |
| --- | --- |
| Nobody around (9 s) | **Attract mode**: shoe sits assembled and cycles through parts to catch the eye |
| Raises a hand | Shoe explodes apart; a cursor follows the index fingertip |
| Moves over a part (or its label) | That part smoothly pulls further out of the shoe, glows, and the rest fade back; its info appears bottom-left |
| Moves to another part | The first part eases back in and the new one slides out |

Hover is the whole interaction: no clicking, holding or pinching needed.

**Camera on/off:** use the `CAMERA ON` button in the bottom-right corner (or press `c`). Turning it off releases the
webcam completely; touch, mouse hover and click keep working, so it still runs on a touchscreen or with no camera.

Staff keys: `←/→` cycle parts, `c` toggles the camera, `f` toggles fullscreen.

## Code map

- `lib/product.ts` — product name and per-part copy. Swap this to demo another product.
- `lib/shoe.ts` — sliced 3D shoe geometry (ported from the "B · Centre stage" design reference).
- `lib/useHandTracking.ts` — webcam + MediaPipe loop; reports the fingertip each frame; can be switched off.
- `app/kiosk/Kiosk.tsx` — hover hit-testing, pull-apart animation, attract mode, camera toggle, layout.
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
