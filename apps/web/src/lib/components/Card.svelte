<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		children,
		class: cls = '',
		...rest
	}: { children: Snippet } & Omit<HTMLAttributes<HTMLDivElement>, 'children'> = $props();
</script>

<div
	class="rounded-card border border-line bg-gradient-to-b from-raised/70 to-surface p-6 {cls}"
	{...rest}
>
	{@render children()}
</div>
