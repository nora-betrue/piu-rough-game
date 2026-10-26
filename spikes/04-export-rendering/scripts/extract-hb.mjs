// satori ≥ the harfbuzz release inlines hb.wasm as base64 and compiles it at runtime, which workerd
// forbids. Extract it so the Worker can import it as a precompiled module (see src/hb-shim.ts).
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../node_modules/satori/dist/standalone.js', import.meta.url), 'utf8');
const b64 = src.match(/"(AGFzbQ[A-Za-z0-9+/=]+)"/)[1];
writeFileSync(new URL('../src/hb.wasm', import.meta.url), Buffer.from(b64, 'base64'));
console.log('hb.wasm', Buffer.from(b64, 'base64').length, 'bytes');
