<template>
  <ModalSheet :open="open" @close="emit('close')">
    <div class="flex flex-col h-[min(620px,88dvh)] p-4">
      <div class="flex items-center gap-1 mb-3">
        <button v-if="step === 2" type="button" class="icon-btn" :aria-label="$t('common.back')" @click="step = 1">
          <ArrowLeft class="w-5 h-5 rtl:rotate-180" />
        </button>
        <h2 class="flex-1 text-lg font-semibold text-ink">
          {{ step === 1 ? $t('groups.addMembersTitle') : $t('groups.newGroup') }}
        </h2>
        <button type="button" class="icon-btn" :aria-label="$t('common.close')" @click="emit('close')">
          <X class="w-5 h-5" />
        </button>
      </div>

      <template v-if="step === 1">
        <MemberPicker v-model="memberIds" :people="people" class="flex-1 min-h-0" />
        <div class="pt-3 flex items-center justify-between gap-3 border-t border-line mt-2">
          <span class="text-sm text-muted">{{ $t('groups.selectedCount', { n: memberIds.length }) }}</span>
          <button type="button" class="btn-primary gap-1.5" @click="step = 2">
            <span>{{ $t('common.next') }}</span>
            <ArrowRight class="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </template>

      <form v-else class="flex-1 flex flex-col gap-4" @submit.prevent="create">
        <div class="flex items-center gap-3">
          <span class="w-16 h-16 shrink-0 rounded-full grid place-items-center text-white" :style="{ backgroundColor: colorFromString(title || 'group') }">
            <Users class="w-7 h-7" />
          </span>
          <label class="flex-1 space-y-1.5">
            <span class="text-sm text-muted">{{ $t('groups.groupName') }}</span>
            <input
              ref="titleInput"
              v-model="title"
              class="input w-full"
              dir="auto"
              :maxlength="TITLE_MAX"
              :placeholder="$t('groups.groupNamePlaceholder')"
            />
          </label>
        </div>

        <p class="flex items-start gap-2 text-xs text-muted">
          <Lock class="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{{ $t('groups.e2eeNote') }}</span>
        </p>

        <p class="text-sm text-muted">{{ $t('groups.membersCount', { n: memberIds.length + 1 }) }}</p>

        <p v-if="error" class="text-sm text-danger">{{ error }}</p>

        <div class="mt-auto flex justify-end">
          <button type="submit" class="btn-primary gap-1.5" :disabled="!title.trim() || busy">
            <Loader2 v-if="busy" class="w-4 h-4 animate-spin" />
            <span>{{ $t('groups.create') }}</span>
          </button>
        </div>
      </form>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Loader2, Lock, Users, X } from 'lucide-vue-next'
import ModalSheet from '../../components/ModalSheet.vue'
import MemberPicker, { type PickablePerson } from './MemberPicker.vue'
import { createGroup, getErrorMessage, type GroupDetails } from '../../services/api'
import { colorFromString } from '../../utils/avatar'

const TITLE_MAX = 64

const props = defineProps<{ open: boolean; people: PickablePerson[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'created', group: GroupDetails): void }>()

const step = ref<1 | 2>(1)
const memberIds = ref<string[]>([])
const title = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)

watch(() => props.open, open => {
  if (!open) return
  step.value = 1
  memberIds.value = []
  title.value = ''
  error.value = null
})

watch(step, async value => {
  if (value === 2) {
    await nextTick()
    titleInput.value?.focus()
  }
})

async function create() {
  if (!title.value.trim() || busy.value) return
  busy.value = true
  error.value = null
  try {
    emit('created', await createGroup(title.value.trim(), memberIds.value))
  } catch (err) {
    error.value = getErrorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>
