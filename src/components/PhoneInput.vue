<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import { COUNTRIES, type Country } from '../data/countries'
import { ChevronDown, Search } from 'lucide-vue-next'
import { intlLocale } from '../i18n'
import { supportsFlagEmoji } from '../utils/emojiSupport'

const props = defineProps<{
  modelValue: string | null | undefined,   // E.164 like +98912...
  defaultCountry?: string                  // ISO2 like 'IR'
  label?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

/** state */
const open = ref(false)
const q = ref('')
const defaultIso = (props.defaultCountry || 'IR').toUpperCase()
const selected = ref<Country>(COUNTRIES.find(c => c.iso2 === defaultIso) || COUNTRIES[0])
/** What the user sees: the national number formatted for the selected country. */
const display = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

/** Windows has no flag emoji (they show as two letters), so show the country code instead. */
const showFlags = supportsFlagEmoji()

const regionNames = (() => {
  try { return new (Intl as any).DisplayNames([intlLocale()], { type: 'region' }) } catch { return null }
})()

/** Country name in the UI language, falling back to the native name from the list. */
function countryName(country: Country): string {
  try { return regionNames?.of(country.iso2) || country.name } catch { return country.name }
}

const digits = computed(() => display.value.replace(/\D/g, ''))

/** Formats as you type, e.g. 09112523174 -> "0911 252 3174" for Iran. */
function format(value: string): string {
  const raw = value.replace(/\D/g, '')
  if (!raw) return ''
  try {
    const iso = selected.value.iso2 as CountryCode
    const formatted = new AsYouType(iso).input(raw)
    // Typed without the national "0" (e.g. 9112523174): format as if it were there, then drop it.
    if (!/\s/.test(formatted) && raw.length > 4 && !raw.startsWith('0')) {
      const withTrunk = new AsYouType(iso).input('0' + raw)
      if (/\s/.test(withTrunk) && withTrunk.startsWith('0')) return withTrunk.slice(1).trimStart()
    }
    return formatted
  } catch {
    return raw
  }
}

function onInput(event: Event) {
  const element = event.target as HTMLInputElement
  const digitsBeforeCaret = element.value.slice(0, element.selectionStart ?? element.value.length).replace(/\D/g, '').length
  display.value = format(element.value)

  // Keep the caret after the same digit once spaces are inserted or removed.
  void nextTick(() => {
    let seen = 0
    let position = 0
    while (position < display.value.length && seen < digitsBeforeCaret) {
      if (/\d/.test(display.value[position])) seen++
      position++
    }
    element.setSelectionRange(position, position)
  })
}

/** parse initial modelValue (if provided) */
onMounted(() => {
  const value = props.modelValue
  if (!value) return
  const parsed = parsePhoneNumberFromString(value)
  const match = COUNTRIES.find(c => c.iso2 === parsed?.country) ?? COUNTRIES.find(c => value.startsWith('+' + c.dial))
  if (match) {
    selected.value = match
    display.value = parsed ? parsed.formatNational() : format(value.replace('+' + match.dial, ''))
  }
})

/** Full E.164 to emit. Uses the country's real rules (Italy keeps its leading 0, Iran drops it). */
const e164 = computed(() => {
  const raw = digits.value
  if (!raw) return null
  const parsed = parsePhoneNumberFromString(raw, selected.value.iso2 as CountryCode)
  if (parsed?.number) return parsed.number as string
  return '+' + selected.value.dial + raw.replace(/^0+/, '')
})

watch(e164, v => emit('update:modelValue', v))

/** filtering dropdown */
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return COUNTRIES
  const sClean = s.replace(/[\s+]/g, '')
  return COUNTRIES.filter(c =>
    countryName(c).toLowerCase().includes(s) ||
    c.name.toLowerCase().includes(s) ||
    c.iso2.toLowerCase() === s ||
    c.dial.startsWith(sClean)
  )
})

function pick(c: Country) {
  selected.value = c
  open.value = false
  q.value = ''
  display.value = format(display.value)
  emit('update:modelValue', e164.value)
}

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    await nextTick()
    searchInput.value?.focus()
  }
}
function close() { open.value = false }
</script>

