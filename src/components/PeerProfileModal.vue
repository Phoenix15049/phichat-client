<template>
  <ModalSheet :open="open" @close="$emit('close')">
    <div class="p-5 w-[520px] max-w-full" dir="ltr">
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
          {{ initials(user?.displayName || user?.username || 'U') }}
        </div>

        <!-- Title & meta -->
        <div class="flex-1 min-w-0">
          <div class="text-lg font-bold text-[#1B3C59] truncate">
            {{ user?.displayName || '@' + (user?.username || '') }}
          </div>
          <div class="text-sm text-[#456173] truncate">
            @{{ user?.username }}
          </div>

          <div v-if="user?.lastSeenUtc" class="text-xs text-[#456173] mt-1">
            Last seen: {{ fmtLastSeen(user.lastSeenUtc) }}
          </div>
        </div>

        <button
          class="text-[#456173] hover:text-[#1B3C59] px-2 py-1 rounded hover:bg-[#F2F2F0]"
          @click="$emit('close')"
          v-ripple
          aria-label="Close"
        >✕</button>
      </div>

      <!-- Info -->
      <div class="mt-5 space-y-2 text-sm">
        <div v-if="user?.phoneNumber" class="flex items-center gap-2">
          <span class="text-[#456173]">📞 Phone:</span>
          <span class="text-[#1B3C59]">{{ user.phoneNumber }}</span>
        </div>
        <div v-if="user?.bio" class="flex items-start gap-2">
          <span class="text-[#456173] mt-0.5">💬 Bio:</span>
          <span class="text-[#1B3C59]">{{ user.bio }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 grid grid-cols-2 gap-2">
        <button class="btn-primary" @click="$emit('send-message', user!.id)" v-ripple>
          Message
        </button>

        <button class="btn-outline" @click="$emit('share-contact', user!)" v-ripple>
          Share contact
        </button>

        <button
          v-if="isContact"
          class="btn-danger"
          @click="$emit('remove-contact', user!.id)"
          v-ripple
        >
          Remove from contacts
        </button>

        <button
          v-else
          class="btn-outline"
          @click="$emit('add-contact', user!.id)"
          v-ripple
        >
          Add to contacts
        </button>

        <button class="btn-disabled col-span-2" title="Coming soon" disabled>
          Block user
        </button>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import ModalSheet from './ModalSheet.vue'
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  open: boolean
  user: {
    id: string
    username: string
    displayName?: string
    avatarUrl?: string
    bio?: string
    lastSeenUtc?: string
    phoneNumber?: string
  } | null
  isContact: boolean
}>()

defineEmits(['close','send-message','add-contact','remove-contact','share-contact'])

// ripple directive (local)
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0,2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('')
}

function fmtLastSeen(iso?: string) {
  if (!iso) return 'Unknown'
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch { return 'Unknown' }
}
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

/* ripple ink (global selector so dynamic span is styled) */
:global(.ripple-ink) {
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity: .15;
  transform: scale(0);
  pointer-events: none;
  animation: ripple .5s ease-out forwards;
}
@keyframes ripple {
  to { transform: scale(4); opacity: 0; }
}
</style>
