<template>
  <div
    class="settings h-full flex bg-surface text-ink overflow-hidden"
    :class="inModal ? '' : 'h-[100dvh]'"
  >
    <!-- Section list (sidebar on wide screens, its own page on phones) -->
    <nav
      v-show="!narrow || !active"
      class="flex flex-col shrink-0 border-line bg-surface"
      :class="narrow ? 'w-full' : 'w-[260px] border-e'"
    >
      <div class="h-14 shrink-0 flex items-center gap-1 px-2">
        <button v-if="!inModal" type="button" class="icon-btn" :aria-label="$t('common.back')" @click="goBack">
          <ArrowLeft class="w-5 h-5 rtl:rotate-180" />
        </button>
        <h2 class="flex-1 px-2 text-lg font-semibold">{{ $t('settings.title') }}</h2>
        <button v-if="inModal && narrow" type="button" class="icon-btn" :aria-label="$t('common.close')" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Who is signed in -->
      <div class="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
        <div class="w-11 h-11 rounded-full overflow-hidden grid place-items-center shrink-0" :style="!avatarPreview ? { backgroundColor: avatarColor } : {}">
          <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" alt="" />
          <span v-else class="text-white font-semibold">{{ initials }}</span>
        </div>
        <div class="min-w-0">
          <div class="font-semibold truncate"><bdi>{{ displayName || '@' + username }}</bdi></div>
          <div class="text-xs text-muted truncate" dir="ltr">@{{ username }}</div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-2 pb-2">
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          class="nav-item"
          :class="!narrow && active === section.key ? 'nav-item-on' : ''"
          @click="active = section.key"
        >
          <span class="nav-icon" :style="{ backgroundColor: section.color }">
            <component :is="section.icon" class="w-4 h-4" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-[14px] font-medium">{{ $t(`settings.sections.${section.key}`) }}</span>
            <span class="block text-xs text-muted truncate">{{ $t(`settings.sections.${section.key}Hint`) }}</span>
          </span>
          <ChevronRight v-if="narrow" class="w-4 h-4 text-muted rtl:rotate-180" />
        </button>
      </div>

      <div class="p-2 border-t border-line">
        <button type="button" class="nav-item text-danger" @click="openLogout = true">
          <span class="nav-icon bg-danger"><LogOut class="w-4 h-4 rtl:-scale-x-100" /></span>
          <span class="text-[14px] font-medium">{{ $t('settings.logout') }}</span>
        </button>
      </div>
    </nav>

    <!-- Section content -->
    <main v-if="active" class="flex-1 min-w-0 flex flex-col bg-canvas">
      <header class="h-14 shrink-0 flex items-center gap-1 px-2 bg-surface border-b border-line">
        <button v-if="narrow" type="button" class="icon-btn" :aria-label="$t('common.back')" @click="active = null">
          <ArrowLeft class="w-5 h-5 rtl:rotate-180" />
        </button>
        <h2 class="flex-1 px-2 text-[16px] font-semibold">{{ $t(`settings.sections.${active}`) }}</h2>
        <button v-if="inModal" type="button" class="icon-btn" :aria-label="$t('common.close')" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </header>

      <div class="flex-1 overflow-y-auto">
        <div class="max-w-xl mx-auto p-4 sm:p-6">
          <!-- Account -->
          <div v-if="active === 'account'" class="space-y-5">
            <div class="flex flex-col items-center gap-3">
              <div
                class="w-24 h-24 rounded-full overflow-hidden grid place-items-center shadow-sm"
                :style="!avatarPreview ? { backgroundColor: avatarColor } : {}"
              >
                <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" alt="" />
                <span v-else class="text-white text-3xl font-semibold">{{ initials }}</span>
              </div>
              <div class="flex items-center gap-2">
                <label class="btn-outline cursor-pointer gap-1.5 text-sm">
                  <input type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
                  <ImageUp class="w-4 h-4" /> <span>{{ $t('settings.change') }}</span>
                </label>
                <button v-if="avatarPreview && hadServerAvatar" type="button" class="btn-danger gap-1.5 text-sm px-3 py-2" @click="clearAvatar">
                  <Trash2 class="w-4 h-4" /> <span>{{ $t('common.remove') }}</span>
                </button>
              </div>
              <p class="text-xs text-muted">{{ $t('settings.avatarHint') }}</p>
            </div>

            <div class="card space-y-4">
              <label class="block space-y-1.5">
                <span class="text-sm text-muted">{{ $t('settings.displayName') }}</span>
                <input v-model="displayName" class="input w-full" dir="auto" maxlength="64" :placeholder="$t('settings.displayNamePlaceholder')" />
              </label>

              <label class="block space-y-1.5">
                <span class="flex items-center justify-between text-sm text-muted">
                  <span>{{ $t('settings.bio') }}</span>
                  <span class="text-xs tabular-nums" :class="bio.length > BIO_MAX - 20 ? 'text-danger' : ''">{{ bio.length }}/{{ BIO_MAX }}</span>
                </span>
                <textarea v-model="bio" class="input w-full min-h-[96px] resize-y" dir="auto" :maxlength="BIO_MAX" :placeholder="$t('settings.bioPlaceholder')"></textarea>
              </label>
            </div>

            <div class="card divide-y divide-line">
              <div class="flex items-center justify-between py-2">
                <span class="text-sm text-muted">{{ $t('auth.username') }}</span>
                <span class="text-sm" dir="ltr">@{{ username }}</span>
              </div>
              <div v-if="phoneNumber" class="flex items-center justify-between py-2">
                <span class="text-sm text-muted">{{ $t('auth.phoneNumber') }}</span>
                <span class="text-sm" dir="ltr">{{ phoneNumber }}</span>
              </div>
            </div>

            <div class="flex items-center gap-3">
              <button class="btn-primary gap-2" :disabled="saving" @click="save">
                <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
                <span>{{ saving ? $t('common.saving') : $t('common.save') }}</span>
              </button>
              <transition name="fade-up">
                <span v-if="saved" class="text-emerald-600 dark:text-emerald-400 text-sm inline-flex items-center gap-1.5">
                  <Check class="w-4 h-4" /> <span>{{ $t('common.saved') }}</span>
                </span>
              </transition>
              <span v-if="saveError" class="text-danger text-sm">{{ saveError }}</span>
            </div>
          </div>

          <div v-else-if="active === 'appearance'" class="card">
            <AppearanceSettings />
          </div>

          <div v-else-if="active === 'general'" class="card">
            <GeneralSettings />
          </div>

          <div v-else-if="active === 'notifications'" class="card">
            <NotificationSettings />
          </div>

          <div v-else-if="active === 'privacy'" class="space-y-4">
            <div class="card"><PrivacySettings /></div>
            <div class="card"><E2eeSettings /></div>
            <div class="card"><BlockedUsersSettings /></div>
          </div>

          <div v-else-if="active === 'devices'" class="card">
            <SessionsSettings />
          </div>
        </div>
      </div>
    </main>

    <!-- Confirm logout -->
    <Teleport to="body">
      <div v-if="openLogout" class="fixed inset-0 z-[90]">
        <div class="absolute inset-0 bg-overlay" @click="openLogout = false"></div>
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[92vw] rounded-2xl bg-surface shadow-2xl ring-1 ring-line p-5">
          <div class="text-lg font-semibold text-ink mb-2">{{ $t('settings.logout') }}</div>
          <p class="text-sm text-muted mb-5">{{ $t('settings.logoutConfirm') }}</p>
          <div class="flex items-center justify-end gap-2">
            <button class="btn-ghost px-4 py-2" @click="openLogout = false">{{ $t('common.cancel') }}</button>
            <button class="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 bg-danger text-white font-medium hover:brightness-110" @click="doLogout">
              <LogOut class="w-4 h-4 rtl:-scale-x-100" /> <span>{{ $t('settings.logout') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft, Bell, Check, ChevronRight, ImageUp, Loader2, LogOut, MonitorSmartphone, Palette, ShieldCheck, SlidersHorizontal,
  Trash2, UserRound, X
} from 'lucide-vue-next'
import { colorFromString, initialsOf } from '../utils/avatar'
import { getErrorMessage, getMeProfile, logout, updateMyProfile, uploadAvatar } from '../services/api'
import { disconnectFromChatHub } from '../services/signalr'
import { useSessionStore } from '../stores/session'
import { useE2eeStore } from '../stores/e2ee'
import E2eeSettings from '../features/e2ee/E2eeSettings.vue'
import AppearanceSettings from '../features/settings/AppearanceSettings.vue'
import GeneralSettings from '../features/settings/GeneralSettings.vue'
import BlockedUsersSettings from '../features/settings/BlockedUsersSettings.vue'
import NotificationSettings from '../features/settings/NotificationSettings.vue'
import PrivacySettings from '../features/settings/PrivacySettings.vue'
import SessionsSettings from '../features/settings/SessionsSettings.vue'
import { t } from '../i18n'

type SectionKey = 'account' | 'appearance' | 'general' | 'notifications' | 'privacy' | 'devices'

withDefaults(defineProps<{ inModal?: boolean }>(), { inModal: false })
const emit = defineEmits<{ (e: 'close'): void }>()

const sections: Array<{ key: SectionKey; icon: typeof Palette; color: string }> = [
  { key: 'account', icon: UserRound, color: '#3b82f6' },
  { key: 'appearance', icon: Palette, color: '#a855f7' },
  { key: 'general', icon: SlidersHorizontal, color: '#f59e0b' },
  { key: 'notifications', icon: Bell, color: '#ef4444' },
  { key: 'privacy', icon: ShieldCheck, color: '#11bfae' },
  { key: 'devices', icon: MonitorSmartphone, color: '#6366f1' }
]

const BIO_MAX = 300

const router = useRouter()
const e2ee = useE2eeStore()
const session = useSessionStore()

// Phones show the section list first; wider screens open the first section next to it.
const narrowQuery = window.matchMedia('(max-width: 640px)')
const narrow = ref(narrowQuery.matches)
const onNarrowChange = (event: MediaQueryListEvent) => { narrow.value = event.matches }
narrowQuery.addEventListener('change', onNarrowChange)
onBeforeUnmount(() => narrowQuery.removeEventListener('change', onNarrowChange))

const active = ref<SectionKey | null>(narrow.value ? null : 'account')

const displayName = ref('')
const bio = ref('')
const username = ref('')
const phoneNumber = ref('')
const avatarUrl = ref('')

const saving = ref(false)
const saved = ref(false)
const saveError = ref<string | null>(null)
const openLogout = ref(false)
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const hadServerAvatar = ref(false)

const initials = computed(() => initialsOf(displayName.value || username.value || 'U'))
const avatarColor = computed(() => colorFromString(displayName.value || username.value || 'U'))

function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const f = (input.files && input.files[0]) || null
  avatarFile.value = f
  if (f) {
    avatarPreview.value = URL.createObjectURL(f)
    hadServerAvatar.value = true
  }
}

