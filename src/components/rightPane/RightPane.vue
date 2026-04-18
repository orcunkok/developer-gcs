<script setup>
import Chat from "./Chat.vue";
</script>

<template>
  <aside class="right-pane">
    <Chat />
  </aside>
</template>

<style scoped>
.right-pane {
  grid-area: right;
  width: var(--right-pane-width);
  border-left: 1px solid var(--border);
  background: #b0e0e6;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px;
}
</style>
