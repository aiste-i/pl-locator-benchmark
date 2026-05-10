import type { ComputedRef } from 'vue'
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api, isFetchError } from 'src/services'
import type { Profile, User } from 'src/services/api'
import { useUserStore } from 'src/store/user'

interface UseProfileProps {
  username: ComputedRef<string>
}

export function useProfile({ username }: UseProfileProps) {
  const { user } = storeToRefs(useUserStore())
  const profile = ref<Profile | null>(null)

  function getCurrentUserProfile(): Profile | null {
    const currentUser = user.value
    if (!currentUser || currentUser.username !== username.value)
      return null

    return userToProfile(currentUser)
  }

  async function fetchProfile(): Promise<void> {
    const currentUserProfile = getCurrentUserProfile()
    updateProfile(currentUserProfile)
    if (!username.value)
      return

    try {
      const profileData = await api.profiles.getProfileByUsername(username.value).then(res => res.data.profile)
      updateProfile(profileData)
    }
    catch (error) {
      if (currentUserProfile && isFetchError(error) && error.status === 404) {
        updateProfile(currentUserProfile)
        return
      }

      updateProfile(null)
    }
  }

  function updateProfile(profileData: Profile | null): void {
    profile.value = profileData
  }

  watch(username, fetchProfile, { immediate: true })

  return {
    profile,
    updateProfile,
  }
}

function userToProfile(user: User): Profile {
  return {
    username: user.username,
    bio: user.bio ?? '',
    image: user.image ?? '',
    following: false,
  }
}
