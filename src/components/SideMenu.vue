<template>
  <!-- overlay fade -->
  <transition name="fade-overlay">
    <div v-if="open" class="fixed inset-0 z-[55]" role="dialog" aria-modal="true" @keydown.esc="$emit('close')">
      <div class="absolute inset-0 bg-black/30" @click="$emit('close')"></div>

      <!-- drawer slide from left -->
      <transition name="drawer">
        <aside
          class="absolute left-0 top-0 h-full w-72 bg-white shadow-xl ring-1 ring-black/5 flex flex-col"
          @click.stop
        >
          <!-- Me header -->
          <div class="p-4 border-b flex items-center gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F2F2F0] bg-[#F2F2F0] grid place-items-center">
              <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full grid place-items-center text-white font-semibold
                                 bg-gradient-to-br from-[#456173] to-[#1B3C59]">
                {{ initials(me?.displayName || me?.username || 'U') }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-[#1B3C59] truncate">
                {{ me?.displayName || '@' + (me?.username || '') }}
              </div>
              <div class="text-xs text-[#456173] truncate">
                @{{ (me?.username || '').replace(/^@/,'') }}
              </div>
            </div>
          </div>

          <!-- Items -->
          <nav class="flex-1 overflow-y-auto">
            <button class="menu-item" @click="$emit('action','profile')" v-ripple>My profile</button>
            <button class="menu-item" @click="$emit('action','contacts')" v-ripple>Contacts</button>
            <button class="menu-item" @click="$emit('action','saved')" v-ripple>Saved Messages</button>
            <button class="menu-item" @click="$emit('action','settings')" v-ripple>Settings</button>
          </nav>

          <div class="p-3 text-left">
            <button class="text-xs text-[#456173] hover:text-[#1B3C59]" @click="$emit('close')" v-ripple>Close</button>
          </div>
        </aside>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

defineProps<{ open: boolean, me?: { displayName?: string; username?: string; avatarUrl?: string } | null }>()
defineEmits<{ (e:'close'):void; (e:'action', a:'profile'|'contacts'|'saved'|'settings'):void }>()

// Esc برای خارج‌ شدن وقتی فوکوس داخل دراور است
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { emitClose() }
}
const emitClose = () => { /* helper در صورت نیاز expand شود */ }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function initials(name: string) {
  const parts = name?.trim?.().split(/\s+/).slice(0,2) || []
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('')
}

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
</script>

<style scoped>
@reference "tailwindcss";

/* list item */
.menu-item {
  @apply w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-[#11BFAE]/5 text-[#1B3C59];
}

/* overlay fade */
.fade-overlay-enter-from { opacity: 0; }
.fade-overlay-enter-active,
.fade-overlay-leave-active { transition: opacity .16s ease; }
.fade-overlay-leave-to { opacity: 0; }

/* drawer slide */
.drawer-enter-from { transform: translateX(-100%); }
.drawer-leave-to   { transform: translateX(-100%); }
.drawer-enter-active,
.drawer-leave-active { transition: transform .22s cubic-bezier(.2,.7,.2,1); }

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
