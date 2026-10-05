<template>
  <section class="mt-5 rounded-xl bg-[#F2F2F0] p-4 space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm font-medium text-[#1B3C59]">
        <ShieldCheck class="w-4 h-4 text-[#11BFAE]" />
        <span>{{ $t('e2ee.securityCode') }}</span>
      </div>
      <span v-if="verified" class="inline-flex items-center gap-1 text-xs text-emerald-700">
        <BadgeCheck class="w-4 h-4" /> {{ $t('e2ee.verified') }}
      </span>
    </div>

    <div v-if="loading" class="flex justify-center py-2 text-[#456173]">
      <Loader2 class="w-5 h-5 animate-spin" />
    </div>

    <p v-else-if="!code" class="text-sm text-[#456173]">{{ $t('e2ee.noPeerKey') }}</p>

    <template v-else>
      <div dir="ltr" class="grid grid-cols-4 gap-x-3 gap-y-1 font-mono text-[15px] tracking-wider text-[#1B3C59] text-center select-all">
        <span v-for="(group, i) in code.groups" :key="i">{{ group }}</span>
      </div>

      <p class="text-xs leading-5 text-[#456173]">{{ $t('e2ee.securityCodeHint', { name: isolate(props.peerName) }) }}</p>

      <button
        type="button"
        class="btn-outline w-full text-sm"
        @click="toggleVerified"
      >
        {{ verified ? $t('e2ee.unverify') : $t('e2ee.markVerified') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-vue-next'
import { useE2eeStore } from '../../stores/e2ee'
import { isolate } from '../../utils/username'

const props = defineProps<{ peerId: string; peerName: string }>()

const e2ee = useE2eeStore()
const loading = ref(false)
const code = ref<{ groups: string[]; keyId: string } | null>(null)
const verified = ref(false)

async function load() {
  loading.value = true
  code.value = null
  try {
    code.value = await e2ee.securityCode(props.peerId)
    verified.value = !!code.value && e2ee.isVerified(props.peerId, code.value.keyId)
  } catch {
    code.value = null
  } finally {
    loading.value = false
  }
}

async function toggleVerified() {
  await e2ee.trustPeerKey(props.peerId, !verified.value)
  verified.value = !verified.value
}

watch(() => props.peerId, () => void load(), { immediate: true })
</script>
