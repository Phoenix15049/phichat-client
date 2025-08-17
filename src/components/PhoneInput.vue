<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { COUNTRIES, type Country } from '../data/countries'

// props
const props = defineProps<{
  modelValue: string | null | undefined,   // E.164 like +98912...
  defaultCountry?: string                  // ISO2 like 'IR'
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ (e:'update:modelValue', v:string|null):void }>()

// state
const open = ref(false)
const q = ref('')
const defaultIso = (props.defaultCountry || 'IR').toUpperCase()
const selected = ref<Country>(COUNTRIES.find(c => c.iso2 === defaultIso) || COUNTRIES[0])
const national = ref('') // user types national part (no code)
const box = ref<HTMLElement|null>(null)

// parse initial modelValue (if given)
onMounted(() => {
  if (!props.modelValue) return
  const m = props.modelValue
  // try find country by prefix
  const match = COUNTRIES.find(c => m?.startsWith('+' + c.dial))
  if (match) {
    selected.value = match
    national.value = (m || '').replace('+' + match.dial, '').replace(/\D/g, '')
  }
})

// computed: full E.164
const e164 = computed(() => {
  const nat = (national.value || '').replace(/\D/g, '')
  if (!nat) return null
  // drop leading zero(s) to avoid 00912...
  const natNorm = nat.replace(/^0+/, '')
  return '+' + selected.value.dial + natNorm
})

// emit on change
watch(e164, v => emit('update:modelValue', v))

// dropdown filter
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return COUNTRIES
  return COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(s) ||
    c.iso2.toLowerCase().includes(s) ||
    ('+'+c.dial).includes(s.replace(/\s/g,''))
  )
})

function pick(c: Country) {
  selected.value = c
  open.value = false
  // re-emit with new code
  emit('update:modelValue', e164.value)
}

function toggle() { if (!props.disabled) open.value = !open.value }
function close() { open.value = false }
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="mb-1 block text-sm text-gray-600">{{ label }}</label>

    <div class="relative">
      <!-- shell -->
      <div class="flex items-stretch border rounded-lg overflow-hidden bg-white">
        <!-- country button -->
        <button type="button"
                class="px-3 flex items-center gap-2 border-l bg-gray-50 hover:bg-gray-100"
                @click="toggle" :disabled="disabled">
          <span class="text-lg">{{ selected.flag }}</span>
          <span class="text-sm text-gray-700">+{{ selected.dial }}</span>
          <svg class="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clip-rule="evenodd" />
          </svg>
        </button>

        <!-- national number input -->
        <input
          :disabled="disabled"
          v-model="national"
          inputmode="numeric"
          autocomplete="tel"
          placeholder="شماره..."
          class="flex-1 px-3 py-2 outline-none"
        />
      </div>

      <!-- dropdown -->
      <div v-if="open"
           class="absolute z-20 mt-2 w-full max-h-80 overflow-auto rounded-lg border bg-white shadow">
        <div class="p-2 sticky top-0 bg-white">
          <input v-model="q" placeholder="جستجو کشور یا کد…"
                 class="w-full border rounded px-3 py-2 outline-none" />
        </div>
        <ul>
          <li v-for="c in filtered" :key="c.iso2">
            <button type="button"
                    class="w-full text-right px-3 py-2 hover:bg-gray-50 flex items-center gap-3"
                    @click="pick(c)">
              <span class="text-lg">{{ c.flag }}</span>
              <span class="flex-1">
                <span class="font-medium">{{ c.name }}</span>
                <span class="text-gray-500 text-xs mr-2">{{ c.iso2 }}</span>
              </span>
              <span class="text-gray-600">+{{ c.dial }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- show value -->
    <p v-if="e164" class="mt-1 text-xs text-gray-500">شماره کامل: {{ e164 }}</p>
  </div>

  <!-- click outside to close -->
  <div v-if="open" class="fixed inset-0 z-10" @click="close"></div>
</template>
