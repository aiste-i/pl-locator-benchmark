<template>
  <div data-testid="comment-card">
    <div class="card" :data-testid="`comment-card-${comment.id}`">
      <div class="card-block" data-testid="comment-block">
        <p class="card-text" data-testid="comment-text">
          {{ comment.body }}
        </p>
      </div>

      <div class="card-footer" data-testid="comment-footer">
        <AppLink
          class="comment-author"
          name="profile"
          :params="{ username: comment.author.username }"
          data-testid="comment-author-link"
        >
          <img
            class="comment-author-img"
            :alt="comment.author.username"
            :src="comment.author.image"
            data-testid="comment-author-img"
          >
        </AppLink>

        &nbsp;

        <AppLink
          class="comment-author"
          name="profile"
          :params="{ username: comment.author.username }"
          data-testid="comment-author-name"
        >
          {{ comment.author.username }}
        </AppLink>

        <span class="date-posted" data-testid="comment-date">{{ (new Date(comment.createdAt)).toLocaleDateString('en-US') }}</span>

        <span class="mod-options" data-testid="comment-mod-options">
          <i
            v-if="showRemove"
            class="ion-trash-a"
            role="button"
            aria-label="Delete comment"
            tabindex="0"
            @click="emit('remove-comment')"
            @keypress.enter="emit('remove-comment')"
            data-testid="comment-delete-button"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Comment } from 'src/services/api'

interface Props {
  comment: Comment
  username?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'remove-comment'): boolean
}>()

const showRemove = computed(() => props.username !== undefined && props.username === props.comment.author.username)
</script>
