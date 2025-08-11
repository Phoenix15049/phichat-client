<template>
  <div class="max-w-xl mx-auto p-6 space-y-4">
    <h1 class="text-xl font-semibold">تنظیمات پروفایل</h1>

    <div class="space-y-2">
      <label class="block text-sm">Display name</label>
      <input v-model="displayName" class="w-full border rounded px-3 py-2" />
    </div>

    <div class="space-y-2">
      <label class="block text-sm">Avatar URL</label>
      <input v-model="avatarUrl" class="w-full border rounded px-3 py-2" />
    </div>

    <div class="space-y-2">
      <label class="block text-sm">Bio</label>
      <textarea v-model="bio" class="w-full border rounded px-3 py-2"></textarea>
    </div>

    <div class="flex gap-2">
      <button @click="save" class="bg-blue-600 text-white px-4 py-2 rounded">Save</button>
      <span v-if="saved" class="text-green-600 text-sm">Saved ✔</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMeProfile, updateMyProfile } from '../services/api'

const displayName = ref<string | undefined>()
const avatarUrl = ref<string | undefined>()
const bio = ref<string | undefined>()
const saved = ref(false)

onMounted(async () => {
  const me = await getMeProfile()
  displayName.value = me.displayName ?? ''
  avatarUrl.value = me.avatarUrl ?? ''
  bio.value = me.bio ?? ''
})

async function save() {
  await updateMyProfile({
    displayName: (displayName.value || '').trim(),
    avatarUrl: (avatarUrl.value || '').trim(),
    bio: (bio.value || '').trim()
  })
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}
</script>
