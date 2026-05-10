<script>
	import { enhance } from '$app/forms';

	const { article, user, previewIndex = 1 } = $props();

	let favorited = $state(false);
	let favoritesCount = $state(0);

	$effect(() => {
		favorited = article.favorited;
		favoritesCount = article.favoritesCount;
	});
</script>

<div data-testid="article-preview">
	<div
		class="article-preview"
		role="article"
		aria-label={"Article preview: " + article.title}
		data-testid={"article-preview-" + previewIndex}
	>
		<div class="article-meta" data-testid="article-meta">
			<a href="/profile/@{article.author.username}" data-testid="article-author-link">
				<img src={article.author.image} alt={article.author.username} data-testid="article-author-img" />
			</a>

			<div class="info" data-testid="article-info">
				<a class="author" href="/profile/@{article.author.username}" data-testid="article-author-name">{article.author.username}</a>
				<span class="date" data-testid="article-date">{new Date(article.createdAt).toDateString()}</span>
			</div>

			{#if user}
				<form
					method="POST"
					action="/article/{article.slug}?/toggleFavorite"
					use:enhance={({ form }) => {
						// optimistic UI
						if (favorited) {
							favorited = false;
							favoritesCount -= 1;
						} else {
							favorited = true;
							favoritesCount += 1;
						}

						const button = form.querySelector('button');
						button.disabled = true;

						return ({ result, update }) => {
							button.disabled = false;
							if (result.type === 'error') {
								favorited = article.favorited;
								favoritesCount = article.favoritesCount;
								update();
							} else {
								article.favorited = favorited;
								article.favoritesCount = favoritesCount;
							}
						};
					}}
					class="pull-xs-right"
					data-testid="article-favorite-form"
				>
					<input hidden type="checkbox" name="favorited" checked={favorited} />
					<button
						class="btn btn-sm {favorited ? 'btn-primary' : 'btn-outline-primary'}"
						aria-label={favorited ? 'Unfavorite article' : 'Favorite article'}
						data-testid={favorited ? 'article-unfavorite-btn' : 'article-favorite-btn'}
					>
						<i class="ion-heart"></i>
						{favoritesCount}
					</button>
				</form>
			{/if}
		</div>

		<a
			href="/article/{article.slug}"
			class="preview-link"
			aria-label={"Read more about " + article.title}
			data-testid="article-link"
		>
			<h1 data-testid="article-title">{article.title}</h1>
			<p role="note" aria-label="Article preview description" data-testid="article-description">{article.description}</p>
			<span data-testid={"article-read-more-" + previewIndex}>Read more...</span>
			<ul class="tag-list" data-testid="article-tag-list">
				{#each article.tagList as tag}
					<li class="tag-default tag-pill tag-outline" data-testid="article-tag-item">{tag}</li>
				{/each}
			</ul>
		</a>
	</div>
</div>
