<script>
	import ArticleMeta from './ArticleMeta.svelte';
	import CommentContainer from './CommentContainer.svelte';

	const { data } = $props();
</script>

<svelte:head>
	<title>{data.article.title}</title>
</svelte:head>

<div class="article-page" data-testid="article-page">
	<div class="banner" data-testid="article-banner">
		<div class="container">
			<h1 data-testid="article-title">{data.article.title}</h1>
			<ArticleMeta article={data.article} user={data.user} data-testid="article-meta-top" />
		</div>
	</div>

	<div class="container page">
		<div class="row article-content" data-testid="article-content">
			<div class="col-xs-12">
				<div data-testid="article-body">
					{@html data.article.body}
				</div>

				<ul class="tag-list" data-testid="article-tag-list">
					{#each data.article.tagList as tag}
						<li class="tag-default tag-pill tag-outline" data-testid="article-tag-item">{tag}</li>
					{/each}
				</ul>
			</div>
		</div>

		<hr />

		<div class="article-actions" data-testid="article-actions"></div>

		<div class="row" data-testid="comments-row">
			<CommentContainer comments={data.comments} user={data.user} errors={[]} />
		</div>
	</div>
</div>
