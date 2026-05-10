<script>
	import { enhance } from '$app/forms';
	import { placeholder } from '$lib/constants.js';

	const { user } = $props();
</script>

<form use:enhance method="POST" action="?/createComment" class="card comment-form" data-testid="comment-form">
	<div class="card-block" data-testid="comment-block">
		<textarea class="form-control" name="comment" placeholder="Write a comment..." rows="3" data-testid="comment-textarea"
		></textarea>
	</div>

	<div class="card-footer" data-testid="comment-footer">
		<img src={user.image || placeholder} class="comment-author-img" alt={user.username} data-testid="comment-author-img" />
		<button class="btn btn-sm btn-primary" type="submit" data-testid="comment-submit-button">Post Comment</button>
	</div>
</form>
