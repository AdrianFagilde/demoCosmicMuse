import { useCallback, useState } from 'react'
import { students as initialStudents, tasks as initialTasks } from '../data/academy'

const useStudentData = (studentId) => {
  const [studentsState, setStudentsState] = useState(() => initialStudents.map((s) => ({ ...s })))
  const [tasksState, setTasksState] = useState(() => initialTasks.map((t) => ({ ...t })))

  const student = studentsState.find((s) => String(s.id) === String(studentId))

  const studentTasks = student ? tasksState.filter((t) => t.student === student.name) : []

  const saveMetrics = useCallback(
    (progress, attendance) => {
      setStudentsState((prev) =>
        prev.map((s) =>
          String(s.id) === String(studentId)
            ? { ...s, progress: Number(progress), attendance: Number(attendance) }
            : s,
        ),
      )
    },
    [studentId],
  )

  const addTask = useCallback(
    (title, userName) => {
      if (!student) return
      const nextId = Math.max(0, ...tasksState.map((t) => t.id)) + 1
      const task = {
        id: nextId,
        title,
        description: '',
        student: student.name,
        assignedBy: userName,
        dueDate: new Date().toISOString().slice(0, 10),
        status: 'Pendiente',
        progress: 0,
      }
      setTasksState((prev) => [task, ...prev])
    },
    [student, tasksState],
  )

  const changeTaskStatus = useCallback((taskId, status) => {
    setTasksState((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
  }, [])

  return {
    student,
    studentsState,
    tasksState,
    studentTasks,
    saveMetrics,
    addTask,
    changeTaskStatus,
  }
}

export default useStudentData
