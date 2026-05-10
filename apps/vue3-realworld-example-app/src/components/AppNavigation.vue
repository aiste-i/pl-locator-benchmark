<template>
  <nav class="navbar navbar-light" data-testid="navbar">
    <div class="container" data-testid="navbar-container">
      <AppLink
        class="navbar-brand"
        name="global-feed"
        data-testid="navbar-brand"
      >
        conduit
      </AppLink>

      <ul class="nav navbar-nav pull-xs-right" data-testid="nav-list">
        <li
          v-for="link in navLinks"
          :key="link.name"
          class="nav-item"
          data-testid="nav-item"
        >
          <AppLink
            class="nav-link"
            :aria-label="link.title"
            :name="link.name"
            active-class="active"
            :params="link.params"
            :data-testid="link.testid"
          >
            <i
              v-if="link.icon"
              :class="link.icon"
              data-testid="nav-link-icon"
            />
            {{ link.title }}
          </AppLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RouteParams } from 'vue-router'
import { storeToRefs } from 'pinia'
import type { AppRouteNames } from 'src/router'
import { useUserStore } from 'src/store/user'

interface NavLink {
  name: AppRouteNames
  params?: Partial<RouteParams>
  title: string
  icon?: string
  display: 'all' | 'anonym' | 'authorized'
  testid: string
}

const { user } = storeToRefs(useUserStore())

const username = computed(() => user.value?.username)
const displayStatus = computed(() => username.value ? 'authorized' : 'anonym')

const allNavLinks = computed<NavLink[]>(() => [
  {
    name: 'global-feed',
    title: 'Home',
    display: 'all',
    testid: 'nav-link-home',
  },
  {
    name: 'login',
    title: 'Sign in',
    display: 'anonym',
    testid: 'nav-link-login',
  },
  {
    name: 'register',
    title: 'Sign up',
    display: 'anonym',
    testid: 'nav-link-register',
  },
  {
    name: 'create-article',
    title: 'New Post',
    display: 'authorized',
    icon: 'ion-compose',
    testid: 'nav-link-new-post',
  },
  {
    name: 'settings',
    title: 'Settings',
    display: 'authorized',
    icon: 'ion-gear-a',
    testid: 'nav-link-settings',
  },
  {
    name: 'profile',
    params: { username: username.value },
    title: username.value || '',
    display: 'authorized',
    testid: 'nav-link-profile',
  },
])

const navLinks = computed(() => allNavLinks.value.filter(
  l => l.display === displayStatus.value || l.display === 'all',
))
</script>
