<template>
  <div v-if="open" class="fixed inset-0 z-[55]">
    <div class="absolute inset-0 bg-black/20" @click="$emit('close')"></div>

    <!-- Drawer -->
    <aside class="absolute left-0 top-0 h-full w-72 bg-white shadow-xl border-r
                   flex flex-col">
      <!-- Me header -->
      <div class="p-4 border-b flex items-center gap-3">
        <div class="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
          <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" />
          <span v-else class="text-xl">👤</span>
        </div>
        <div class="min-w-0">
          <div class="font-semibold truncate">{{ me?.displayName || 'بدون‌نام' }}</div>
          <div class="text-xs text-gray-500 truncate">@{{ (me?.username || '').replace(/^@/,'') }}</div>
        </div>
      </div>

      <!-- Items -->
      <nav class="flex-1 overflow-y-auto">
        <button class="w-full text-right px-4 py-3 hover:bg-gray-50 border-b"
                @click="$emit('action','profile')">پروفایل من</button>

        <button class="w-full text-right px-4 py-3 hover:bg-gray-50 border-b"
                @click="$emit('action','contacts')">مخاطبین</button>

        <button class="w-full text-right px-4 py-3 hover:bg-gray-50 border-b"
                @click="$emit('action','saved')">Saved Messages</button>

        <button class="w-full text-right px-4 py-3 hover:bg-gray-50 border-b"
                @click="$emit('action','settings')">تنظیمات</button>
      </nav>

      <div class="p-3 text-left">
        <button class="text-xs text-gray-500 hover:text-gray-700" @click="$emit('close')">بستن</button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
defineProps<{ open: boolean, me?: { displayName?: string; username?: string; avatarUrl?: string } | null }>()
defineEmits<{ (e:'close'):void; (e:'action', a:'profile'|'contacts'|'saved'|'settings'):void }>()
</script>
