<template>
  <p data-testid="home-sidebar-title">Popular Tags</p>

  <div class="tag-list" data-testid="home-tag-list">
    <AppLink
      v-for="tag in tags"
      :key="tag"
      class="tag-pill tag-default"
      :aria-label="tag"
      name="tag"
      :params="{ tag }"
      data-testid="home-tag-item"
    >
      {{ tag }}
    </AppLink>
  </div>
</template>

<script setup lang="ts">
import { useTags } from 'src/composable/use-tags'

const { tags, fetchTags } = useTags()

await fetchTags()
</script>
