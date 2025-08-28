<template>
  <div class="max-w-xl mx-auto p-6 space-y-4">
    <h1 class="text-xl font-semibold">تنظیمات پروفایل</h1>

    <div class="space-y-2">
      <label class="block text-sm">Display name</label>
      <input v-model="displayName" class="w-full border rounded px-3 py-2" />
    </div>

    <div class="space-y-2">
      <label class="block text-sm">Avatar</label>

      <!-- پیش‌نمایش -->
      <div class="flex items-center gap-3">
        <div
          class="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-white text-lg"
          :style="!avatarPreview ? { backgroundColor: fallbackColor } : {}"
        >
          <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
          <span v-else>{{ initials }}</span>
        </div>

        <input type="file" accept="image/*" @change="onAvatarSelected" />
        <button
          v-if="avatarPreview"
          type="button"
          class="text-sm text-gray-600 hover:text-red-600"
          @click="clearAvatar"
        >پاک کردن</button>
      </div>
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
import { getMeProfile, updateMyProfile, uploadAvatar } from '../services/api'

const displayName = ref<string | undefined>()
const avatarUrl = ref<string | undefined>()
const bio = ref<string | undefined>()
const saved = ref(false)

const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const fallbackColor = ref<string>('#6B7280') // پیش‌فرض خاکستری
const initials = ref<string>('')



function computeInitials(s: string) {
  const t = s.trim()
  if (!t) return '؟'
  const parts = t.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
function colorFromString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  // HSL → رنگ ملایم
  const hue = h % 360
  return `hsl(${hue} 65% 55%)`
}


function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const f = (input.files && input.files[0]) || null
  avatarFile.value = f
  if (f) {
    const url = URL.createObjectURL(f)
    avatarPreview.value = url
  }
}
function clearAvatar() {
  avatarFile.value = null
  avatarPreview.value = null
}


onMounted(async () => {
  const me = await getMeProfile()
  displayName.value = me.displayName ?? ''
  avatarUrl.value = me.avatarUrl ?? ''
  bio.value = me.bio ?? ''

  avatarPreview.value = me.avatarUrl || null
  initials.value = computeInitials(me.displayName || me.username || '')
  fallbackColor.value = colorFromString(me.id || me.username || 'user')

})

async function save() {
  let finalAvatarUrl = avatarPreview.value || ''
  if (avatarFile.value) {
    const fd = new FormData()
    fd.append('file', avatarFile.value)
    finalAvatarUrl = await uploadAvatar(fd)   
  }

  await updateMyProfile({
    displayName: (displayName.value || '').trim(),
    avatarUrl: (finalAvatarUrl || '').trim(),
    bio: (bio.value || '').trim()
  })                                          

  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}

</script>
