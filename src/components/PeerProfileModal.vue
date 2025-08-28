<template>
  <ModalSheet :open="open" @close="$emit('close')">
    <div class="p-4 w-[520px] max-w-full">
      <div class="flex items-start gap-3">
        <img v-if="user?.avatarUrl" :src="user.avatarUrl" class="w-16 h-16 rounded-full object-cover" />
        <div v-else class="w-16 h-16 rounded-full bg-gray-300"></div>

        <div class="flex-1">
          <div class="text-lg font-semibold">
            {{ user?.displayName || '@' + (user?.username || '') }}
          </div>
          <div class="text-sm text-gray-600">
            @{{ user?.username }}
          </div>
          <div v-if="user?.lastSeenUtc" class="text-xs text-gray-500 mt-1">
            آخرین بازدید: {{ fmtLastSeen(user.lastSeenUtc) }}
          </div>
        </div>

        <button class="text-gray-500 hover:text-gray-700" @click="$emit('close')">✕</button>
      </div>

      <div class="mt-4 space-y-2 text-sm">
        <div v-if="user?.phoneNumber"><span class="text-gray-500">شماره:</span> {{ user.phoneNumber }}</div>
        <div v-if="user?.bio"><span class="text-gray-500">بیو:</span> {{ user.bio }}</div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="px-3 py-2 rounded bg-blue-600 text-white" @click="$emit('send-message', user!.id)">
          ارسال پیام
        </button>
        <button class="px-3 py-2 rounded border" @click="$emit('share-contact', user!)">
          اشتراک مخاطب
        </button>
        <button
          v-if="isContact"
          class="px-3 py-2 rounded border text-red-600"
          @click="$emit('remove-contact', user!.id)"
        >
          حذف از مخاطبین
        </button>
        <button
          v-else
          class="px-3 py-2 rounded border"
          @click="$emit('add-contact', user!.id)"
        >
          افزودن به مخاطبین
        </button>

        <button class="px-3 py-2 rounded border col-span-2 opacity-60 cursor-not-allowed" title="به‌زودی">
          بلاک کاربر
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

function fmtLastSeen(iso?: string) {
  if (!iso) return 'نامشخص'
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch { return 'نامشخص' }
}
</script>
