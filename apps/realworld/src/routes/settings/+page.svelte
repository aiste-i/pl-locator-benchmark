<script>
	import { enhance } from '$app/forms';
	import ListErrors from '$lib/ListErrors.svelte';

	const { data, form } = $props();
</script>

<svelte:head>
	<title>Settings • Conduit</title>
</svelte:head>

<div class="settings-page" data-testid="settings-page">
	<div class="container page">
		<div class="row">
			<div class="col-md-6 offset-md-3 col-xs-12">
				<h1 class="text-xs-center" data-testid="settings-title">Your Settings</h1>

				<ListErrors errors={form?.errors} data-testid="settings-error-list" />

				<form
					use:enhance={() => {
						return ({ update }) => {
							// don't clear the form when we update the profile
							update({ reset: false });
						};
					}}
					method="POST"
					action="?/save"
					data-testid="settings-form"
				>
					<fieldset data-testid="settings-fieldset">
						<fieldset class="form-group" data-testid="settings-image-fieldset">
							<input
								class="form-control"
								name="image"
								type="text"
								placeholder="URL of profile picture"
								value={data.user.image}
								data-testid="settings-image-input"
							/>
						</fieldset>

						<fieldset class="form-group" data-testid="settings-username-fieldset">
							<input
								class="form-control form-control-lg"
								name="username"
								type="text"
								placeholder="Username"
								value={data.user.username}
								data-testid="settings-username-input"
							/>
						</fieldset>

						<fieldset class="form-group" data-testid="settings-bio-fieldset">
							<textarea
								class="form-control form-control-lg"
								name="bio"
								rows="8"
								placeholder="Short bio about you"
								value={data.user.bio}
								data-testid="settings-bio-textarea"
							></textarea>
						</fieldset>

						<fieldset class="form-group" data-testid="settings-email-fieldset">
							<input
								class="form-control form-control-lg"
								name="email"
								type="email"
								placeholder="Email"
								value={data.user.email}
								data-testid="settings-email-input"
							/>
						</fieldset>

						<fieldset class="form-group" data-testid="settings-password-fieldset">
							<input
								class="form-control form-control-lg"
								name="password"
								type="password"
								placeholder="New Password"
								data-testid="settings-password-input"
							/>
						</fieldset>

						<button class="btn btn-lg btn-primary pull-xs-right" data-testid="settings-submit-button">Update Settings</button>
					</fieldset>
				</form>

				<hr />

				<form use:enhance method="POST" action="?/logout" data-testid="logout-form">
					<button class="btn btn-outline-danger" data-testid="settings-logout-button">Or click here to logout.</button>
				</form>
			</div>
		</div>
	</div>
</div>
