<template>
  <ModalSheet narrow :open="!!code" @close="emit('close')">
    <div class="p-5 flex flex-col items-center text-center">
      <div v-if="loading" class="py-10 text-muted"><Loader2 class="w-6 h-6 animate-spin" /></div>

      <template v-else-if="preview">
        <div class="w-24 h-24 rounded-[35%] overflow-hidden grid place-items-center text-white" :style="!preview.avatarUrl ? { backgroundColor: colorFromString(preview.title) } : {}">
          <img v-if="preview.avatarUrl" :src="preview.avatarUrl" class="w-full h-full object-cover" alt="" />
          <Users v-else class="w-10 h-10" />
        </div>
        <div class="mt-3 text-[18px] font-bold text-ink"><bdi>{{ preview.title }}</bdi></div>
        <div class="text-sm text-muted">{{ $t('groups.membersCount', { n: preview.memberCount }) }}</div>
        <p v-if="preview.description" class="mt-2 text-sm text-ink whitespace-pre-wrap" dir="auto">{{ preview.description }}</p>
        <p class="mt-3 flex items-start gap-1.5 text-[12px] leading-5 text-muted text-start">
          <Lock class="w-3.5 h-3.5 shrink-0 mt-[3px]" /><span>{{ $t('groups.e2eeNote') }}</span>
        </p>
      </template>

      <p v-if="error" class="py-4 text-sm text-danger">{{ error }}</p>

      <div class="mt-4 w-full grid grid-cols-2 gap-2">
        <button type="button" class="btn-outline" @click="emit('close')">{{ $t('common.cancel') }}</button>
        <button type="button" class="btn-primary gap-1.5" :disabled="!preview || joining" @click="join">
          <Loader2 v-if="joining" class="w-4 h-4 animate-spin" />
          <span>{{ preview?.isMember ? $t('groups.openGroup') : $t('groups.join') }}</span>
        </button>
      </div>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Loader2, Lock, Users } from 'lucide-vue-next'
import ModalSheet from '../../components/ModalSheet.vue'
import { getErrorMessage, getGroupInvite, joinGroupInvite, type GroupDetails, type GroupInvitePreview } from '../../services/api'
import { colorFromString } from '../../utils/avatar'

const props = defineProps<{ code: string | null }>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'joined', group: GroupDetails): void
  (e: 'open', groupId: string): void
}>()

const preview = ref<GroupInvitePreview | null>(null)
const loading = ref(false)
const joining = ref(false)
const error = ref<string | null>(null)

watch(() => props.code, async code => {
  preview.value = null
  error.value = null
  if (!code) return

  loading.value = true
  try {
    preview.value = await getGroupInvite(code)
  } catch (err) {
    error.value = getErrorMessage(err)
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function join() {
  const code = props.code
  if (!code || !preview.value || joining.value) return

  if (preview.value.isMember) {
    emit('open', preview.value.groupId)
    return
  }

  joining.value = true
  error.value = null
  try {
    emit('joined', await joinGroupInvite(code))
  } catch (err) {
    error.value = getErrorMessage(err)
  } finally {
    joining.value = false
  }
}
</script>
