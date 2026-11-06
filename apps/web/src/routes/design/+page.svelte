<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import PlateBadge, { PLATES } from '#lib/components/PlateBadge.svelte';

	// Internal style guide: a living reference for tokens and components. Not translated on purpose.
	const swatches = [
		['bg', 'bg-bg'],
		['surface', 'bg-surface'],
		['raised', 'bg-raised'],
		['line', 'bg-line'],
		['fg', 'bg-fg'],
		['muted', 'bg-muted'],
		['green', 'bg-green'],
		['cyan', 'bg-cyan'],
		['yellow', 'bg-yellow'],
		['lime', 'bg-lime'],
		['pink', 'bg-pink']
	];
</script>

<svelte:head>
	<title>Style guide · Rough Game</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="space-y-12 py-8">
	<header>
		<h1 class="font-display text-4xl font-extrabold tracking-tight">Style guide</h1>
		<p class="mt-2 text-muted">
			Tokens live in <code class="font-mono text-cyan">routes/layout.css</code>.
		</p>
	</header>

	<section class="space-y-4">
		<h2 class="text-xl font-bold">Colour</h2>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
			{#each swatches as [name, cls] (name)}
				<div>
					<div class="h-16 rounded-xl border border-line {cls}"></div>
					<p class="mt-1 font-mono text-xs text-muted">{name}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-bold">Plates</h2>
		<div class="flex flex-wrap gap-2">
			{#each PLATES as plate (plate)}
				<PlateBadge {plate} />
			{/each}
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-bold">Type</h2>
		<p class="font-display text-5xl font-extrabold tracking-tight">Display 5xl extrabold</p>
		<p class="font-display text-3xl font-extrabold tracking-tight">Heading 3xl</p>
		<p class="text-lg">Body large: Quick brown fox 안녕하세요 ¡Hola!</p>
		<p class="text-muted">Muted body for secondary text.</p>
		<p class="font-mono text-sm">Mono 1,234,567 · SSS+ · 27</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-bold">Buttons</h2>
		<div class="flex flex-wrap items-center gap-3">
			<Button>Primary</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="ghost">Ghost</Button>
			<Button disabled>Disabled</Button>
			<Button size="lg" href="/">Large link</Button>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-bold">Card</h2>
		<Card class="max-w-sm">
			<h3 class="text-lg font-bold">Card title</h3>
			<p class="mt-1 text-sm text-muted">Surface, 1px line border, 1.5rem radius.</p>
		</Card>
	</section>
</div>
