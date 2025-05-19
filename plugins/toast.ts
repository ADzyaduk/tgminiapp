import { useToast as useNuxtToast } from '#ui/composables/useToast'

export default defineNuxtPlugin(() => {
  return {
    provide: {
      toast: {
        success: (message: string) => {
          useNuxtToast().add({
            title: 'Успешно',
            description: message,
            icon: 'i-heroicons-check-circle',
            color: 'green'
          })
        },
        error: (message: string) => {
          useNuxtToast().add({
            title: 'Ошибка',
            description: message,
            icon: 'i-heroicons-x-circle',
            color: 'red'
          })
        },
        info: (message: string) => {
          useNuxtToast().add({
            title: 'Информация',
            description: message,
            icon: 'i-heroicons-information-circle',
            color: 'blue'
          })
        },
        warning: (message: string) => {
          useNuxtToast().add({
            title: 'Предупреждение',
            description: message,
            icon: 'i-heroicons-exclamation-triangle',
            color: 'yellow'
          })
        },
        raw: useNuxtToast()
      }
    }
  }
}) 