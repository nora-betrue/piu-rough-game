<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Card from '#lib/components/Card.svelte';
	import PlateBadge, { PLATES, type Plate } from '#lib/components/PlateBadge.svelte';
	import * as m from '#lib/paraglide/messages.js';

	// Placeholder chart tiles for the hero mock. Gradients stand in for jackets (we never ship official art).
	const tiles: { hue: number; level: number; grade: string; plate: Plate }[] = Array.from(
		{ length: 20 },
		(_, i) => ({
			hue: (i * 47 + 300) % 360,
			level: 20 + ((i * 7) % 8),
			grade: ['SSS', 'SS+', 'SS', 'S+', 'S'][i % 5],
			plate: PLATES[(i * 3 + 2) % PLATES.length]
		})
	);

	const features = [
		{ icon: '⇪', title: m.feature_import_title, body: m.feature_import_body },
		{ icon: '▦', title: m.feature_top50_title, body: m.feature_top50_body },
		{ icon: '★', title: m.feature_profile_title, body: m.feature_profile_body },
		{ icon: '⚡', title: m.feature_fast_title, body: m.feature_fast_body },
		{ icon: '⌕', title: m.feature_filter_title, body: m.feature_filter_body },
		{ icon: '◔', title: m.feature_stats_title, body: m.feature_stats_body }
	];
</script>

<section class="grid items-center gap-12 py-12 lg:grid-cols-2 lg:py-20">
	<div>
		<p
			class="mb-4 inline-block rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs font-semibold tracking-wider text-green uppercase"
		>
			{m.hero_eyebrow()}
		</p>
		<h1
			class="font-display text-5xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl"
		>
			{m.hero_title_a()}
			<span class="bg-gradient-to-r from-green to-lime bg-clip-text text-transparent"
				>{m.hero_title_b()}</span
			>
		</h1>
		<p class="mt-6 max-w-lg text-lg text-pretty text-muted">{m.hero_subtitle()}</p>
		<div class="mt-8 flex flex-wrap items-center gap-3">
			<Button size="lg" disabled>{m.cta_signin()}</Button>
			<Button size="lg" variant="secondary" href="#features">{m.cta_how()}</Button>
		</div>
		<p class="mt-3 text-sm text-muted">{m.cta_soon()}</p>
	</div>

	<div class="relative" aria-hidden="true">
		<div class="absolute -inset-4 -z-10 rounded-3xl bg-green/10 blur-3xl"></div>
		<div
			class="rounded-card border border-line bg-gradient-to-b from-raised/70 to-surface p-4 shadow-glow"
		>
			<div class="mb-3 flex items-center justify-between text-xs">
				<span class="font-semibold">{m.mock_title()}</span>
				<span class="font-mono text-muted">{m.mock_sample()}</span>
			</div>
			<div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
				{#each tiles as t, i (i)}
					<div
						class="relative aspect-square overflow-hidden rounded-lg"
						style="background: linear-gradient(135deg, hsl({t.hue} 80% 55%), hsl({(t.hue + 60) %
							360} 70% 25%));"
					>
						<span
							class="absolute top-1 left-1 rounded bg-black/55 px-1 font-mono text-[10px] font-bold text-white"
						>
							{t.level}
						</span>
						<span class="absolute right-1 bottom-1 left-1 flex items-end justify-between">
							<span class="rounded bg-black/55 px-1 font-mono text-[10px] font-bold text-white"
								>{t.grade}</span
							>
							<span
								class="size-2.5 rounded-full ring-2 ring-black/40"
								style="background: var(--plate-{t.plate});"
							></span>
						</span>
					</div>
				{/each}
			</div>
			<div class="mt-3 flex items-center gap-3 font-mono text-[10px] text-muted">
				<span>{m.mock_low()}</span>
				<span class="h-1.5 flex-1 rounded-full" style="background: var(--heat);"></span>
				<span>{m.mock_high()}</span>
			</div>
		</div>
	</div>
</section>

<section class="py-12" aria-labelledby="plates-heading">
	<h2 id="plates-heading" class="sr-only">{m.plates_heading()}</h2>
	<div
		class="flex flex-wrap items-center justify-center gap-2 rounded-card border border-line bg-surface px-4 py-3"
	>
		{#each PLATES as plate (plate)}
			<PlateBadge {plate} />
		{/each}
		<span class="ml-2 text-sm text-muted">{m.plates_caption()}</span>
	</div>
</section>

<section id="features" class="scroll-mt-8 py-12">
	<h2 class="font-display text-3xl font-extrabold tracking-tight">{m.features_heading()}</h2>
	<p class="mt-2 max-w-xl text-muted">{m.features_subheading()}</p>
	<ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each features as f (f.icon)}
			<li>
				<Card class="h-full transition hover:-translate-y-0.5 hover:border-accent">
					<span
						class="grid size-10 place-items-center rounded-xl bg-raised text-xl text-accent"
						aria-hidden="true">{f.icon}</span
					>
					<h3 class="mt-4 text-lg font-bold">{f.title()}</h3>
					<p class="mt-1 text-sm text-muted">{f.body()}</p>
				</Card>
			</li>
		{/each}
	</ul>
</section>

<section class="py-12">
	<Card
		class="flex flex-col items-start justify-between gap-6 bg-gradient-to-br from-surface to-raised sm:flex-row sm:items-center"
	>
		<div>
			<h2 class="font-display text-2xl font-extrabold">{m.promise_title()}</h2>
			<p class="mt-1 max-w-xl text-muted">{m.promise_body()}</p>
		</div>
	</Card>
</section>
