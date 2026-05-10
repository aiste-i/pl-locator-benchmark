<template>
  <p v-if="!profile" data-testid="comment-auth-message">
    <AppLink name="login" data-testid="comment-login-link">
      Sign in
    </AppLink> or <AppLink name="register" data-testid="comment-register-link">
      sign up
    </AppLink> to add comments on this article.
  </p>
  <form
    v-else
    class="card comment-form"
    @submit.prevent="submitComment"
    data-testid="comment-form"
  >
    <div class="card-block" data-testid="comment-block">
      <textarea
        class="form-control"
        aria-label="Write comment"
        v-model="comment"
        placeholder="Write a comment..."
        :rows="3"
        data-testid="comment-textarea"
      />
    </div>
    <div class="card-footer" data-testid="comment-footer">
      <img
        class="comment-author-img"
        :alt="profile.username"
        :src="profile.image"
        data-testid="comment-author-img"
      >
      <button
        type="submit"
        class="btn btn-sm btn-primary"
        aria-label="Submit"
        :disabled="comment === ''"
        data-testid="comment-submit-button"
      >
        Post Comment
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProfile } from 'src/composable/use-profile'
import { api } from 'src/services'
import type { Comment } from 'src/services/api'
import { useUserStore } from 'src/store/user'

interface Props {
  articleSlug: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'add-comment', comment: Comment): void
}>()

const { user } = storeToRefs(useUserStore())

const username = computed(() => user.value?.username ?? '')
const { profile } = useProfile({ username })

const comment = ref('')

async function submitComment() {
  const newComment = await api.articles
    .createArticleComment(props.articleSlug, { comment: { body: comment.value } })
    .then(res => res.data.comment)
  emit('add-comment', newComment)
  comment.value = ''
}
</script>
