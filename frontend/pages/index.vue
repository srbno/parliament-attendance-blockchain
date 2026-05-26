<script setup lang="ts">
const { role } = useAuth()
await navigateTo(role.value === 'DEPUTY' ? '/deputy/submit' : '/sessions', { replace: true })
</script>

<template>
  <div />
</template>
