declare module '*.wasm' {
	const m: WebAssembly.Module;
	export default m;
}
declare module '*.otf' {
	const b: ArrayBuffer;
	export default b;
}
