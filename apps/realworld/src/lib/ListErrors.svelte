<script>
	const { errors } = $props();
</script>

{#if errors}
	<ul class="error-messages" data-testid="error-list">
		{#each Object.keys(errors) as key}
			<li data-testid="error-item">{key} {errors[key]}</li>
		{/each}
	</ul>
{/if}
