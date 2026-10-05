<template>
  <router-view />
</template>

<script setup lang="ts">
import { usePreferencesStore } from './stores/preferences'

// Applies the theme and text size, and keeps following the system theme when selected.
usePreferencesStore()
</script>
