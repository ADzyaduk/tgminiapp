<template>
  <div>
    <slot />
  </div>
</template>

<script setup lang="ts">
const ui = {
  // Define the locale for Nuxt UI components
  calendar: {
    locale: {
      months: [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
      ],
      weekdays: [
        'Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'
      ],
      weekdaysShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      firstDayOfWeek: 1, // Monday
      today: 'Сегодня',
      now: 'Сейчас'
    }
  }
}
</script> 