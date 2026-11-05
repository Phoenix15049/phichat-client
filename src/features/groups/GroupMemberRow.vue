<template>
  <li>
    <div class="flex items-center gap-3 rounded-xl px-3 py-1.5 hover:bg-ink/5 transition">
      <button type="button" class="flex-1 min-w-0 flex items-center gap-3 text-start" :disabled="member.userId === myId" @click="emit('open')">
        <span class="relative shrink-0">
          <span
            class="w-10 h-10 rounded-[35%] overflow-hidden grid place-items-center text-white text-sm font-semibold"
            :style="!member.avatarUrl ? { backgroundColor: colorFromString(label) } : {}"
          >
            <img v-if="member.avatarUrl" :src="member.avatarUrl" class="w-full h-full object-cover" alt="" />
            <template v-else>{{ initialsOf(label) }}</template>
          </span>
          <span v-if="online" class="absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full bg-accent ring-2 ring-surface"></span>
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-medium text-ink truncate">
            <bdi>{{ member.userId === myId ? $t('groups.you') : label }}</bdi>
          </span>
          <span class="block text-xs truncate" :class="online ? 'text-accent' : 'text-muted'">
            {{ online ? $t('chat.online') : '@' + member.username }}
          </span>
        </span>
      </button>
      <span v-if="member.role !== 'member'" class="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11.5px] font-medium text-accent">{{ $t(`groups.role.${member.role}`) }}</span>
      <button v-if="hasMenu" type="button" class="icon-btn w-8 h-8 shrink-0" :aria-label="$t('groups.memberOptions')" @click.stop="emit('menu', $event)">
        <EllipsisVertical class="w-4 h-4" />
      </button>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EllipsisVertical } from 'lucide-vue-next'
import type { GroupMemberItem } from '../../services/api'
import { colorFromString, initialsOf } from '../../utils/avatar'

const props = defineProps<{ member: GroupMemberItem; myId: string; online: boolean; hasMenu: boolean }>()
const emit = defineEmits<{ (e: 'open'): void; (e: 'menu', event: MouseEvent): void }>()

const label = computed(() => props.member.displayName || '@' + props.member.username)
</script>
