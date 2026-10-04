<template>
  <div
    class="bg-[#1B3C59] text-white p-3 cursor-pointer select-none"
    role="button"
    aria-label="View contact profile"
    @click="
      !props.selectionMode &&
      props.selectedUser &&
      emit('open-profile')
    "
  >
    <Transition
      name="slide-down"
      mode="out-in"
    >
      <!-- Selection header -->
      <div
        v-if="props.selectionMode"
        key="selection"
        class="flex items-center gap-3"
      >
        <button
          v-ripple
          type="button"
          class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-0.5"
          :disabled="!props.selectedCount"
          title="Group Forward"
          @click.stop="
            emit('forward-selected')
          "
        >
          Forward

          <span
            class="inline-flex items-center justify-center text-[11px] min-w-[18px] h-[18px] px-1 rounded-full bg-white text-blue-700"
          >
            {{ props.selectedCount }}
          </span>
        </button>

        <button
          v-ripple
          type="button"
          class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50"
          :disabled="!props.selectedCount"
          @click.stop="
            emit('delete-selected')
          "
        >
          Delete
        </button>

        <button
          v-ripple
          type="button"
          class="px-2 py-1 rounded hover:bg-white/10 disabled:opacity-50"
          :disabled="!props.selectedCount"
          @click.stop="
            emit('copy-selected')
          "
        >
          Copy text
        </button>

        <div class="flex-1"></div>

        <button
          v-ripple
          type="button"
          class="px-2 py-1 rounded hover:bg-white/10"
          @click.stop="
            emit('clear-selection')
          "
        >
          Cancel
        </button>
      </div>

      <!-- Normal header -->
      <div
        v-else
        key="normal"
        class="flex items-center gap-3"
      >
        <button
          v-if="props.showBack"
          v-ripple
          type="button"
          class="ml-1 px-2 py-1 rounded hover:bg-white/10"
          title="Back"
          aria-label="Back"
          @click.stop="emit('back')"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>

        <div
          v-if="
            props.isNarrow &&
            props.selectedUser
          "
          class="relative shrink-0"
          @click.stop="
            emit('open-profile')
          "
        >
          <div
            class="w-9 h-9 rounded-full overflow-hidden bg-white/10 grid place-items-center"
          >
            <img
              v-if="props.avatarUrl"
              :src="props.avatarUrl"
              class="w-full h-full object-cover"
              alt=""
            />

            <div
              v-else
              class="w-full h-full grid place-items-center text-sm font-semibold"
              :style="{
                backgroundColor:
                  colorFromString(
                    props.selectedLabel ||
                    props.selectedUser.username
                  )
              }"
            >
              <span class="text-white">
                {{
                  initialsOf(
                    props.selectedLabel
                  )
                }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="props.selectedUser"
          class="min-w-0 select-none"
          @click.stop="
            emit('open-profile')
          "
        >
          <div
            class="truncate text-[15px] leading-5 font-semibold"
          >
            {{ props.selectedLabel }}
          </div>

          <div
            class="flex items-center gap-2 leading-4"
          >
            <template
              v-if="props.isPeerTyping"
            >
              <div
                class="flex items-center gap-1 text-[13px] text-[#A78BFA]"
              >
                <span
                  class="inline-block w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-bounce"
                  style="animation-delay: 0ms"
                ></span>

                <span
                  class="inline-block w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-bounce"
                  style="animation-delay: 120ms"
                ></span>

                <span
                  class="inline-block w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-bounce"
                  style="animation-delay: 240ms"
                ></span>

                <span>typing</span>
              </div>
            </template>

            <template
              v-else-if="
                props.isPeerOnline
              "
            >
              <div
                class="text-[12px] text-white"
              >
                Online
              </div>
            </template>

            <template v-else>
              <div
                class="text-[12px] text-white/70 truncate"
              >
                {{ props.peerStatus }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { colorFromString, initialsOf } from '../../../utils/avatar'

import {
  ArrowLeft
} from 'lucide-vue-next'

import type {
  ChatUser
} from '../../../types/chat'

type HeaderUser =
  Pick<ChatUser, 'id' | 'username'>

const props = defineProps<{
  selectionMode: boolean
  selectedCount: number

  selectedUser:
    HeaderUser | null

  selectedLabel: string
  isNarrow: boolean
  showBack: boolean

  avatarUrl:
    string | null

  isPeerTyping: boolean
  isPeerOnline: boolean
  peerStatus: string
}>()

const emit = defineEmits<{
  (
    event: 'open-profile'
  ): void

  (
    event: 'back'
  ): void

  (
    event: 'forward-selected'
  ): void

  (
    event: 'delete-selected'
  ): void

  (
    event: 'copy-selected'
  ): void

  (
    event: 'clear-selection'
  ): void
}>()



</script>