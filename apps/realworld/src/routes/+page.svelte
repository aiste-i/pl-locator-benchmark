<script>
	import { page } from '$app/stores';
	import ArticleList from '$lib/ArticleList/index.svelte';
	import Pagination from './Pagination.svelte';

	const { data } = $props();

	const p = $derived(+($page.url.searchParams.get('page') ?? '1'));
	const tag = $derived($page.url.searchParams.get('tag'));
	const tab = $derived($page.url.searchParams.get('tab') ?? 'all');
	const page_link_base = $derived(tag ? `tag=${tag}` : `tab=${tab}`);
</script>

<svelte:head>
	<title>Conduit</title>
</svelte:head>

<div class="home-page" data-testid="home-page">
	{#if !data.user}
		<div class="banner" data-testid="home-banner">
			<div class="container">
				<h1 class="logo-font" data-testid="home-logo">conduit</h1>
				<p data-testid="home-tagline">A place to share your knowledge.</p>
			</div>
		</div>
	{/if}

	<div class="container page">
		<div class="row">
			<div class="col-md-9">
				<div class="feed-toggle" data-testid="feed-toggle">
					<ul class="nav nav-pills outline-active" data-testid="feed-toggle-list">
						<li class="nav-item" data-testid="feed-toggle-item-global">
							<a href="/?tab=all" class="nav-link" class:active={tab === 'all' && !tag} data-testid="nav-link-global-feed">
								Global Feed
							</a>
						</li>

						{#if data.user}
							<li class="nav-item" data-testid="feed-toggle-item-your">
								<a href="/?tab=feed" class="nav-link" class:active={tab === 'feed'} data-testid="nav-link-your-feed">Your Feed</a>
							</li>
						{:else}
							<li class="nav-item" data-testid="feed-toggle-item-login-to-see">
								<a href="/login" class="nav-link" data-testid="nav-link-login-to-see">Sign in to see your Feed</a>
							</li>
						{/if}

						{#if tag}
							<li class="nav-item" data-testid="feed-toggle-item-tag">
								<a href="/?tag={tag}" class="nav-link active" data-testid="nav-link-tag-feed">
									<i class="ion-pound"></i>
									{tag}
								</a>
							</li>
						{/if}
					</ul>
				</div>

				<div data-testid="article-list-container">
					<ArticleList articles={data.articles} />
				</div>
				<Pagination pages={data.pages} {p} href={(p) => `/?${page_link_base}&page=${p}`} />
			</div>

			<div class="col-md-3">
				<div class="sidebar" data-testid="home-sidebar">
					<p data-testid="home-sidebar-title">Popular Tags</p>
					<div class="tag-list" data-testid="home-tag-list">
						{#each data.tags as tag}
							<a href="/?tag={tag}" class="tag-default tag-pill" data-testid="home-tag-item">{tag}</a>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
