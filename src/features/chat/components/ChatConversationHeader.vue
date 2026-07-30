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
import type {
  ObjectDirective
} from 'vue'

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

const rippleHandlers =
  new WeakMap<
    HTMLElement,
    (event: MouseEvent) => void
  >()

const vRipple:
  ObjectDirective<HTMLElement> = {
    mounted(element) {
      element.style.position ||=
        'relative'

      element.style.overflow ||=
        'hidden'

      const handler = (
        event: MouseEvent
      ) => {
        const rect =
          element.getBoundingClientRect()

        const size =
          Math.max(
            rect.width,
            rect.height
          ) * 1.1

        const ripple =
          document.createElement('span')

        ripple.className =
          'ripple-ink'

        ripple.style.width =
          `${size}px`

        ripple.style.height =
          `${size}px`

        ripple.style.left =
          `${
            event.clientX -
            rect.left -
            size / 2
          }px`

        ripple.style.top =
          `${
            event.clientY -
            rect.top -
            size / 2
          }px`

        element.appendChild(ripple)

        ripple.addEventListener(
          'animationend',
          () => ripple.remove(),
          {
            once: true
          }
        )
      }

      rippleHandlers.set(
        element,
        handler
      )

      element.addEventListener(
        'click',
        handler
      )
    },

    beforeUnmount(element) {
      const handler =
        rippleHandlers.get(element)

      if (handler) {
        element.removeEventListener(
          'click',
          handler
        )
      }

      rippleHandlers.delete(element)
    }
  }

function initialsOf(
  name: string
) {
  const normalized =
    (name || '').trim()

  if (!normalized) {
    return '؟'
  }

  const parts =
    normalized.split(/\s+/)

  return (
    parts.length === 1
      ? parts[0].slice(0, 2)
      : (
          parts[0][0] +
          parts[1][0]
        )
  ).toUpperCase()
}

function colorFromString(
  value: string
) {
  let hash = 0

  for (
    let index = 0;
    index < value.length;
    index++
  ) {
    hash =
      (
        hash * 31 +
        value.charCodeAt(index)
      ) >>> 0
  }

  return `hsl(${
    hash % 360
  } 65% 55%)`
}
</script>