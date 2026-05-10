<script>
	import { page } from '$app/state';
</script>

<nav class="navbar navbar-light" data-testid="navbar">
	<div class="container" data-testid="navbar-container">
		<a class="navbar-brand" href="/" data-testid="navbar-brand">conduit</a>
		<ul class="nav navbar-nav pull-xs-right" data-testid="nav-list">
			<li class="nav-item" data-testid="nav-item-home">
				<a class="nav-link" class:active={page.url.pathname === '/'} href="/" data-testid="nav-link-home">Home</a>
			</li>

			{#if page.data.user}
				<li class="nav-item" data-testid="nav-item-new-post">
					<a href="/editor" class="nav-link" class:active={page.url.pathname === '/editor'} data-testid="nav-link-new-post">
						<i class="ion-compose"></i>&nbsp;New Post
					</a>
				</li>

				<li class="nav-item" data-testid="nav-item-settings">
					<a href="/settings" class="nav-link" class:active={page.url.pathname === '/settings'} data-testid="nav-link-settings">
						<i class="ion-gear-a"></i>&nbsp;Settings
					</a>
				</li>

				<li class="nav-item" data-testid="nav-item-profile">
					<a href="/profile/@{page.data.user.username}" class="nav-link" data-testid="nav-link-profile">
						{page.data.user.username}
					</a>
				</li>
			{:else}
				<li class="nav-item" data-testid="nav-item-login">
					<a href="/login" class="nav-link" class:active={page.url.pathname === '/login'} data-testid="nav-link-login">
						Sign in
					</a>
				</li>

				<li class="nav-item" data-testid="nav-item-register">
					<a href="/register" class="nav-link" class:active={page.url.pathname === '/register'} data-testid="nav-link-register">
						Sign up
					</a>
				</li>
			{/if}
		</ul>
	</div>
</nav>
