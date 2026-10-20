<template>
    <aside class="right-pane">
        <!-- label for debugging only -->
        <span>right pane</span>
    </aside>
</template>

<style scoped>
.right-pane {
    grid-area: right;
    width: var(--right-pane-width);
    background: var(--color-right-pane-bg);
    overflow: hidden;
    padding: var(--pane-padding);
}
</style>
