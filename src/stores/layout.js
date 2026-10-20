import { ref } from 'vue'
import { defineStore } from 'pinia'

const GRID_CELLS = { '1x1': 1, '1x2': 2, '2x2': 4 }

// primary display grid, pane visibility and overlays; panes and grid survive reloads via localStorage
export const useLayoutStore = defineStore(
    'layout',
    () => {
        const leftPaneOpen = ref(false)
        const rightPaneOpen = ref(false)
        const bottomStripOpen = ref(false)
        const navbarOpen = ref(false)
        const grid = ref('1x1')
        const cells = ref(['map'])
        const editing = ref(false) // picking the grid and the view in each cell
        const follow = ref([]) // vehicle ids the 3D camera follows; empty is free camera

        function selectGrid(g) {
            if (g === grid.value && editing.value) {
                editing.value = false
                return
            }
            grid.value = g
            const n = GRID_CELLS[g]
            const next = cells.value.slice(0, n)
            while (next.length < n) next.push(null)
            cells.value = next
        }

        function assignView(i, id) {
            const next = cells.value.slice()
            const j = next.indexOf(id)
            if (j !== -1 && j !== i) next[j] = next[i]
            next[i] = id
            cells.value = next
        }

        return { leftPaneOpen, rightPaneOpen, bottomStripOpen, navbarOpen, grid, cells, editing, follow, selectGrid, assignView }
    },
    { persist: { pick: ['leftPaneOpen', 'rightPaneOpen', 'bottomStripOpen', 'grid', 'cells'] } },
)
