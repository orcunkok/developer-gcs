import { ref } from 'vue'
import { defineStore } from 'pinia'

const LAYOUT_CELLS = { '1x1': 1, '1x2': 2, '2x2': 4 }

// primary display grid and pane visibility; survives reloads via localStorage (edit mode does not)
export const useLayoutStore = defineStore(
  'layout',
  () => {
    const leftPaneOpen = ref(false)
    const rightPaneOpen = ref(false)
    const bottomStripOpen = ref(false)
    const layout = ref('1x1')
    const cells = ref(['map'])
    const editing = ref(false)
    const follow = ref([]) // vehicle keys the 3D camera follows; empty is free camera (not persisted)

    function selectLayout(l) {
      if (l === layout.value && editing.value) {
        editing.value = false
        return
      }
      layout.value = l
      const n = LAYOUT_CELLS[l]
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

    return { leftPaneOpen, rightPaneOpen, bottomStripOpen, layout, cells, editing, follow, selectLayout, assignView }
  },
  { persist: { pick: ['leftPaneOpen', 'rightPaneOpen', 'bottomStripOpen', 'layout', 'cells'] } },
)
