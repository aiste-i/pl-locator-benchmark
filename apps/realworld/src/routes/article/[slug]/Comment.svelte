<script>
	import { enhance } from '$app/forms';

	const { comment, user } = $props();
</script>

<div data-testid="comment-card">
	<div class="card" data-testid={"comment-card-" + comment.id}>
		<div class="card-block" data-testid="comment-block">
			<p class="card-text" data-testid="comment-text">{comment.body}</p>
		</div>

		<div class="card-footer" data-testid="comment-footer">
			<a href="/profile/@{comment.author.username}" class="comment-author" data-testid="comment-author-link">
				<img src={comment.author.image} class="comment-author-img" alt={comment.author.username} data-testid="comment-author-img" />
			</a>

			<a href="/profile/@{comment.author.username}" class="comment-author" data-testid="comment-author-name">
				{comment.author.username}
			</a>

			<span class="date-posted" data-testid="comment-date">{new Date(comment.createdAt).toDateString()}</span>

			{#if user && comment.author.username === user.username}
				<form use:enhance method="POST" action="?/deleteComment&id={comment.id}" class="mod-options" data-testid="comment-delete-form">
					<button class="ion-trash-a" aria-label="Delete comment" data-testid="comment-delete-button"></button>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	button {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font-size: inherit;
		margin-left: 5px;
		opacity: 0.6;
		cursor: pointer;
	}
</style>
