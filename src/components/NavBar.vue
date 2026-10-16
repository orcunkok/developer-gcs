<script setup>
defineProps({
  open: Boolean
})

defineEmits(['close'])

const items = ['settings', 'frames', 'logs']
</script>

<template>
    <div v-if="open" class="navbar-backdrop" @click="$emit('close')">
      <nav class="navbar" @click.stop>
        <button v-for="item in items" :key="item" class="navbar__box">{{ item }}</button>
      </nav>
    </div>
</template>

<style scoped>
.navbar-backdrop {
  position: fixed;
  inset: 0;
  top: var(--topbar-height);
  z-index: 99;
}

.navbar {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--left-pane-width);
  display: flex;
  flex-direction: column;
}

.navbar__box {
  width: 100%;
  aspect-ratio: 1;
  margin: 0;
  padding: 0;
  border: none;
  background: var(--color-picker-bg);
  color: var(--text);
  font-family: var(--font-mono);
  cursor: pointer;
}

</style>
