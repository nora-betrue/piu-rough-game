<script lang="ts">
	import type { Path } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '#lib/paraglide/runtime.js';
</script>

<a
	href={resolve(localizeHref('/') as Path)}
	class="group inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight"
>
	<svg viewBox="0 0 32 32" class="size-7" aria-hidden="true">
		<rect width="32" height="32" rx="9" fill="var(--pink)" />
		<path
			d="M16 7 25 16 16 25 7 16Z"
			fill="none"
			stroke="var(--accent-fg)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<circle cx="16" cy="16" r="2.5" fill="var(--accent-fg)" />
	</svg>
	<span>Rough <span class="text-accent">Game</span></span>
</a>
