<template>
  <ModalSheet :open="open" @close="$emit('close')">
    <div class="p-5 w-[520px] max-w-full">
      <!-- Header -->
      <div class="flex items-start gap-4">
        <!-- Avatar -->
        <img
          v-if="user?.avatarUrl"
          :src="user.avatarUrl"
          alt="avatar"
          class="w-16 h-16 rounded-full object-cover ring-2 ring-[#F2F2F0]"
        />
        <div
          v-else
          class="w-16 h-16 rounded-full grid place-items-center text-white font-semibold
                 bg-gradient-to-br from-[#456173] to-[#1B3C59]"
        >
          {{ initialsOf(user?.displayName || user?.username || 'U') }}
        </div>

        <!-- Title & meta -->
        <div class="flex-1 min-w-0">
          <div class="text-lg font-bold text-[#1B3C59] truncate" dir="auto">
            <bdi>{{ user?.displayName || '@' + (user?.username || '') }}</bdi>
          </div>
          <div class="text-sm text-[#456173] truncate">
            <span dir="ltr">@{{ user?.username }}</span>
          </div>

          <div v-if="user?.lastSeenUtc" class="text-xs text-[#456173] mt-1">
            {{ $t('profile.lastSeen', { when: formatAbsolute(user.lastSeenUtc) }) }}
          </div>
        </div>

        <button
          class="text-[#456173] hover:text-[#1B3C59] px-2 py-1 rounded hover:bg-[#F2F2F0]"
          @click="$emit('close')" v-ripple :aria-label="$t('common.close')">
          <X class="w-5 h-5" />
        </button>

      </div>

      <!-- Info -->
      <div class="mt-5 space-y-2 text-sm">
        <div v-if="user?.phoneNumber" class="flex items-center gap-2">
          <Phone class="w-4 h-4 text-[#456173]" />
          <span class="text-[#1B3C59]" dir="ltr">{{ user.phoneNumber }}</span>
        </div>
        <div v-if="user?.bio" class="flex items-start gap-2">
          <FileText class="w-4 h-4 text-[#456173] mt-0.5" />
          <span class="text-[#1B3C59]" dir="auto">{{ user.bio }}</span>
        </div>
      </div>


      <!-- Actions -->
      <div class="mt-6 grid grid-cols-2 gap-2">
        <button class="btn-primary inline-flex items-center justify-center gap-2"
                @click="$emit('send-message', user!.id)" v-ripple>
          <MessageSquare class="w-4 h-4" /><span>{{ $t('profile.message') }}</span>
        </button>

        <button class="btn-outline inline-flex items-center justify-center gap-2"
                @click="$emit('share-contact', user!)" v-ripple>
          <Share2 class="w-4 h-4" /><span>{{ $t('profile.share') }}</span>
        </button>

        <button v-if="isContact"
                class="btn-danger inline-flex items-center justify-center gap-2"
                @click="$emit('remove-contact', user!.id)" v-ripple>
          <UserMinus class="w-4 h-4" /><span>{{ $t('profile.removeContact') }}</span>
        </button>

        <button v-else
                class="btn-outline inline-flex items-center justify-center gap-2"
                @click="$emit('add-contact', user!.id)" v-ripple>
          <UserPlus class="w-4 h-4" /><span>{{ $t('profile.addContact') }}</span>
        </button>

        <button class="btn-disabled col-span-2 inline-flex items-center justify-center gap-2"
                :title="$t('profile.comingSoon')" disabled>
          <Ban class="w-4 h-4" /><span>{{ $t('profile.block') }}</span>
        </button>
      </div>

    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { initialsOf } from '../utils/avatar'
import { formatAbsolute } from '../utils/time'
import ModalSheet from './ModalSheet.vue'
import type { ChatUser } from '../types/chat'
import { X, Phone, FileText, MessageSquare, Share2, UserPlus, UserMinus, Ban } from 'lucide-vue-next'

defineProps<{
  open: boolean
  user: ChatUser | null
  isContact: boolean
}>()

defineEmits(['close','send-message','add-contact','remove-contact','share-contact'])



</script>

<style scoped>
@reference "tailwindcss";

/* buttons with your palette */
.btn-primary {
  @apply bg-[#11BFAE] text-white rounded-lg px-4 py-2 hover:bg-[#10B2A3] transition disabled:opacity-60;
}
.btn-outline {
  @apply border border-[#456173]/40 text-[#1B3C59] rounded-lg px-4 py-2 hover:bg-[#F2F2F0] transition;
}
.btn-danger {
  @apply border border-red-500/30 text-red-600 rounded-lg px-4 py-2 hover:bg-red-50 transition;
}
.btn-disabled {
  @apply border border-gray-300 text-gray-400 rounded-lg px-4 py-2 cursor-not-allowed;
}

</style>
