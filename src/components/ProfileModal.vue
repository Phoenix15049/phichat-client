<template>
  <ModalSheet :open="open" @close="$emit('close')">
    <div class="p-6 w-[520px] max-w-full" dir="ltr">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-[#1B3C59]">Profile</h2>
        <button
          class="px-2 py-1 rounded text-[#456173] hover:text-[#1B3C59] hover:bg-[#F2F2F0]"
          @click="$emit('close')"
          v-ripple
          aria-label="Close"
        >✕</button>
      </div>

      <!-- Top row -->
      <div class="flex items-center gap-4">
        <!-- Avatar -->
        <div class="w-20 h-20 rounded-full overflow-hidden ring-2 ring-[#F2F2F0] bg-[#F2F2F0] grid place-items-center">
          <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full grid place-items-center text-white font-semibold
                             bg-gradient-to-br from-[#456173] to-[#1B3C59]">
            {{ initials(me?.displayName || me?.username || 'U') }}
          </div>
        </div>

        <!-- Names -->
        <div class="min-w-0">
          <div class="text-xl font-bold text-[#1B3C59] truncate">
            {{ me?.displayName || '@' + (me?.username || '') }}
          </div>
          <div class="text-sm text-[#456173] truncate">
            @{{ (me?.username || '').replace(/^@/, '') }}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 flex items-center justify-end gap-2">
        <button class="btn-primary" @click="$emit('edit')" v-ripple>Edit profile</button>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import ModalSheet from './ModalSheet.vue'

defineProps<{
  open: boolean,
  me?: { displayName?: string; username?: string; avatarUrl?: string } | null
}>()

defineEmits<{ (e:'close'):void; (e:'edit'):void }>()

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
</script>

<style scoped>
@reference "tailwindcss";

.btn-primary {
  @apply bg-[#11BFAE] text-white rounded-lg px-4 py-2 hover:bg-[#10B2A3] transition disabled:opacity-60;
}

/* ripple (global so dynamic span is styled) */
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
