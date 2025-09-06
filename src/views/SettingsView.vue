<template>
  <div class="max-w-xl mx-auto p-6 space-y-5 bg-[#F2F2F0] min-h-[70vh]" dir="ltr">
    <h1 class="text-xl font-bold text-[#1B3C59]">Profile settings</h1>

    <!-- Display name -->
    <div class="space-y-2">
      <label class="block text-sm text-[#456173]">Display name</label>
      <input v-model="displayName" class="input" placeholder="Your name" />
    </div>

    <!-- Avatar -->
    <div class="space-y-2">
      <label class="block text-sm text-[#456173]">Avatar</label>

      <div class="flex items-center gap-3">
        <!-- preview -->
        <div
          class="w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#F2F2F0] bg-[#F2F2F0] grid place-items-center"
          :style="!avatarPreview ? { background: fallbackGradient } : {}"
        >
          <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
          <div v-else class="text-white font-semibold select-none">
            {{ initials }}
          </div>
        </div>

        <label class="btn-outline cursor-pointer" v-ripple>
          <input type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
          Change…
        </label>

        <button
          v-if="avatarPreview && hadServerAvatar"
          type="button"
          class="btn-danger"
          @click="clearAvatar"
          v-ripple
        >
          Remove
        </button>
      </div>
      <p class="text-xs text-[#456173]">JPG/PNG/WebP. A square image looks best.</p>
    </div>

    <!-- Bio -->
    <div class="space-y-2">
      <label class="block text-sm text-[#456173]">Bio</label>
      <textarea v-model="bio" class="input min-h-[90px]" placeholder="A short bio…"></textarea>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button class="btn-primary" :disabled="saving" @click="save" v-ripple>
        <span v-if="!saving">Save</span>
        <span v-else>Saving…</span>
      </button>

      <transition name="fade-up">
        <span v-if="saved" class="text-green-600 text-sm">Saved ✔</span>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMeProfile, updateMyProfile, uploadAvatar } from '../services/api'

const displayName = ref<string>('')
const avatarUrl   = ref<string>('')
const bio         = ref<string>('')

const saving = ref(false)
const saved  = ref(false)

const avatarFile    = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const hadServerAvatar = ref(false)

const initials = ref<string>('U')
const fallbackGradient = ref<string>('linear-gradient(135deg,#456173,#1B3C59)')

// Ripple (local)
const vRipple = {
  mounted(el: HTMLElement) {
    el.style.position ||= 'relative'
    el.style.overflow ||= 'hidden'
    el.addEventListener('click', (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.1
      const span = document.createElement('span')
      span.className = 'ripple-ink'
      span.style.width = span.style.height = `${size}px`
      span.style.left = `${e.clientX - rect.left - size/2}px`
      span.style.top  = `${e.clientY - rect.top  - size/2}px`
      el.appendChild(span)
      span.addEventListener('animationend', () => span.remove())
    })
  }
}

function computeInitials(s: string) {
  const t = (s || '').trim()
  if (!t) return 'U'
  const parts = t.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const f = (input.files && input.files[0]) || null
  avatarFile.value = f
  if (f) {
    const url = URL.createObjectURL(f)
    avatarPreview.value = url
    // اگر قبلاً آواتار سروری داشت، اجازه‌ی Remove هم نشان دهیم:
    hadServerAvatar.value = true
  }
}

function clearAvatar() {
  avatarFile.value = null
  avatarPreview.value = '' // خالی = بدون آواتار
  hadServerAvatar.value = false
}

onMounted(async () => {
  const me = await getMeProfile()
  displayName.value = me.displayName ?? ''
  avatarUrl.value   = me.avatarUrl   ?? ''
  bio.value         = me.bio         ?? ''

  avatarPreview.value  = avatarUrl.value || ''
  hadServerAvatar.value = !!avatarUrl.value
  initials.value = computeInitials(me.displayName || me.username || 'U')
})

async function save() {
  try {
    saving.value = true
    // 1) upload avatar if selected
    let finalAvatarUrl = avatarPreview.value || ''
    if (avatarFile.value) {
      const fd = new FormData()
      fd.append('file', avatarFile.value)
      finalAvatarUrl = await uploadAvatar(fd)
    }
    // 2) update profile
    await updateMyProfile({
      displayName: (displayName.value || '').trim(),
      avatarUrl: (finalAvatarUrl || '').trim(),
      bio: (bio.value || '').trim()
    })
    saved.value = true
    setTimeout(() => (saved.value = false), 1400)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
@reference "tailwindcss";

/* unified inputs & buttons using your palette */
.input {
  @apply border rounded-lg px-3 py-2 w-full outline-none bg-white
         focus:ring-2 focus:ring-[#11BFAE]/60 focus:border-[#11BFAE];
}
.btn-primary {
  @apply bg-[#11BFAE] text-white rounded-lg px-4 py-2 hover:bg-[#10B2A3] transition disabled:opacity-60;
}
.btn-outline {
  @apply border border-[#456173]/40 text-[#1B3C59] rounded-lg px-3 py-2 hover:bg-[#F2F2F0] transition;
}
.btn-danger {
  @apply text-red-600 rounded-lg px-3 py-2 hover:bg-red-50 transition;
}

/* tiny saved toast */
.fade-up-enter-from { opacity: 0; transform: translateY(6px); }
.fade-up-leave-to   { opacity: 0; transform: translateY(-4px); }
.fade-up-enter-active,
.fade-up-leave-active { transition: opacity .18s ease, transform .18s ease; }

/* ripple ink (global so dynamic span is styled) */
:global(.ripple-ink){
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity:.15;
  transform: scale(0);
  pointer-events:none;
  animation: ripple .5s ease-out forwards;
}
@keyframes ripple { to { transform: scale(4); opacity:0; } }
</style>
