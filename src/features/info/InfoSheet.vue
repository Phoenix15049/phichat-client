<template>
  <ModalSheet panel :open="open" @close="emit('close')">
    <div class="relative h-full overflow-hidden">
      <!-- The profile itself -->
      <div ref="scroller" class="h-full overflow-y-auto overscroll-contain" @scroll.passive="onScroll">
        <div class="hero">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" class="hero-back" />
          <div v-else class="hero-back" :style="{ background: `radial-gradient(90% 120% at 50% 0%, ${tint}, transparent)` }"></div>
          <div class="hero-fade"></div>

          <div class="relative flex flex-col items-center pt-8 pb-3 px-5 text-center">
            <div class="relative">
              <div class="hero-avatar" :style="!avatarUrl ? { backgroundColor: icon ? 'var(--color-accent)' : tint } : {}">
                <img v-if="avatarUrl" :src="avatarUrl" class="w-full h-full object-cover" alt="" />
                <component :is="icon" v-else-if="icon" class="w-11 h-11" />
                <template v-else>{{ initialsOf(name) }}</template>
              </div>
              <slot name="avatar" />
            </div>
            <div class="mt-3 max-w-full text-[20px] leading-7 font-bold text-ink truncate"><bdi>{{ name }}</bdi></div>
            <div class="text-[13.5px] truncate max-w-full" :class="online ? 'text-accent' : 'text-muted'">{{ status }}</div>
          </div>
        </div>

        <div class="px-3 pb-4 space-y-2.5">
          <slot />
        </div>
      </div>

      <!-- Once the big header has scrolled away, a small one takes its place -->
      <Transition name="bar">
        <div v-if="scrolled" class="bar">
          <div class="w-9 h-9 rounded-[35%] overflow-hidden grid place-items-center text-white text-xs font-semibold shrink-0" :style="!avatarUrl ? { backgroundColor: icon ? 'var(--color-accent)' : tint } : {}">
            <img v-if="avatarUrl" :src="avatarUrl" class="w-full h-full object-cover" alt="" />
            <component :is="icon" v-else-if="icon" class="w-4.5 h-4.5" />
            <template v-else>{{ initialsOf(name) }}</template>
          </div>
          <div class="min-w-0 flex-1 leading-tight">
            <div class="text-[14.5px] font-semibold text-ink truncate"><bdi>{{ name }}</bdi></div>
            <div class="text-[12px] truncate" :class="online ? 'text-accent' : 'text-muted'">{{ status }}</div>
          </div>
        </div>
      </Transition>

      <button type="button" class="close" :aria-label="$t('common.close')" @click="emit('close')">
        <X class="w-5 h-5" />
      </button>

      <!-- A page opened from here slides over it -->
      <Transition name="page">
        <section v-if="pageKey" :key="pageKey" class="page">
          <header class="h-14 shrink-0 flex items-center gap-1 px-2 border-b border-line">
            <button type="button" class="icon-btn" :aria-label="$t('common.back')" @click="emit('back')">
              <ArrowLeft class="w-5 h-5 rtl:rotate-180" />
            </button>
            <h3 class="flex-1 min-w-0 px-1 text-[16px] font-semibold text-ink truncate">{{ pageTitle }}</h3>
            <button type="button" class="icon-btn" :aria-label="$t('common.close')" @click="emit('close')">
              <X class="w-5 h-5" />
            </button>
          </header>
          <div class="flex-1 min-h-0 flex flex-col">
            <slot name="page" />
          </div>
        </section>
      </Transition>
    </div>
  </ModalSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { ArrowLeft, X } from 'lucide-vue-next'
import ModalSheet from '../../components/ModalSheet.vue'
import { colorFromString, initialsOf } from '../../utils/avatar'

const props = defineProps<{
  open: boolean
  name: string
  status: string
  online?: boolean
  avatarUrl?: string | null
  /** Stands in for the picture (Saved Messages, a group without a photo). */
  icon?: Component | null
  pageKey?: string | null
  pageTitle?: string
}>()

const emit = defineEmits<{ (e: 'close' | 'back'): void }>()

const tint = computed(() => colorFromString(props.name || 'x'))

const scroller = ref<HTMLElement | null>(null)
const scrolled = ref(false)

function onScroll() {
  scrolled.value = (scroller.value?.scrollTop ?? 0) > 150
}

watch(() => props.open, async open => {
  if (!open) return
  scrolled.value = false
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = 0
})
</script>

<style scoped>
@reference "../../assets/tailwind.css";

.hero {
  @apply relative overflow-hidden;
}
/* The picture's own colors wash the top of the sheet. */
.hero-back {
  @apply absolute inset-0 w-full h-full object-cover opacity-45;
  filter: blur(36px) saturate(150%);
  transform: scale(1.4);
}
.hero-fade {
  @apply absolute inset-0;
  background: linear-gradient(to bottom, transparent 30%, var(--color-surface));
}
.hero-avatar {
  @apply w-[104px] h-[104px] rounded-[35%] overflow-hidden grid place-items-center text-white text-3xl font-semibold;
  box-shadow: 0 10px 28px rgb(0 0 0 / .25), 0 0 0 3px color-mix(in srgb, var(--color-surface) 70%, transparent);
}
.bar {
  @apply absolute top-0 inset-x-0 z-10 h-14 flex items-center gap-2.5 ps-4 pe-14 border-b border-line;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}
.close {
  @apply absolute z-10 top-2 end-2 w-10 h-10 grid place-items-center rounded-full text-ink/80 hover:text-ink hover:bg-ink/10 transition;
}
.page {
  @apply absolute inset-0 z-20 flex flex-col bg-surface;
}
.bar-enter-from, .bar-leave-to { opacity: 0; transform: translateY(-8px); }
.bar-enter-active, .bar-leave-active { transition: opacity .14s ease, transform .14s ease; }
.page-enter-from { opacity: 0; transform: translateX(28px); }
.page-leave-to { opacity: 0; transform: translateX(28px); }
:global([dir="rtl"] .page-enter-from), :global([dir="rtl"] .page-leave-to) { transform: translateX(-28px); }
.page-enter-active { transition: opacity .16s ease, transform .2s cubic-bezier(.2, .9, .3, 1); }
.page-leave-active { transition: opacity .12s ease, transform .12s ease; }
</style>
