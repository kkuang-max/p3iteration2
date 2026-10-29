# Stride One — touch-free expo kiosk

A booth kiosk prototype that demos a product while staff are busy. A webcam tracks
the visitor's hand with [Google MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker);
pointing at a part of the exploded shoe opens a short explainer for that part.

## How it works

| Visitor does | Kiosk does |
| --- | --- |
| Nobody around (9 s) | **Attract mode**: shoe sits assembled and cycles through parts to catch the eye |
| Raises a hand | Shoe explodes apart; a cursor follows the index fingertip |
| Points at a part (or its label) | Part outlines in blue |
| Holds still ~0.85 s | Dwell ring fills, part lifts out, its info appears bottom-left |
| Swipes quickly across a part | Opens that part immediately |
| Pinches thumb + index | Opens the part under the cursor immediately |

No camera? Touch or click works the same way, so it still works on a touchscreen.

Staff keys: `←/→` cycle parts, `c` toggles the camera preview, `f` toggles fullscreen.

## Code map

- `lib/product.ts` — product name and per-part copy. Swap this to demo another product.
- `lib/shoe.ts` — sliced 3D shoe geometry (ported from the "B · Centre stage" design reference).
- `lib/useHandTracking.ts` — webcam + MediaPipe loop; reports the fingertip and pinch each frame.
- `app/kiosk/Kiosk.tsx` — hit-testing, dwell / swipe / pinch, attract mode, layout.
- Tuning constants (dwell time, swipe speed, idle timeout…) are at the top of `Kiosk.tsx`.

The hand model ships in `public/models/`, and `npm run dev` / `npm run build` copy the MediaPipe WASM runtime into
`public/mediapipe/`, so the kiosk works without internet once built (expo Wi-Fi is unreliable).
Camera access needs `localhost` or HTTPS.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000 and allow camera access.