function clearAvatar() {
  avatarFile.value = null
  avatarPreview.value = ''
  hadServerAvatar.value = false
}

onMounted(async () => {
  const me = await getMeProfile()
  displayName.value = me.displayName ?? ''
  avatarUrl.value = me.avatarUrl ?? ''
  bio.value = me.bio ?? ''
  username.value = (me.username ?? '').replace(/^@/, '')
  phoneNumber.value = me.phoneNumber ?? ''

  avatarPreview.value = avatarUrl.value || ''
  hadServerAvatar.value = !!avatarUrl.value
})

async function save() {
  try {
    saving.value = true
    saveError.value = null
    let finalAvatarUrl = avatarPreview.value || ''
    if (avatarFile.value) {
      const fd = new FormData()
      fd.append('file', avatarFile.value)
      finalAvatarUrl = await uploadAvatar(fd)
    }
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
    avatarFile.value = null
    saved.value = true
    setTimeout(() => (saved.value = false), 1400)
  } catch (e) {
    saveError.value = getErrorMessage(e, t('settings.saveFailed'))
  } finally {
    saving.value = false
  }
}

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push('/chat')
}

async function doLogout() {
  openLogout.value = false
  try { await disconnectFromChatHub() } catch {}
  // Revokes the refresh token on the server, then clears local auth data.
  await logout()
  session.reset()
  e2ee.resetState()
  await router.replace('/login')
}
</script>

<style scoped>
@reference "../assets/tailwind.css";

.card {
  @apply rounded-2xl bg-surface ring-1 ring-line p-4 sm:p-5;
}
.nav-item {
  @apply w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-start hover:bg-surface-2 transition;
}
.nav-item-on {
  @apply bg-accent-soft hover:bg-accent-soft;
}
.nav-icon {
  @apply w-8 h-8 shrink-0 rounded-lg grid place-items-center text-white;
}

.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(4px); }
.fade-up-enter-active, .fade-up-leave-active { transition: opacity .15s ease, transform .15s ease; }
</style>
