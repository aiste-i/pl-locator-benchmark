<template>
  <div class="settings-page" data-testid="settings-page">
    <div class="container page">
      <div class="row">
        <div class="col-md-6 offset-md-3 col-xs-12">
          <h1 class="text-xs-center" data-testid="settings-title">
            Your Settings
          </h1>

          <ul class="error-messages" data-testid="settings-error-list">
            <li v-for="(error, field) in errors" :key="field" data-testid="settings-error">
              {{ field }} {{ error ? error[0] : '' }}
            </li>
          </ul>

          <form @submit.prevent="onSubmit" data-testid="settings-form">
            <fieldset data-testid="settings-fieldset">
              <fieldset class="form-group" data-testid="settings-image-fieldset">
                <input
                  type="text"
                  class="form-control"
                  aria-label="Avatar picture url"
                  v-model="form.image"
                  placeholder="URL of profile picture"
                  data-testid="settings-image-input"
                >
              </fieldset>
              <fieldset class="form-group" data-testid="settings-username-fieldset">
                <input
                  type="text"
                  class="form-control form-control-lg"
                  aria-label="Username"
                  v-model="form.username"
                  placeholder="Your name"
                  data-testid="settings-username-input"
                >
              </fieldset>
              <fieldset class="form-group" data-testid="settings-bio-fieldset">
                <textarea
                  class="form-control form-control-lg"
                  aria-label="Bio"
                  v-model="form.bio"
                  placeholder="Short bio about you"
                  :rows="8"
                  data-testid="settings-bio-textarea"
                />
              </fieldset>
              <fieldset class="form-group" data-testid="settings-email-fieldset">
                <input
                  type="email"
                  class="form-control form-control-lg"
                  aria-label="Email"
                  v-model="form.email"
                  placeholder="Email"
                  data-testid="settings-email-input"
                >
              </fieldset>
              <fieldset class="form-group" data-testid="settings-password-fieldset">
                <input
                  type="password"
                  class="form-control form-control-lg"
                  aria-label="New password"
                  v-model="form.password"
                  placeholder="New password"
                  data-testid="settings-password-input"
                >
              </fieldset>
              <button
                type="submit"
                class="btn btn-lg btn-primary pull-xs-right"
                :disabled="isButtonDisabled"
                data-testid="settings-submit-button"
              >
                Update Settings
              </button>
            </fieldset>
          </form>

          <hr>

          <button
            class="btn btn-outline-danger"
            aria-label="Logout"
            @click="onLogout"
            data-testid="settings-logout-button"
          >
            Or click here to logout.
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { routerPush } from 'src/router'
import { api, isFetchError } from 'src/services'
import type { UpdateUser } from 'src/services/api'
import { useUserStore } from 'src/store/user'

const form: UpdateUser = reactive({})

const userStore = useUserStore()
const errors = ref()

async function onSubmit() {
  errors.value = {}

  try {
    // eslint-disable-next-line unicorn/no-array-reduce
    const filteredForm = Object.entries(form).reduce((form, [k, v]) => v === null ? form : Object.assign(form, { [k]: v }), {})
    const userData = await api.user.updateCurrentUser({ user: filteredForm }).then(res => res.data.user)
    userStore.updateUser(userData)
    await routerPush('profile', { username: userData.username })
  }
  catch (error) {
    if (isFetchError(error))
      errors.value = error.error?.errors
  }
}

async function onLogout() {
  userStore.updateUser(null)
  await routerPush('global-feed')
}

onMounted(async () => {
  if (!userStore.isAuthorized)
    return await routerPush('login')

  form.image = userStore.user?.image
  form.username = userStore.user?.username
  form.bio = userStore.user?.bio
  form.email = userStore.user?.email
})

const isButtonDisabled = computed(() =>
  form.image === userStore.user?.image
  && form.username === userStore.user?.username
  && form.bio === userStore.user?.bio
  && form.email === userStore.user?.email
  && !form.password,
)
</script>
