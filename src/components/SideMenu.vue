<template>
  <!-- overlay fade -->
  <transition name="fade-overlay">
    <div v-if="open" class="fixed inset-0 z-[55]" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-overlay" @click="emit('close')"></div>

      <!-- drawer slides in from the start edge (left in LTR, right in RTL) -->
      <transition name="drawer">
        <aside class="absolute start-0 top-0 h-full w-[300px] max-w-[85vw] bg-surface shadow-2xl flex flex-col" @click.stop>
          <!-- Me header -->
          <div class="px-5 pt-6 pb-4 bg-accent-soft">
            <div class="w-16 h-16 rounded-full overflow-hidden grid place-items-center shadow-sm">
              <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" alt="" />
              <div
                v-else
                class="w-full h-full grid place-items-center text-white text-xl font-semibold"
                :style="{ backgroundColor: colorFromString(me?.displayName || me?.username || 'U') }"
              >
                {{ initialsOf(me?.displayName || me?.username || 'U') }}
              </div>
            </div>
            <div class="mt-3 min-w-0">
              <div class="font-semibold text-ink truncate" dir="auto">
                <bdi>{{ me?.displayName || '@' + (me?.username || '') }}</bdi>
              </div>
              <div class="text-[13px] text-muted truncate">
                <span dir="ltr">@{{ (me?.username || '').replace(/^@/, '') }}</span>
              </div>
            </div>
          </div>

          <!-- Items -->
          <nav class="flex-1 overflow-y-auto py-2">
            <button class="menu-item" type="button" @click="emit('action', 'profile')" v-ripple>
              <CircleUser class="w-5 h-5" /> <span>{{ $t('menu.myProfile') }}</span>
            </button>
            <button class="menu-item" type="button" @click="emit('action', 'newGroup')" v-ripple>
              <UsersRound class="w-5 h-5" /> <span>{{ $t('groups.newGroup') }}</span>
            </button>
            <button class="menu-item" type="button" @click="emit('action', 'contacts')" v-ripple>
              <Users class="w-5 h-5" /> <span>{{ $t('menu.contacts') }}</span>
            </button>
            <button class="menu-item" type="button" @click="emit('action', 'saved')" v-ripple>
              <Bookmark class="w-5 h-5" /> <span>{{ $t('menu.savedMessages') }}</span>
            </button>
            <button class="menu-item" type="button" @click="emit('action', 'settings')" v-ripple>
              <Settings class="w-5 h-5" /> <span>{{ $t('menu.settings') }}</span>
            </button>

            <button class="menu-item" type="button" role="switch" :aria-checked="isDark" @click="toggleDark">
              <Moon class="w-5 h-5" />
              <span class="flex-1">{{ $t('menu.nightMode') }}</span>
              <span class="switch" :class="isDark ? 'switch-on' : ''"><span class="switch-knob"></span></span>
            </button>
          </nav>

          <div class="px-5 py-3 text-[12px] text-muted border-t border-line">PhiChat</div>
        </aside>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { Bookmark, CircleUser, Moon, Settings, Users, UsersRound } from 'lucide-vue-next'
import { colorFromString, initialsOf } from '../utils/avatar'
import { usePreferencesStore } from '../stores/preferences'
import type { ChatUser } from '../types/chat'

const props = defineProps<{ open: boolean, me?: Partial<ChatUser> | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'action', a: 'profile' | 'contacts' | 'saved' | 'settings' | 'newGroup'): void }>()

const preferences = usePreferencesStore()
const isDark = computed(() => preferences.isDark)
const toggleDark = () => preferences.toggleDark()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
@reference "../assets/tailwind.css";

.menu-item {
  @apply relative overflow-hidden w-full flex items-center gap-4 text-start px-5 py-3 text-[15px] text-ink hover:bg-surface-2 transition;
}
.menu-item > svg {
  @apply text-muted shrink-0;
}

.switch {
  @apply relative w-9 h-5 rounded-full bg-line transition-colors;
}
.switch-on {
  @apply bg-accent;
}
.switch-knob {
  @apply absolute top-0.5 start-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform;
}
.switch-on .switch-knob {
  transform: translateX(16px);
}
:global([dir="rtl"] .switch-on .switch-knob) {
  transform: translateX(-16px);
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
