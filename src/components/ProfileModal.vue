<template>
  <ModalSheet :open="open" @close="$emit('close')">
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">پروفایل</h2>
        <button class="text-gray-500 hover:text-gray-700" @click="$emit('close')">✕</button>
      </div>

      <div class="flex items-center gap-4">
        <div class="w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
          <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover"/>
          <span v-else class="text-3xl">👤</span>
        </div>
        <div class="min-w-0">
          <div class="text-xl font-bold truncate">{{ me?.displayName || 'بدون‌نام' }}</div>
          <div class="text-sm text-gray-500 truncate">@{{ (me?.username || '').replace(/^@/,'') }}</div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <button class="px-3 py-2 rounded bg-blue-600 text-white"
                @click="$emit('edit')">ویرایش پروفایل</button>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import ModalSheet from './ModalSheet.vue'
defineProps<{ open: boolean, me?: { displayName?: string; username?: string; avatarUrl?: string } | null }>()
defineEmits<{ (e:'close'):void; (e:'edit'):void }>()
</script>
