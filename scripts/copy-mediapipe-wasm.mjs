// Copies MediaPipe's WASM runtime into /public so the kiosk works offline
// (expo Wi-Fi is unreliable). Runs before `dev` and `build`.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const dest = join(root, "public/mediapipe/wasm");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied MediaPipe WASM to public/mediapipe/wasm");
