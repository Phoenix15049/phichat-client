<template>
  <!-- overlay fade -->
  <transition name="fade-overlay">
    <div v-if="open" class="fixed inset-0 z-[55]" role="dialog" aria-modal="true" @keydown.esc="$emit('close')">
      <div class="absolute inset-0 bg-black/30" @click="$emit('close')"></div>

      <!-- drawer slides in from the start edge (left in LTR, right in RTL) -->
      <transition name="drawer">
        <aside
          class="absolute start-0 top-0 h-full w-72 bg-white shadow-xl ring-1 ring-black/5 flex flex-col"
          @click.stop
        >
          <!-- Me header -->
          <div class="p-4 border-b flex items-center gap-3">
            <div class="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#F2F2F0] bg-[#F2F2F0] grid place-items-center">
              <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full grid place-items-center text-white font-semibold
                                 bg-gradient-to-br from-[#456173] to-[#1B3C59]">
                {{ initialsOf(me?.displayName || me?.username || 'U') }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-[#1B3C59] truncate" dir="auto">
                <bdi>{{ me?.displayName || '@' + (me?.username || '') }}</bdi>
              </div>
              <div class="text-xs text-[#456173] truncate">
                <span dir="ltr">@{{ (me?.username || '').replace(/^@/,'') }}</span>
              </div>
            </div>
          </div>

          <!-- Items -->
          <nav class="flex-1 overflow-y-auto">
            <button class="menu-item flex items-center gap-2" @click="$emit('action','profile')"  v-ripple>
              <User class="w-4 h-4" /> <span>{{ $t('menu.myProfile') }}</span>
            </button>
            <button class="menu-item flex items-center gap-2" @click="$emit('action','contacts')" v-ripple>
              <Users class="w-4 h-4" /> <span>{{ $t('menu.contacts') }}</span>
            </button>
            <button class="menu-item flex items-center gap-2" @click="$emit('action','saved')"    v-ripple>
              <Bookmark class="w-4 h-4" /> <span>{{ $t('menu.savedMessages') }}</span>
            </button>
            <button class="menu-item flex items-center gap-2" @click="$emit('action','settings')" v-ripple>
              <Settings class="w-4 h-4" /> <span>{{ $t('menu.settings') }}</span>
            </button>
          </nav>


          <div class="p-3 text-start">
            <button class="text-xs text-[#456173] hover:text-[#1B3C59] inline-flex items-center gap-1.5"
                    @click="$emit('close')" v-ripple>
              <X class="w-3.5 h-3.5" /> <span>{{ $t('common.close') }}</span>
            </button>
          </div>

        </aside>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { initialsOf } from '../utils/avatar'
import { onMounted, onBeforeUnmount } from 'vue'
import { User, Users, Bookmark, Settings, X } from 'lucide-vue-next'
import type { ChatUser } from '../types/chat'


defineProps<{ open: boolean, me?: Partial<ChatUser> | null }>()
defineEmits<{ (e:'close'):void; (e:'action', a:'profile'|'contacts'|'saved'|'settings'):void }>()

// Esc برای خارج‌ شدن وقتی فوکوس داخل دراور است
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { emitClose() }
}
const emitClose = () => { /* helper در صورت نیاز expand شود */ }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))


</script>

<style scoped>
@reference "tailwindcss";

/* list item */
.menu-item {
  @apply w-full text-start px-4 py-3 border-b border-gray-100 hover:bg-[#11BFAE]/5 text-[#1B3C59];
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
/* RTL: the drawer sits on the right, so it slides in from the right.
   The whole selector must be inside :global() - `:global(x) .y` compiles to just `x`. */
:global([dir="rtl"] .drawer-enter-from),
:global([dir="rtl"] .drawer-leave-to) { transform: translateX(100%); }

</style>
