// Makes satori 0.63's harfbuzzjs load in workerd. Its Emscripten loader (1) reads self.location.href,
// which workerd lacks, and (2) compiles the inlined wasm from bytes, which workerd forbids. Give it a
// location, and hand byte-based instantiate calls the precompiled module (scripts/extract-hb.mjs).
// Import this before satori is initialised.
import hb from './hb.wasm';

(globalThis as any).location ??= { href: 'https://localhost/' };

const instantiate = WebAssembly.instantiate.bind(WebAssembly);
(WebAssembly as any).instantiate = (src: any, imports?: WebAssembly.Imports) =>
	src instanceof WebAssembly.Module
		? instantiate(src, imports)
		: instantiate(hb, imports).then((instance) => ({ instance, module: hb }));
