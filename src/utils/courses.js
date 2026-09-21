export const computeStats = (tasks, progressRows = [], studentId = null) => {
  const items = tasks.flatMap((task) => task.task_checklist_items || [])
  const relevant =
    studentId === null ? progressRows : progressRows.filter((row) => row.student_id === studentId)
  const doneIds = new Set(relevant.map((row) => row.item_id))
  const done = items.filter((item) => doneIds.has(item.id)).length
  return {
    totalItems: items.length,
    doneItems: done,
    percent: items.length > 0 ? Math.round((done / items.length) * 100) : 0,
    doneByTask: Object.fromEntries(
      tasks.map((task) => [
        task.id,
        (task.task_checklist_items || []).filter((item) => doneIds.has(item.id)).length,
      ]),
    ),
  }
}
