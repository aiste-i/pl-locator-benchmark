<script>
	import { enhance } from '$app/forms';
	import ListErrors from '$lib/ListErrors.svelte';

	const { form } = $props();
</script>

<svelte:head>
	<title>Sign up • Conduit</title>
</svelte:head>

<div class="auth-page" data-testid="auth-page">
	<div class="container page">
		<div class="row">
			<div class="col-md-6 offset-md-3 col-xs-12">
				<h1 class="text-xs-center" data-testid="auth-title">Sign up</h1>
				<p class="text-xs-center">
					<a href="/login" data-testid="auth-link">Have an account?</a>
				</p>

				<ListErrors errors={form?.errors} data-testid="auth-error-list" />

				<form use:enhance method="POST" data-testid="auth-form">
					<fieldset class="form-group" data-testid="auth-username-fieldset">
						<input
							class="form-control form-control-lg"
							name="username"
							type="text"
							required
							placeholder="Your Name"
							data-testid="auth-username-input"
						/>
					</fieldset>
					<fieldset class="form-group" data-testid="auth-email-fieldset">
						<input
							class="form-control form-control-lg"
							name="email"
							type="email"
							required
							placeholder="Email"
							data-testid="auth-email-input"
						/>
					</fieldset>
					<fieldset class="form-group" data-testid="auth-password-fieldset">
						<input
							class="form-control form-control-lg"
							name="password"
							type="password"
							required
							placeholder="Password"
							data-testid="auth-password-input"
						/>
					</fieldset>
					<button class="btn btn-lg btn-primary pull-xs-right" data-testid="auth-submit-button">Sign up</button>
				</form>
			</div>
		</div>
	</div>
</div>
