<template>
  <div class="auth-page" data-testid="auth-page">
    <div class="container page">
      <div class="row">
        <div class="col-md-6 offset-md-3 col-xs-12">
          <h1 class="text-xs-center" data-testid="auth-title">
            Sign up
          </h1>
          <p class="text-xs-center">
            <AppLink name="login" data-testid="auth-link">
              Have an account?
            </AppLink>
          </p>
          <ul class="error-messages" data-testid="auth-error-list">
            <li
              v-for="(error, field) in errors"
              :key="field"
              data-testid="auth-error"
            >
              {{ field }} {{ error ? error[0] : '' }}
            </li>
          </ul>
          <form
            ref="formRef"
            aria-label="Registration form"
            @submit.prevent="register"
            data-testid="auth-form"
          >
            <fieldset class="form-group" data-testid="auth-username-fieldset">
              <input
                type="text"
                class="form-control form-control-lg"
                aria-label="Username"
                v-model="form.username"
                required
                placeholder="Your Name"
                data-testid="auth-username-input"
              >
            </fieldset>
            <fieldset class="form-group" data-testid="auth-email-fieldset">
              <input
                type="email"
                class="form-control form-control-lg"
                aria-label="Email"
                v-model="form.email"
                required
                placeholder="Email"
                data-testid="auth-email-input"
              >
            </fieldset>
            <fieldset class="form-group" data-testid="auth-password-fieldset">
              <input
                type="password"
                class="form-control form-control-lg"
                aria-label="Password"
                v-model="form.password"
                required
                :minLength="8"
                placeholder="Password"
                data-testid="auth-password-input"
              >
            </fieldset>
            <button
              type="submit"
              class="btn btn-lg btn-primary pull-xs-right"
              :disabled="!(form.email && form.username && form.password)"
              data-testid="auth-submit-button"
            >
              Sign up
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { routerPush } from 'src/router'
import { api, isFetchError } from 'src/services'
import type { NewUser } from 'src/services/api'
import { useUserStore } from 'src/store/user'

const formRef = ref<HTMLFormElement | null>(null)
const form: NewUser = reactive({
  username: '',
  email: '',
  password: '',
})

const { updateUser } = useUserStore()

const errors = ref()

async function register() {
  errors.value = {}

  if (!formRef.value?.checkValidity())
    return

  try {
    const result = await api.users.createUser({ user: form })
    updateUser(result.data.user)
    await routerPush('global-feed')
  }
  catch (error) {
    if (isFetchError(error))
      errors.value = error.error?.errors
  }
}
</script>
