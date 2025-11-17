export default defineAppConfig({
  ui: {
    // Global UI configuration
    icons: {
      // Make sure heroicons are properly configured
      dynamic: true // Enable dynamic icon loading for all icons
    },
    // Отключаем загрузку шрифтов из fontshare
    fonts: false,
    // Explicitly register UI components to fix missing component issues
    primary: 'blue',
    gray: 'slate',
    configProvider: {},
    dropdown: {},
    notification: {},
    calendar: {},
    progress: {},
    button: {},
    modal: {},
    alert: {},
    avatar: {},
    badge: {},
    card: {},
    icon: {},
    toggle: {},
    input: {},
    textarea: {},
    select: {},
    formGroup: {},
    table: {},
    // Add locale configuration
    strategy: 'override',
    global: {
      // Empty as we're handling this via UiLocaleProvider
    }
  }
}) 