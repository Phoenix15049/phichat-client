<template>
  <div class="max-w-xl mx-auto p-6 space-y-5 bg-[#F2F2F0] min-h-[70vh]">
    <!-- Language -->
    <div class="flex items-center justify-between">
      <label class="block text-sm text-[#456173]">{{ $t('settings.languageHint') }}</label>
      <LanguageSwitch />
    </div>

    <!-- Display name -->
    <div class="space-y-2">
      <label class="block text-sm text-[#456173]">{{ $t('settings.displayName') }}</label>
      <input v-model="displayName" class="input" dir="auto" :placeholder="$t('settings.displayNamePlaceholder')" />
    </div>

    <!-- Avatar -->
    <div class="space-y-2">
      <label class="block text-sm text-[#456173]">{{ $t('settings.avatar') }}</label>

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

        <label class="btn-outline cursor-pointer inline-flex items-center gap-1.5" v-ripple>
          <input type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
          <ImageUp class="w-4 h-4" /> <span>{{ $t('settings.change') }}</span>
        </label>

        <button v-if="avatarPreview && hadServerAvatar" type="button"
                class="btn-danger inline-flex items-center gap-1.5"
                @click="clearAvatar" v-ripple>
          <Trash2 class="w-4 h-4" /> <span>{{ $t('common.remove') }}</span>
        </button>

      </div>
      <p class="text-xs text-[#456173]">{{ $t('settings.avatarHint') }}</p>
    </div>

    <!-- Bio -->
    <div class="space-y-2">
      <label class="block text-sm text-[#456173]">{{ $t('settings.bio') }}</label>
      <textarea v-model="bio" class="input min-h-[90px]" dir="auto" :placeholder="$t('settings.bioPlaceholder')"></textarea>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button class="btn-primary" :disabled="saving" @click="save" v-ripple>
        <span v-if="!saving">{{ $t('common.save') }}</span>
        <span v-else>{{ $t('common.saving') }}</span>
      </button>

      <transition name="fade-up">
        <span v-if="saved" class="text-green-600 text-sm inline-flex items-center gap-1.5">
          <Check class="w-4 h-4" /> <span>{{ $t('common.saved') }}</span>
        </span>
      </transition>

      <span v-if="saveError" class="text-red-600 text-sm">{{ saveError }}</span>

    </div>

    <!-- Divider -->
    <hr class="my-6 border-[#456173]/20">

    <!-- Logout -->
    <div class="flex items-center justify-between">
      <div class="text-[#1B3C59] font-medium">{{ $t('settings.logoutSection') }}</div>
      <button class="btn-outline inline-flex items-center gap-1.5" @click="openLogout = true" v-ripple>
        <LogOut class="w-4 h-4 rtl:-scale-x-100" /> <span>{{ $t('settings.logout') }}</span>
      </button>

    </div>

    <!-- Confirm dialog -->
    <Teleport to="body">
      <div v-if="openLogout" class="fixed inset-0 z-[90]">
        <div class="absolute inset-0 bg-black/40" @click="openLogout=false"></div>

        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                    w-[420px] max-w-[95vw] rounded-2xl bg-white shadow-xl p-4">
          <div class="text-lg font-semibold mb-2">{{ $t('settings.logout') }}</div>
          <p class="text-sm text-gray-600 mb-4">{{ $t('settings.logoutConfirm') }}</p>

          <div class="flex items-center justify-end gap-2">
            <button class="px-3 py-1.5 rounded border hover:bg-gray-50 inline-flex items-center gap-1.5"
                    @click="openLogout=false" v-ripple>
              <X class="w-4 h-4" /> <span>{{ $t('common.cancel') }}</span>
            </button>
            <button class="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 inline-flex items-center gap-1.5"
                    @click="doLogout" v-ripple>
              <LogOut class="w-4 h-4 rtl:-scale-x-100" /> <span>{{ $t('settings.logout') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>





  </div>
</template>

<script setup lang="ts">
import { initialsOf } from '../utils/avatar'
import { ImageUp, Trash2, Check, LogOut, X } from 'lucide-vue-next'
import { ref, onMounted } from 'vue'
import { getErrorMessage, getMeProfile, logout, updateMyProfile, uploadAvatar } from '../services/api'
import { disconnectFromChatHub } from '../services/signalr'
import { useSessionStore } from '../stores/session'
import LanguageSwitch from '../components/LanguageSwitch.vue'
import { t } from '../i18n'
import { useRouter } from 'vue-router'
const displayName = ref<string>('')
const avatarUrl   = ref<string>('')
const bio         = ref<string>('')

const router = useRouter()
const session = useSessionStore()

const saving = ref(false)
const saved  = ref(false)
const saveError = ref<string | null>(null)
const openLogout = ref(false)
const avatarFile    = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const hadServerAvatar = ref(false)

const initials = ref<string>('U')
const fallbackGradient = ref<string>('linear-gradient(135deg,#456173,#1B3C59)')



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
  initials.value = initialsOf(me.displayName || me.username || 'U')
})

async function save() {
  try {
    saving.value = true
    saveError.value = null
    // 1) upload avatar if selected
    let finalAvatarUrl = avatarPreview.value || ''
    if (avatarFile.value) {
      const fd = new FormData()
      fd.append('file', avatarFile.value)
      finalAvatarUrl = await uploadAvatar(fd)
    }
    // 2) update profile
    const profile = {
      displayName: (displayName.value || '').trim(),
      avatarUrl: (finalAvatarUrl || '').trim(),
      bio: (bio.value || '').trim()
    }
    await updateMyProfile(profile)

    // Show the change everywhere (side menu, profile) without a reload.
    session.updateMe({
      displayName: profile.displayName || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      bio: profile.bio || undefined
    })
    saved.value = true
    setTimeout(() => (saved.value = false), 1400)
  } catch (e) {
    saveError.value = getErrorMessage(e, t('settings.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function doLogout() {
  openLogout.value = false
  try { await disconnectFromChatHub() } catch {}
  // Revokes the refresh token on the server, then clears local auth data.
  await logout()
  session.reset()
  await router.replace('/login')
}
</script>

<style scoped>
@reference "tailwindcss";

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 50; 
}


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

</style>