<template>
  <div class="w-full">
    <label v-if="label" class="mb-1 block text-sm text-muted">{{ label }}</label>

    <div class="relative">
      <!-- shell: phone numbers always read left-to-right, even in an RTL layout -->
      <div
        dir="ltr"
        class="flex items-stretch bg-surface rounded-xl ring-1 ring-line overflow-hidden
               focus-within:ring-2 focus-within:ring-accent/60 transition"
      >
        <!-- country button (left) -->
        <button
          type="button"
          class="px-3 flex items-center gap-1.5 border-e border-line bg-surface-2 hover:brightness-95 text-ink disabled:opacity-50"
          :disabled="disabled"
          :aria-label="countryName(selected)"
          @click="toggle"
        >
          <span v-if="showFlags" class="text-lg emoji-font">{{ selected.flag }}</span>
          <span v-else class="text-[11px] font-semibold text-muted">{{ selected.iso2 }}</span>
          <span class="text-sm">+{{ selected.dial }}</span>
          <ChevronDown class="w-4 h-4 text-muted transition-transform" :class="open ? 'rotate-180' : ''" />
        </button>

        <!-- national number input -->
        <input
          :disabled="disabled"
          :value="display"
          inputmode="tel"
          autocomplete="tel-national"
          :placeholder="$t('phone.placeholder')"
          class="flex-1 min-w-0 px-3 py-2 bg-transparent outline-none text-ink tracking-wide placeholder:text-muted placeholder:tracking-normal"
          @input="onInput"
        />
      </div>

      <!-- dropdown: fixed search header, scrolling list below it -->
      <transition name="dropdown">
        <div
          v-if="open"
          class="absolute z-20 mt-2 w-full flex flex-col max-h-80 rounded-xl bg-surface shadow-xl ring-1 ring-line overflow-hidden"
        >
          <div class="shrink-0 p-2 border-b border-line">
            <div class="relative">
              <Search class="w-4 h-4 text-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref="searchInput"
                v-model="q"
                type="search"
                :placeholder="$t('phone.searchCountry')"
                class="w-full h-9 rounded-full bg-surface-2 ps-9 pe-3 text-sm text-ink placeholder:text-muted outline-none focus:ring-2 ring-accent/50"
                @keydown.stop
              />
            </div>
          </div>

          <ul class="flex-1 overflow-y-auto py-1">
            <li v-for="c in filtered" :key="c.iso2">
              <button
                type="button"
                class="w-full text-start px-3 py-2 hover:bg-surface-2 flex items-center gap-3 transition"
                :class="c.iso2 === selected.iso2 ? 'bg-accent-soft' : ''"
                @click="pick(c)"
              >
                <span v-if="showFlags" class="text-lg emoji-font">{{ c.flag }}</span>
                <span v-else class="w-7 text-[11px] font-semibold text-muted">{{ c.iso2 }}</span>
                <span class="flex-1 min-w-0 truncate text-ink">{{ countryName(c) }}</span>
                <span class="text-muted text-sm" dir="ltr">+{{ c.dial }}</span>
              </button>
            </li>
            <li v-if="!filtered.length" class="px-3 py-4 text-center text-sm text-muted">{{ $t('chat.noSearchResults') }}</li>
          </ul>
        </div>
      </transition>
    </div>

    <!-- show chosen E.164 -->
    <p v-if="e164" class="mt-1 text-xs text-muted"><span dir="ltr">{{ e164 }}</span></p>
  </div>

  <!-- click outside to close -->
  <div v-if="open" class="fixed inset-0 z-10" @click="close"></div>
</template>

<style scoped>
/* dropdown animation */
.dropdown-enter-from { opacity: 0; transform: translateY(6px) scale(.98); }
.dropdown-leave-to   { opacity: 0; transform: translateY(4px) scale(.98); }
.dropdown-enter-active,
.dropdown-leave-active { transition: opacity .14s ease, transform .14s ease; }
</style>
