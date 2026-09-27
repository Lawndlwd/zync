let paneSeq = 0

export const newPaneId = () => `pane-${Date.now()}-${paneSeq++}`
