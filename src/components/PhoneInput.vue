<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { COUNTRIES, type Country } from '../data/countries'


const props = defineProps<{
  modelValue: string | null | undefined,   // E.164 like +98912...
  defaultCountry?: string                  // ISO2 like 'IR'
  label?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ (e:'update:modelValue', v:string|null):void }>()

/** state */
const open = ref(false)
const q = ref('')
const defaultIso = (props.defaultCountry || 'IR').toUpperCase()
const selected = ref<Country>(COUNTRIES.find(c => c.iso2 === defaultIso) || COUNTRIES[0])
const national = ref('') // only national part (no +code)

/** parse initial modelValue (if provided) */
onMounted(() => {
  if (!props.modelValue) return
  const m = props.modelValue
  const match = COUNTRIES.find(c => m?.startsWith('+' + c.dial))
  if (match) {
    selected.value = match
    national.value = (m || '').replace('+' + match.dial, '').replace(/\D/g, '')
  }
})

/** computed: full E.164 to emit */
const e164 = computed(() => {
  const nat = (national.value || '').replace(/\D/g, '')
  if (!nat) return null
  const natNorm = nat.replace(/^0+/, '') // drop leading zeros
  return '+' + selected.value.dial + natNorm
})

watch(e164, v => emit('update:modelValue', v))

/** filtering dropdown */
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return COUNTRIES
  const sClean = s.replace(/\s/g,'')
  return COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(s) ||
    c.iso2.toLowerCase().includes(s) ||
    ('+'+c.dial).includes(sClean)
  )
})

function pick(c: Country) {
  selected.value = c
  open.value = false
  emit('update:modelValue', e164.value)
}

function toggle() { if (!props.disabled) open.value = !open.value }
function close()  { open.value = false }

/** ripple directive (local, like other views) */
const vRipple = {
  mounted(el: HTMLElement) {
    el.style.position ||= 'relative'
    el.style.overflow ||= 'hidden'
    el.addEventListener('click', (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.1
      const span = document.createElement('span')
      span.className = 'ripple-ink'
      span.style.width = span.style.height = `${size}px`
      span.style.left = `${e.clientX - rect.left - size/2}px`
      span.style.top  = `${e.clientY - rect.top  - size/2}px`
      el.appendChild(span)
      span.addEventListener('animationend', () => span.remove())
    })
  }
}
</script>

<template>
  <div class="w-full" dir="ltr">
    <label v-if="label" class="mb-1 block text-sm text-[#456173]">{{ label }}</label>

    <div class="relative">
      <!-- shell -->
      <div
        class="flex items-stretch bg-white border rounded-lg overflow-hidden
               focus-within:ring-2 focus-within:ring-[#11BFAE]/50 focus-within:border-[#11BFAE]
               transition"
      >
        <!-- country button (left) -->
        <button
          type="button"
          class="px-3 flex items-center gap-2 border-r bg-[#F2F2F0] hover:bg-[#F2F2F0]/70
                 text-[#1B3C59] disabled:opacity-50"
          @click="toggle"
          :disabled="disabled"
          v-ripple
        >
          <span class="text-lg">{{ selected.flag }}</span>
          <span class="text-sm">+{{ selected.dial }}</span>
          <svg class="w-4 h-4 text-[#456173] transition-transform"
               :class="open ? 'rotate-180' : ''"
               viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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
          placeholder="Phone number"
          class="flex-1 px-3 py-2 outline-none text-[#1B3C59] placeholder:text-[#456173] selection:bg-[#11BFAE]/20"
        />
      </div>

      <!-- dropdown -->
      <transition name="dropdown">
        <div
          v-if="open"
          class="absolute z-20 mt-2 w-full max-h-80 overflow-auto rounded-lg border bg-white shadow-xl ring-1 ring-black/5"
        >
          <div class="p-2 sticky top-0 bg-white border-b">
            <input
              v-model="q"
              placeholder="Search country or code…"
              class="pi-input w-full"
              @keydown.stop
            />
          </div>
          <ul>
            <li v-for="c in filtered" :key="c.iso2">
              <button
                type="button"
                class="w-full text-left px-3 py-2 hover:bg-[#11BFAE]/5 flex items-center gap-3 transition"
                :class="c.iso2 === selected.iso2 ? 'bg-[#11BFAE]/5' : ''"
                @click="pick(c)"
                v-ripple
              >
                <span class="text-lg">{{ c.flag }}</span>
                <span class="flex-1 min-w-0">
                  <span class="font-medium text-[#1B3C59] truncate">{{ c.name }}</span>
                  <span class="text-[#456173] text-xs ml-2">{{ c.iso2 }}</span>
                </span>
                <span class="text-[#1B3C59]">+{{ c.dial }}</span>
              </button>
            </li>
          </ul>
        </div>
      </transition>
    </div>

    <!-- show chosen E.164 -->
    <p v-if="e164" class="mt-1 text-xs text-[#456173]">{{ e164 }}</p>
  </div>

  <!-- click outside to close -->
  <div v-if="open" class="fixed inset-0 z-10" @click="close"></div>
</template>

<style scoped>
@reference "tailwindcss";

/* dropdown animation */
.dropdown-enter-from { opacity: 0; transform: translateY(6px) scale(.98); }
.dropdown-leave-to   { opacity: 0; transform: translateY(4px) scale(.98); }
.dropdown-enter-active,
.dropdown-leave-active { transition: opacity .14s ease, transform .14s ease; }

/* search input (unified look with palette) */
.pi-input {
  @apply border rounded-lg px-3 py-2 outline-none bg-white
         focus:ring-2 focus:ring-[#11BFAE]/60 focus:border-[#11BFAE];
  @apply text-[#1B3C59] placeholder:text-[#456173];
}

/* ripple ink (global so dynamic span is styled) */
:global(.ripple-ink) {
  position: absolute;
  border-radius: 9999px;
  background: currentColor;
  opacity: .15;
  transform: scale(0);
  pointer-events: none;
  animation: ripple .5s ease-out forwards;
}
@keyframes ripple { to { transform: scale(4); opacity: 0; } }
</style>
