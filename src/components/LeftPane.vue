<template>
    <aside class="left-pane">
        <!-- label for debugging only -->
        <span>left pane</span>
    </aside>
</template>

<style scoped>
.left-pane {
    grid-area: left;
    width: var(--left-pane-width);
    background: var(--color-left-pane-bg);
    overflow: hidden;
    padding: var(--pane-padding);
}
</style>
