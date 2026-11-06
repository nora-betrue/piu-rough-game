<script lang="ts" module>
	// Fallback CSS badge for the eight plates, weakest to strongest (docs/DOMAIN.md).
	// Plate names are intentionally not translated.
	export const PLATES = ['rg', 'fg', 'tg', 'mg', 'sg', 'eg', 'ug', 'pg'] as const;
	export type Plate = (typeof PLATES)[number];
</script>

<script lang="ts">
	let { plate }: { plate: Plate } = $props();
</script>

<span
	class="inline-flex min-w-10 items-center justify-center rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider uppercase"
	style="color: var(--plate-{plate}); border-color: color-mix(in oklab, var(--plate-{plate}) 55%, transparent); background: color-mix(in oklab, var(--plate-{plate}) 14%, transparent);"
>
	{plate}
</span>
