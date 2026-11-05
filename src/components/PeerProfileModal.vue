<template>
  <InfoSheet
    :open="open"
    :name="name"
    :status="status"
    :online="online"
    :avatar-url="user?.avatarUrl"
    :page-key="page"
    :page-title="pageTitle"
    @close="$emit('close')"
    @back="page = null"
  >
    <div class="flex gap-2">
      <button type="button" class="info-tile" @click="$emit('send-message', user!.id)">
        <MessageSquare class="w-5 h-5" /><span>{{ $t('profile.message') }}</span>
      </button>
      <button type="button" class="info-tile" :aria-pressed="muted" @click="$emit('toggle-mute', user!.id)">
        <BellOff v-if="muted" class="w-5 h-5" /><Bell v-else class="w-5 h-5" />
        <span>{{ muted ? $t('chat.unmute') : $t('chat.mute') }}</span>
      </button>
      <button v-if="canSearch" type="button" class="info-tile" @click="$emit('search')">
        <Search class="w-5 h-5" /><span>{{ $t('info.search') }}</span>
      </button>
      <button type="button" class="info-tile" @click="$emit('share-contact', user!)">
        <Share2 class="w-5 h-5" /><span>{{ $t('info.share') }}</span>
      </button>
    </div>

    <section v-if="user?.phoneNumber || user?.bio || user?.username" class="info-card">
      <button v-if="user?.phoneNumber" type="button" class="info-row" @click="copy(user.phoneNumber, 'phone')">
        <span class="flex-1 min-w-0">
          <span class="block text-[14.5px] text-ink"><bdi dir="ltr">{{ user.phoneNumber }}</bdi></span>
          <span class="block text-[12.5px] text-muted">{{ copied === 'phone' ? $t('chat.copied') : $t('info.mobile') }}</span>
        </span>
        <Phone class="w-[18px] h-[18px] text-muted" />
      </button>
      <div v-if="user?.bio" class="px-4 py-2.5">
        <div class="text-[14.5px] text-ink whitespace-pre-wrap break-words" dir="auto">{{ user.bio }}</div>
        <div class="text-[12.5px] text-muted">{{ $t('info.bio') }}</div>
      </div>
      <button v-if="user?.username" type="button" class="info-row" @click="copy('@' + user.username, 'username')">
        <span class="flex-1 min-w-0">
          <span class="block text-[14.5px] text-accent truncate"><bdi dir="ltr">@{{ user.username }}</bdi></span>
          <span class="block text-[12.5px] text-muted">{{ copied === 'username' ? $t('chat.copied') : $t('info.username') }}</span>
        </span>
        <AtSign class="w-[18px] h-[18px] text-muted" />
      </button>
    </section>

    <SharedMediaSection :index="index" :actions="actions" @open="kind => { sharedKind = kind; page = 'shared' }" />

    <section class="info-card">
      <button v-if="common.length" type="button" class="info-row" @click="page = 'common'">
        <span class="info-chip bg-accent/15 text-accent"><Users class="w-[18px] h-[18px]" /></span>
        <span class="flex-1 text-[14.5px] text-ink">{{ $t('info.commonGroups', { n: common.length }, common.length) }}</span>
        <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
      </button>
      <button v-if="user?.id" type="button" class="info-row" @click="page = 'security'">
        <span class="info-chip bg-accent/15 text-accent"><ShieldCheck class="w-[18px] h-[18px]" /></span>
        <span class="flex-1 text-[14.5px] text-ink">{{ $t('e2ee.securityCode') }}</span>
        <ChevronRight class="w-4 h-4 text-muted rtl:rotate-180" />
      </button>
    </section>

    <section class="info-card">
      <button v-if="isContact" type="button" class="info-row" @click="$emit('remove-contact', user!.id)">
        <span class="info-chip bg-ink/10 text-muted"><UserMinus class="w-[18px] h-[18px]" /></span>
        <span class="text-[14.5px] text-ink">{{ $t('profile.removeContact') }}</span>
      </button>
      <button v-else type="button" class="info-row" @click="$emit('add-contact', user!.id)">
        <span class="info-chip bg-ink/10 text-muted"><UserPlus class="w-[18px] h-[18px]" /></span>
        <span class="text-[14.5px] text-ink">{{ $t('profile.addContact') }}</span>
      </button>
      <button v-if="isBlocked" type="button" class="info-row" @click="$emit('unblock', user!.id)">
        <span class="info-chip bg-ink/10 text-muted"><Ban class="w-[18px] h-[18px]" /></span>
        <span class="text-[14.5px] text-ink">{{ $t('profile.unblock') }}</span>
      </button>
      <button v-else type="button" class="info-row" @click="$emit('block', user!.id)">
        <span class="info-chip bg-danger/15 text-danger"><Ban class="w-[18px] h-[18px]" /></span>
        <span class="text-[14.5px] text-danger">{{ $t('profile.block') }}</span>
      </button>
    </section>

    <template #page>
      <SharedMediaPage v-if="page === 'shared'" v-model:kind="sharedKind" :index="index" :actions="actions" />

      <div v-else-if="page === 'security' && user" class="flex-1 overflow-y-auto px-3 pb-4">
        <PeerSecurityCode :peer-id="user.id" :peer-name="name" />
      </div>

      <ul v-else-if="page === 'common'" class="flex-1 overflow-y-auto p-2">
        <li v-for="group in common" :key="group.id">
          <button type="button" class="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-surface-2 transition" @click="$emit('open-group', group.id)">
            <span class="w-11 h-11 shrink-0 rounded-[35%] overflow-hidden grid place-items-center text-white" :style="!group.avatarUrl ? { backgroundColor: colorFromString(group.title) } : {}">
              <img v-if="group.avatarUrl" :src="group.avatarUrl" class="w-full h-full object-cover" alt="" />
              <Users v-else class="w-5 h-5" />
            </span>
            <span class="min-w-0">
              <span class="block text-[14.5px] font-medium text-ink truncate"><bdi>{{ group.title }}</bdi></span>
              <span class="block text-[12.5px] text-muted">{{ $t('groups.membersCount', { n: group.memberCount }) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </template>
  </InfoSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AtSign, Ban, Bell, BellOff, ChevronRight, MessageSquare, Phone, Search, Share2, ShieldCheck, UserMinus, UserPlus, Users
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import InfoSheet from '../features/info/InfoSheet.vue'
import SharedMediaPage from '../features/info/SharedMediaPage.vue'
import SharedMediaSection from '../features/info/SharedMediaSection.vue'
import type { InfoActions } from '../features/info/types'
import PeerSecurityCode from '../features/e2ee/PeerSecurityCode.vue'
import type { ChatIndex, SharedKind } from '../features/chat/composables/useChatIndex'
import { getCommonGroups, type CommonGroup } from '../services/api'
import type { ChatUser } from '../types/chat'
import { colorFromString } from '../utils/avatar'
import { formatAbsolute } from '../utils/time'

const props = defineProps<{
  open: boolean
  user: ChatUser | null
  isContact: boolean
  isBlocked?: boolean
  online?: boolean
  muted?: boolean
  /** Search works in the open chat, which this may not be (a group member's profile). */
  canSearch?: boolean
  index: ChatIndex
  actions: InfoActions
}>()

defineEmits<{
  (e: 'close' | 'search'): void
  (e: 'send-message' | 'add-contact' | 'remove-contact' | 'block' | 'unblock' | 'toggle-mute' | 'open-group', id: string): void
  (e: 'share-contact', user: ChatUser): void
}>()

const { t } = useI18n()

const page = ref<'shared' | 'security' | 'common' | null>(null)
const sharedKind = ref<SharedKind>('photos')
const common = ref<CommonGroup[]>([])
const copied = ref<string | null>(null)

const name = computed(() => props.user?.displayName || '@' + (props.user?.username ?? ''))

const status = computed(() => {
  if (props.online) return t('chat.online')
  if (props.user?.lastSeenUtc) return t('profile.lastSeen', { when: formatAbsolute(props.user.lastSeenUtc) })
  return t('chat.lastSeenRecently')
})

const pageTitle = computed(() => {
  if (page.value === 'shared') return t('info.sharedMedia')
  if (page.value === 'security') return t('e2ee.securityCode')
  return t('info.commonGroupsTitle')
})

watch(() => [props.open, props.user?.id], async () => {
  page.value = null
  common.value = []
  const id = props.user?.id
  if (!props.open || !id) return

  try {
    const groups = await getCommonGroups(id)
    if (props.user?.id === id) common.value = groups
  } catch {}
})

let copiedTimer: number | null = null

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = what
    if (copiedTimer !== null) window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => { copied.value = null }, 1400)
  } catch {}
}
</script>
