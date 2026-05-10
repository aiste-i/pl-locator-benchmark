<script>
	const { pages, p, href } = $props();

	const range = $derived.by(() => {
		const result = [];
		for (let i = 1; i <= pages; i++) {
			result.push(i);
		}
		return result;
	});
</script>

{#if pages > 1}
	<nav data-testid="pagination-nav">
		<ul class="pagination" data-testid="pagination-list">
			{#each range as n}
				<li class="page-item" class:active={n == p} aria-label={"Page " + n} data-testid={"pagination-item-" + n}>
					<a class="page-link" href={href(n)} aria-label={"Go to page " + n} data-testid={"pagination-link-" + n}>{n}</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
