// stores/useDateStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { CalendarDate } from '@internationalized/date'

export const useDateStore = defineStore('date', () => {
  // инициализация сегодняшней даты
  const today = new Date()
  const selectedDate = ref(
    new CalendarDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
  )

  function setDate(date: CalendarDate) {
    selectedDate.value = date
  }

  return { selectedDate, setDate }
})
