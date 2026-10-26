<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Path } from '$app/types';
	import { resolve } from '$app/paths';
	import { localizeHref } from '#lib/paraglide/runtime.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'ghost';
	type Size = 'md' | 'lg';

	type Props = {
		variant?: Variant;
		size?: Size;
		href?: string;
		children: Snippet;
	} & Omit<HTMLButtonAttributes, 'children'> &
		Omit<HTMLAnchorAttributes, 'children'>;

	let {
		variant = 'primary',
		size = 'md',
		href,
		children,
		class: cls = '',
		...rest
	}: Props = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-gradient-to-b from-green to-lime text-accent-fg shadow-glow hover:brightness-110',
		secondary: 'border border-line bg-raised text-fg hover:border-green',
		ghost: 'text-muted hover:bg-raised hover:text-fg'
	};
	const sizes: Record<Size, string> = {
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base'
	};
	const classes = $derived(
		`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${cls}`
	);
</script>

{#if href?.startsWith('#')}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- in-page anchor -->
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
{:else if href}
	<a href={resolve(localizeHref(href) as Path)} class={classes} {...rest as HTMLAnchorAttributes}>
		{@render children()}
	</a>
{:else}
	<button class={classes} {...rest as HTMLButtonAttributes}>{@render children()}</button>
{/if}
