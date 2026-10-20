<template>
    <footer class="bottom-strip">
        <!-- label for debugging only -->
        <span>time river</span>
    </footer>
</template>

<style scoped>
.bottom-strip {
    grid-area: bottom;
    height: var(--bottom-strip-height);
    background: var(--color-bottom-strip-bg);
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
