<template>
  <div
    v-if="props.selectedUser || props.selectionMode"
    class="h-14 shrink-0 bg-surface border-b border-line px-2 sm:px-3 flex items-center select-none"
  >
    <Transition name="slide-down" mode="out-in">
      <!-- Selection header -->
      <div v-if="props.selectionMode" key="selection" class="flex-1 flex items-center gap-1">
        <button type="button" class="icon-btn" :aria-label="$t('common.cancel')" @click.stop="emit('clear-selection')">
          <X class="w-5 h-5" />
        </button>

        <div class="px-1 font-semibold text-ink">
          {{ $t('chat.selectedCount', { count: props.selectedCount }) }}
        </div>

        <div class="flex-1"></div>

        <button
          type="button"
          class="icon-btn"
          :disabled="!props.selectedCount"
          :title="$t('chat.copyText')"
          :aria-label="$t('chat.copyText')"
          @click.stop="emit('copy-selected')"
        >
          <Copy class="w-5 h-5" />
        </button>

        <button
          type="button"
          class="icon-btn"
          :disabled="!props.selectedCount"
          :title="$t('chat.groupForward')"
          :aria-label="$t('chat.groupForward')"
          @click.stop="emit('forward-selected')"
        >
          <Forward class="w-5 h-5 rtl:-scale-x-100" />
        </button>

        <button
          type="button"
          class="icon-btn hover:!text-danger"
          :disabled="!props.selectedCount"
          :title="$t('common.delete')"
          :aria-label="$t('common.delete')"
          @click.stop="emit('delete-selected')"
        >
          <Trash2 class="w-5 h-5" />
        </button>
      </div>

      <!-- Normal header -->
      <div v-else key="normal" class="flex-1 min-w-0 flex items-center gap-2">
        <button
          v-if="props.showBack"
          type="button"
          class="icon-btn shrink-0"
          :title="$t('common.back')"
          :aria-label="$t('common.back')"
          @click.stop="emit('back')"
        >
          <ArrowLeft class="w-5 h-5 rtl:rotate-180" />
        </button>

        <button
          v-if="props.selectedUser"
          type="button"
          class="flex-1 min-w-0 flex items-center gap-3 rounded-xl px-1.5 py-1 text-start hover:bg-surface-2 transition"
          :aria-label="$t('chat.viewProfile')"
          @click.stop="emit('open-profile')"
        >
          <div class="relative shrink-0">
            <div class="w-10 h-10 rounded-full overflow-hidden grid place-items-center">
              <img v-if="props.avatarUrl" :src="props.avatarUrl" class="w-full h-full object-cover" alt="" />
              <div
                v-else
                class="w-full h-full grid place-items-center text-sm font-semibold text-white"
                :style="{ backgroundColor: colorFromString(props.selectedLabel || props.selectedUser.username) }"
              >
                {{ initialsOf(props.selectedLabel) }}
              </div>
            </div>
            <span
              v-if="props.isPeerOnline"
              class="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-accent ring-2 ring-surface"
            ></span>
          </div>

          <div class="min-w-0">
            <div class="truncate text-[15px] leading-5 font-semibold text-ink">
              <bdi>{{ props.selectedLabel }}</bdi>
            </div>

            <div class="h-4 flex items-center text-[12.5px] leading-4">
              <div v-if="props.isPeerTyping" class="flex items-center gap-1 text-accent">
                <span class="typing-dot"></span>
                <span class="typing-dot" style="animation-delay: 150ms"></span>
                <span class="typing-dot" style="animation-delay: 300ms"></span>
                <span class="ms-0.5">{{ $t('chat.typing') }}</span>
              </div>
              <div v-else-if="props.isPeerOnline" class="text-accent">{{ $t('chat.online') }}</div>
              <div v-else class="text-muted truncate">{{ props.peerStatus }}</div>
            </div>
          </div>
        </button>

        <button
          v-if="props.selectedUser"
          type="button"
          class="icon-btn shrink-0"
          :title="$t('chat.searchInChat')"
          :aria-label="$t('chat.searchInChat')"
          @click.stop="emit('search')"
        >
          <Search class="w-5 h-5" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { colorFromString, initialsOf } from '../../../utils/avatar'
import { ArrowLeft, Copy, Forward, Search, Trash2, X } from 'lucide-vue-next'
import type { ChatUser } from '../../../types/chat'

type HeaderUser = Pick<ChatUser, 'id' | 'username'>

const props = defineProps<{
  selectionMode: boolean
  selectedCount: number
  selectedUser: HeaderUser | null
  selectedLabel: string
  isNarrow: boolean
  showBack: boolean
  avatarUrl: string | null
  isPeerTyping: boolean
  isPeerOnline: boolean
  peerStatus: string
}>()

const emit = defineEmits<{
  (event: 'open-profile'): void
  (event: 'back'): void
  (event: 'forward-selected'): void
  (event: 'delete-selected'): void
  (event: 'copy-selected'): void
  (event: 'clear-selection'): void
  (event: 'search'): void
}>()
</script>

<style scoped>
@reference "../../../assets/tailwind.css";

.typing-dot {
  @apply inline-block w-1.5 h-1.5 rounded-full bg-current;
  animation: typing 1s infinite ease-in-out;
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: .5; }
  30% { transform: translateY(-3px); opacity: 1; }
}

/* header (selection/non-selection) slide */
.slide-down-enter-from { transform: translateY(-6px); opacity: 0; }
.slide-down-enter-active { transition: transform .1s ease, opacity .1s ease; }
.slide-down-leave-active { transition: transform .08s ease, opacity .08s ease; }
.slide-down-leave-to { transform: translateY(-4px); opacity: 0; }
</style>
