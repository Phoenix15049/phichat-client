<template>
  <div
    class="flex flex-col border-gray-200"
    :class="
      props.isNarrow
        ? 'w-full border-r-0'
        : 'w-80 md:w-96 border-r'
    "
  >
    <div
      class="px-3 py-2 font-semibold text-gray-800 border-b border-gray-200 flex items-center justify-between"
    >
      <button
        class="px-2 py-1 rounded hover:bg-gray-100"
        aria-label="Open menu"
        @click="emit('open-menu')"
      >
        <Menu class="w-5 h-5" />
      </button>

      <span>Chats</span>
      <span class="w-6"></span>
    </div>

    <div class="flex-1 overflow-y-auto">
      <button
        v-for="conversation in props.conversations"
        :key="conversation.peerId"
        v-ripple
        class="relative overflow-hidden w-full px-3 py-3 border-b border-gray-100 hover:bg-[#11BFAE]/5 flex gap-3 items-center text-left"
        :class="{
          'bg-[#11BFAE]/10':
            props.selectedUserId ===
            conversation.peerId
        }"
        @click.stop="
          emit('select', conversation)
        "
        @dblclick.stop="
          emit('select', conversation)
        "
      >
        <span
          v-if="
            props.selectedUserId ===
            conversation.peerId
          "
          class="absolute left-0 top-0 h-full w-[3px] bg-[#11BFAE] rounded-r"
        ></span>

        <div
          class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"
        >
          <div
            class="relative w-10 h-10 overflow-hidden flex items-center justify-center"
          >
            <span
              v-if="
                props.onlineIds.has(
                  conversation.peerId
                )
              "
              class="absolute bottom-0 right-0 w-2.5 h-2.5 z-10 bg-green-500 rounded-full ring-2 ring-white"
            ></span>

            <div
              class="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center"
              :style="
                !props.avatarById[
                  conversation.peerId
                ]
                  ? {
                      backgroundColor:
                        colorFromString(
                          props.displayById[
                            conversation.peerId
                          ] ||
                            conversation.username
                        )
                    }
                  : {}
              "
            >
              <img
                v-if="
                  props.avatarById[
                    conversation.peerId
                  ]
                "
                :src="
                  props.avatarById[
                    conversation.peerId
                  ] || ''
                "
                class="w-full h-full object-cover"
              />

              <span
                v-else
                class="text-white text-sm"
              >
                {{
                  initialsOf(
                    props.displayById[
                      conversation.peerId
                    ] ||
                      conversation.displayName ||
                      conversation.username
                  )
                }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div
            class="flex items-center justify-between"
          >
            <div
              class="font-medium truncate max-w-[10rem]"
              :class="
                props.selectedUserId ===
                conversation.peerId
                  ? 'text-[#1B3C59]'
                  : 'text-gray-900'
              "
            >
              {{
                conversation.displayName ||
                '@' + conversation.username
              }}
            </div>

            <div
              class="text-[11px] text-gray-500 whitespace-nowrap"
            >
              {{
                formatRelativeEn(
                  conversation.lastSentAt ||
                    null
                )
              }}
            </div>
          </div>

          <div
            class="text-xs text-gray-500 flex items-center gap-1"
          >
            <span
              class="truncate max-w-[12rem]"
            >
              <template
                v-if="
                  conversation.lastFileUrl
                "
              >
                [Media]
              </template>

              <template v-else>
                {{
                  conversation.lastPreview ||
                  ''
                }}
              </template>
            </span>

            <span
              v-if="
                conversation.unreadCount > 0
              "
              class="ml-2 inline-flex items-center justify-center rounded-full bg-[#11BFAE] text-white text-[11px] min-w-[18px] px-1"
            >
              {{
                conversation.unreadCount
              }}
            </span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Menu } from 'lucide-vue-next'
import { formatRelativeEn } from '../../../utils/time'
import type { UiConversation } from '../../../types/chat'

const props = defineProps<{
  conversations: UiConversation[]
  selectedUserId: string | null
  isNarrow: boolean
  onlineIds: Set<string>
  avatarById: Record<string, string | null>
  displayById: Record<string, string | null>
}>()

const emit = defineEmits<{
  (
    event: 'select',
    conversation: UiConversation
  ): void

  (event: 'open-menu'): void
}>()

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || '?'
  )
}

function colorFromString(value: string) {
  let hash = 0

  for (
    let index = 0;
    index < value.length;
    index++
  ) {
    hash =
      value.charCodeAt(index) +
      ((hash << 5) - hash)
  }

  return `hsl(${Math.abs(hash) % 360} 55% 45%)`
}
</script>