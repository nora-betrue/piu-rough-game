<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import Logo from '#lib/components/Logo.svelte';
	import LocaleSwitcher from '#lib/components/LocaleSwitcher.svelte';
	import * as m from '#lib/paraglide/messages.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.meta_title()}</title>
	<meta name="description" content={m.meta_description()} />
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
	<header class="flex flex-wrap items-center justify-between gap-3 py-5">
		<Logo />
		<LocaleSwitcher />
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer
		class="mt-24 flex flex-wrap items-center justify-between gap-2 border-t border-line py-8 text-sm text-muted"
	>
		<p>{m.footer_tagline()}</p>
		<p>{m.footer_unofficial()}</p>
	</footer>
</div>
