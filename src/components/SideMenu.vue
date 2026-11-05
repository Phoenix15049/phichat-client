<template>
  <!-- A floating panel that opens from the avatar: the account on top, everything else as tiles. -->
  <Transition name="panel">
    <div v-if="open" class="fixed inset-0 z-[55]" role="dialog" aria-modal="true" @click="emit('close')">
      <div class="absolute inset-0 bg-overlay/50 backdrop-blur-[7px]"></div>

      <aside class="panel glass-soft" @click.stop>
        <button type="button" class="me" @click="emit('action', 'profile')" v-ripple>
          <span class="w-14 h-14 shrink-0 rounded-[35%] overflow-hidden grid place-items-center shadow-sm">
            <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" alt="" />
            <span
              v-else
              class="w-full h-full grid place-items-center text-white text-lg font-semibold"
              :style="{ backgroundColor: colorFromString(me?.displayName || me?.username || 'U') }"
            >{{ initialsOf(me?.displayName || me?.username || 'U') }}</span>
          </span>
          <span class="flex-1 min-w-0 text-start">
            <span class="block font-semibold text-ink truncate"><bdi>{{ me?.displayName || '@' + (me?.username || '') }}</bdi></span>
            <span class="block text-[13px] text-muted truncate" dir="ltr">@{{ (me?.username || '').replace(/^@/, '') }}</span>
          </span>
          <ChevronRight class="w-4 h-4 text-muted rtl:-scale-x-100" />
        </button>

        <nav class="grid grid-cols-2 gap-2 mt-3">
          <button
            v-for="item in items"
            :key="item.action"
            type="button"
            class="tile"
            @click="emit('action', item.action)"
            v-ripple
          >
            <span class="tile-icon" :style="{ color: item.color, backgroundColor: `${item.color}22` }">
              <component :is="item.icon" class="w-5 h-5" />
            </span>
            <span class="text-[13.5px] font-medium text-ink">{{ $t(item.label) }}</span>
          </button>
        </nav>

        <div class="theme" role="radiogroup" :aria-label="$t('menu.nightMode')">
          <button
            v-for="option in themes"
            :key="option.value"
            type="button"
            role="radio"
            class="theme-option"
            :class="preferences.prefs.theme === option.value ? 'theme-option-on' : ''"
            :aria-checked="preferences.prefs.theme === option.value"
            :title="$t(`settings.themes.${option.value}`)"
            @click="preferences.prefs.theme = option.value"
          >
            <component :is="option.icon" class="w-4 h-4" />
            <span class="truncate">{{ $t(`settings.themes.${option.value}`) }}</span>
          </button>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { Bookmark, ChevronRight, MonitorCog, Moon, Settings, Sun, Users, UsersRound } from 'lucide-vue-next'
import { colorFromString, initialsOf } from '../utils/avatar'
import { usePreferencesStore } from '../stores/preferences'
import type { ChatUser } from '../types/chat'

type MenuAction = 'profile' | 'contacts' | 'saved' | 'settings' | 'newGroup'

const props = defineProps<{ open: boolean, me?: Partial<ChatUser> | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'action', a: MenuAction): void }>()

const preferences = usePreferencesStore()

const items: Array<{ action: MenuAction; label: string; icon: typeof Users; color: string }> = [
  { action: 'saved', label: 'menu.savedMessages', icon: Bookmark, color: '#11bfae' },
  { action: 'newGroup', label: 'groups.newGroup', icon: UsersRound, color: '#6366f1' },
  { action: 'contacts', label: 'menu.contacts', icon: Users, color: '#f59e0b' },
  { action: 'settings', label: 'menu.settings', icon: Settings, color: '#ec4899' }
]

const themes = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: MonitorCog }
] as const

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
@reference "../assets/tailwind.css";

.panel {
  @apply absolute top-2 start-2 w-[320px] max-w-[calc(100vw-1rem)] rounded-3xl p-3;
  transform-origin: top left;
}
:global([dir="rtl"]) .panel { transform-origin: top right; }

.me {
  @apply relative overflow-hidden w-full flex items-center gap-3 rounded-2xl p-2 hover:bg-ink/5 transition;
}
.tile {
  @apply relative overflow-hidden flex flex-col items-start gap-2 rounded-2xl p-3 text-start bg-ink/[.04] hover:bg-ink/[.08] active:scale-[.98] transition;
}
.tile-icon {
  @apply w-9 h-9 grid place-items-center rounded-[35%];
}

.theme {
  @apply mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-ink/[.05] p-1;
}
.theme-option {
  @apply flex items-center justify-center gap-1.5 rounded-xl px-1.5 py-1.5 text-[12.5px] text-muted hover:text-ink transition min-w-0;
}
.theme-option-on {
  @apply bg-surface text-ink shadow-sm;
}

.panel-enter-from, .panel-leave-to { opacity: 0; }
.panel-enter-active, .panel-leave-active { transition: opacity .16s ease; }
.panel-enter-active .panel { transition: transform .26s cubic-bezier(.2, 1.15, .35, 1); }
.panel-leave-active .panel { transition: transform .14s ease; }
.panel-enter-from .panel, .panel-leave-to .panel { transform: scale(.9) translateY(-6px); }
@media (prefers-reduced-motion: reduce) {
  .panel-enter-active .panel, .panel-leave-active .panel { transition: none; }
}
</style>
