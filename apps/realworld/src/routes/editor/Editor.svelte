<script>
	import { scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { enhance } from '$app/forms';
	import ListErrors from '$lib/ListErrors.svelte';

	const { article, errors } = $props();

	let tagList = $state(article.tagList);
</script>

<div class="editor-page" data-testid="editor-page">
	<div class="container page">
		<div class="row">
			<div class="col-md-10 offset-md-1 col-xs-12">
				<ListErrors {errors} data-testid="editor-error-list" />

				<form use:enhance method="POST" data-testid="editor-form">
					<fieldset class="form-group" data-testid="editor-title-fieldset">
						<input
							name="title"
							class="form-control form-control-lg"
							placeholder="Article Title"
							value={article.title}
							data-testid="editor-title-input"
						/>
					</fieldset>

					<fieldset class="form-group" data-testid="editor-description-fieldset">
						<input
							name="description"
							class="form-control"
							placeholder="What's this article about?"
							value={article.description}
							data-testid="editor-description-input"
						/>
					</fieldset>

					<fieldset class="form-group" data-testid="editor-body-fieldset">
						<textarea
							name="body"
							class="form-control"
							rows="8"
							placeholder="Write your article (in markdown)"
							value={article.body}
							data-testid="editor-body-textarea"
						></textarea>
					</fieldset>

					<fieldset class="form-group" data-testid="editor-tags-fieldset">
						<input
							class="form-control"
							placeholder="Enter tags"
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									if (!tagList.includes(event.target.value)) {
										tagList.push(event.target.value);
									}

									event.target.value = '';
								}
							}}
							data-testid="editor-tag-input"
						/>
					</fieldset>

					<div class="tag-list" data-testid="editor-tag-list">
						{#each tagList as tag, i (tag)}
							<button
								transition:scale|local={{ duration: 200 }}
								animate:flip={{ duration: 200 }}
								class="tag-default tag-pill"
								type="button"
								onclick={() => {
									tagList.splice(i, 1);
								}}
								aria-label="Remove {tag} tag"
								data-testid="editor-tag-item"
							>
								<i class="ion-close-round" data-testid="editor-tag-remove"></i>
								{tag}
							</button>
						{/each}
					</div>

					{#each tagList as tag}
						<input hidden name="tag" value={tag} />
					{/each}

					<button class="btn btn-lg pull-xs-right btn-primary" data-testid="editor-submit-button">Publish Article</button>
				</form>
			</div>
		</div>
	</div>
</div>

<style>
	.tag-pill {
		border: none;
	}
</style>
