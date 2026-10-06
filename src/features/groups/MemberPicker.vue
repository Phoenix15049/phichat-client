<template>
  <div class="flex flex-col min-h-0">
    <div class="relative mb-2">
      <Search class="w-4 h-4 text-muted absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
      <input
        v-model="query"
        type="search"
        class="input w-full ps-9"
        dir="auto"
        :placeholder="$t('groups.searchPeople')"
      />
    </div>

    <div v-if="selected.length" class="flex flex-wrap gap-1.5 mb-2">
      <button
        v-for="person in selectedPeople"
        :key="person.id"
        type="button"
        class="inline-flex items-center gap-1 rounded-full bg-accent-soft text-ink text-[13px] ps-1 pe-2 py-0.5"
        @click="toggle(person.id)"
      >
        <Avatar :person="person" size="w-6 h-6 text-[10px]" />
        <bdi class="max-w-[9rem] truncate">{{ label(person) }}</bdi>
        <X class="w-3.5 h-3.5 text-muted" />
      </button>
    </div>

    <ul class="flex-1 min-h-0 overflow-y-auto -mx-1" role="listbox" aria-multiselectable="true">
      <li v-for="person in filtered" :key="person.id">
        <button
          type="button"
          role="option"
          :aria-selected="selected.includes(person.id)"
          class="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 text-start hover:bg-surface-2 transition"
          @click="toggle(person.id)"
        >
          <Avatar :person="person" size="w-10 h-10 text-sm" />
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-ink truncate"><bdi>{{ label(person) }}</bdi></span>
            <span class="block text-xs text-muted truncate" dir="ltr">@{{ person.username }}</span>
          </span>
          <span
            class="w-5 h-5 shrink-0 grid place-items-center rounded-full border-2 transition"
            :class="selected.includes(person.id) ? 'bg-accent border-accent text-white' : 'border-line'"
          ><Check v-if="selected.includes(person.id)" class="w-3 h-3" :stroke-width="3" /></span>
        </button>
      </li>
      <li v-if="!filtered.length" class="py-6 text-center text-sm text-muted">{{ $t('groups.noPeople') }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { Check, Search, X } from 'lucide-vue-next'
import { colorFromString, initialsOf } from '../../utils/avatar'
import { normalizeForSearch } from '../chat/composables/useMessageSearch'

export type PickablePerson = {
  id: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
}

const props = defineProps<{ people: PickablePerson[]; modelValue: string[] }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>()

const query = ref('')
const selected = computed(() => props.modelValue)
const selectedPeople = computed(() => props.people.filter(p => props.modelValue.includes(p.id)))

const label = (person: PickablePerson) => person.displayName || '@' + person.username

const filtered = computed(() => {
  const q = normalizeForSearch(query.value.trim().replace(/^@/, ''))
  if (!q) return props.people
  return props.people.filter(p =>
    normalizeForSearch(p.displayName ?? '').includes(q) || p.username.toLowerCase().includes(q))
})

function toggle(id: string) {
  emit('update:modelValue', props.modelValue.includes(id)
    ? props.modelValue.filter(x => x !== id)
    : [...props.modelValue, id])
}

const Avatar = defineComponent({
  props: { person: { type: Object as PropType<PickablePerson>, required: true }, size: { type: String, required: true } },
  setup(p) {
    return () => {
      const name = p.person.displayName || p.person.username
      return h('span', {
        class: `${p.size} shrink-0 rounded-full overflow-hidden grid place-items-center text-white font-semibold`,
        style: p.person.avatarUrl ? undefined : { backgroundColor: colorFromString(name) }
      }, p.person.avatarUrl
        ? [h('img', { src: p.person.avatarUrl, alt: '', class: 'w-full h-full object-cover' })]
        : initialsOf(name))
    }
  }
})
</script>
