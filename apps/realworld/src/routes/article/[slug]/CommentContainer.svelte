<script>
	import CommentInput from './CommentInput.svelte';
	import Comment from './Comment.svelte';

	const { comments, user } = $props();
</script>

<div class="col-xs-12 col-md-8 offset-md-2" data-testid="comment-container">
	{#if user}
		<div data-testid="comment-form-wrapper">
			<CommentInput {user} />
		</div>
	{:else}
		<p data-testid="comment-auth-message">
			<a href="/login" data-testid="comment-login-link">Sign in</a>
			or
			<a href="/register" data-testid="comment-register-link">sign up</a>
			to add comments on this article.
		</p>
	{/if}

	<div class="comment-list" data-testid="comment-list">
		{#each comments as comment (comment.id)}
			<Comment {comment} {user} />
		{/each}
	</div>
</div>
