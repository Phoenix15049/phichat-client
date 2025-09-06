<template>
  <!-- overlay fades; sheet pops -->
  <transition name="fade-overlay">
    <div v-if="open" class="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div class="absolute inset-0 bg-black/30" @click="$emit('close')" @contextmenu.prevent="$emit('close')"></div>

      <transition name="sheet-pop">
        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                 bg-white rounded-2xl shadow-xl ring-1 ring-black/5
                 w-[520px] max-w-[95vw] max-h-[90vh] overflow-auto"
        >
          <slot/>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e:'close'):void }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
@reference "tailwindcss";

/* overlay fade */
.fade-overlay-enter-from { opacity: 0; }
.fade-overlay-enter-active,
.fade-overlay-leave-active { transition: opacity .16s ease; }
.fade-overlay-leave-to { opacity: 0; }

/* modal pop */
.sheet-pop-enter-from { opacity: 0; transform: translate(-50%, -52%) scale(.98); }
.sheet-pop-leave-to   { opacity: 0; transform: translate(-50%, -48%) scale(.98); }
.sheet-pop-enter-active,
.sheet-pop-leave-active { transition: opacity .18s ease, transform .18s ease; }
</style>
