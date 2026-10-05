<template>
  <ModalSheet :open="open" @close="$emit('close')">
    <div class="p-6 w-[520px] max-w-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-ink">{{ $t('profile.title') }}</h2>
        <button class="px-2 py-1 rounded text-muted hover:text-ink hover:bg-canvas"
                @click="$emit('close')" v-ripple :aria-label="$t('common.close')">
          <X class="w-5 h-5" />
        </button>

      </div>

      <!-- Top row -->
      <div class="flex items-center gap-4">
        <!-- Avatar -->
        <div class="w-20 h-20 rounded-full overflow-hidden ring-2 ring-canvas bg-canvas grid place-items-center">
          <img v-if="me?.avatarUrl" :src="me.avatarUrl" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full grid place-items-center text-white font-semibold
                             bg-gradient-to-br from-[#456173] to-[#1B3C59]">
            {{ initialsOf(me?.displayName || me?.username || 'U') }}
          </div>
        </div>

        <!-- Names -->
        <div class="min-w-0">
          <div class="text-xl font-bold text-ink truncate" dir="auto">
            <bdi>{{ me?.displayName || '@' + (me?.username || '') }}</bdi>
          </div>
          <div class="text-sm text-muted truncate">
            <span dir="ltr">@{{ (me?.username || '').replace(/^@/, '') }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-6 flex items-center justify-end gap-2">
        <button class="btn-primary inline-flex items-center gap-2" @click="$emit('edit')" v-ripple>
          <Pencil class="w-4 h-4" /><span>{{ $t('profile.edit') }}</span>
        </button>

      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { initialsOf } from '../utils/avatar'
import ModalSheet from './ModalSheet.vue'
import { X, Pencil } from 'lucide-vue-next'
import type { ChatUser } from '../types/chat'

defineProps<{
  open: boolean,
  me?: Partial<ChatUser> | null
}>()

defineEmits<{ (e:'close'):void; (e:'edit'):void }>()


</script>

<style scoped>
@reference "../assets/tailwind.css";

.btn-primary {
  @apply bg-accent text-white rounded-lg px-4 py-2 hover:bg-accent-strong transition disabled:opacity-60;
}

</style>
