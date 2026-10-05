<template>
  <!-- Always LTR so the toggle and the padding stay on the same side whatever is typed. -->
  <div class="relative" dir="ltr">
    <input
      :id="id"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      class="input w-full pr-10"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
      spellcheck="false"
      autocapitalize="off"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 px-3 text-[#456173] hover:text-[#1B3C59]"
      :aria-label="visible ? $t('e2ee.hide') : $t('e2ee.show')"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" class="w-4 h-4" />
      <Eye v-else class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{
  modelValue: string
  id?: string
  autocomplete?: string
  autofocus?: boolean
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const visible = ref(false)
</script>
