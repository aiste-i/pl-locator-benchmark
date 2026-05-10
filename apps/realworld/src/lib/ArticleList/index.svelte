<script>
	import { page } from '$app/state';
	import ArticlePreview from './ArticlePreview.svelte';

	const { articles } = $props();
</script>

{#if articles.length === 0}
	<div class="article-preview" data-testid="article-list-empty">No articles are here... yet.</div>
{:else}
	<div class="article-list" data-testid="article-list">
		{#each articles as article, index (article.slug)}
			<ArticlePreview {article} user={page.data.user} previewIndex={index + 1} data-testid="article-preview" />
		{/each}
	</div>
{/if}
