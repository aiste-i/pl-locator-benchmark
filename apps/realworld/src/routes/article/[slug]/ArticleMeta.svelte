<script>
	import { enhance } from '$app/forms';

	const { article, user } = $props();

	let favorited = $state(false);
	let favoritesCount = $state(0);

	$effect(() => {
		favorited = article.favorited;
		favoritesCount = article.favoritesCount;
	});
</script>

<div class="article-meta" data-testid="article-meta">
	<a href="/profile/@{article.author.username}" data-testid="article-author-link">
		<img src={article.author.image} alt={article.author.username} data-testid="article-author-img" />
	</a>

	<div class="info" data-testid="article-info">
		<a href="/profile/@{article.author.username}" class="author" data-testid="article-author-name">{article.author.username}</a>
		<span class="date" data-testid="article-date">
			{new Date(article.createdAt).toDateString()}
		</span>
	</div>

	{#if article.author.username === user?.username}
		<span data-testid="article-actions-owner">
			<a href="/editor/{article.slug}" class="btn btn-outline-secondary btn-sm" data-testid="article-edit-btn">
				<i class="ion-edit"></i> Edit Article
			</a>

			<form use:enhance method="POST" action="?/deleteArticle" data-testid="article-delete-form">
				<button class="btn btn-outline-danger btn-sm" data-testid="article-delete-btn">
					<i class="ion-trash-a"></i> Delete Article
				</button>
			</form>
		</span>
	{:else if user}
		<form
			method="POST"
			action="/article/{article.slug}?/toggleFavorite"
			use:enhance={({ form }) => {
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
			data-testid="article-favorite-form"
		>
			<input hidden type="checkbox" name="favorited" checked={favorited} />
			<button
				class="btn btn-sm {favorited ? 'btn-primary' : 'btn-outline-primary'}"
				aria-label={favorited ? 'Unfavorite article' : 'Favorite article'}
				data-testid={favorited ? 'article-unfavorite-btn' : 'article-favorite-btn'}
			>
				<i class="ion-heart"></i>
				{favorited ? 'Unfavorite' : 'Favorite'} Article
				<span class="counter">({favoritesCount})</span>
			</button>
		</form>
	{/if}
</div>
