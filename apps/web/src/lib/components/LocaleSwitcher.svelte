<script lang="ts">
	import type { Path } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getLocale, locales, localizeHref } from '#lib/paraglide/runtime.js';
	import * as m from '#lib/paraglide/messages.js';

	// Endonyms: each language is always shown in itself.
	const names: Record<string, string> = { en: 'English', es: 'Español', ko: '한국어' };
</script>

<nav
	aria-label={m.nav_language()}
	class="flex gap-1 rounded-full border border-line bg-surface p-1 text-xs font-semibold"
>
	{#each locales as locale (locale)}
		<a
			href={resolve(localizeHref(page.url.pathname, { locale }) as Path)}
			hreflang={locale}
			data-sveltekit-reload
			aria-current={locale === getLocale() ? 'true' : undefined}
			class="rounded-full px-3 py-1 transition not-aria-[current=true]:text-muted not-aria-[current=true]:hover:text-fg aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg"
		>
			{names[locale] ?? locale}
		</a>
	{/each}
</nav>
