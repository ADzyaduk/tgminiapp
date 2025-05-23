import { useGroupTripsStore } from '~/stores/groupTrips'

export default defineNuxtPlugin(async (nuxtApp) => {
  // Only run on client-side
  if (process.server) return
  
  const groupTripsStore = useGroupTripsStore()
  
  // Set up realtime subscription
  groupTripsStore.subscribeToTrips()
  
  // Load all bookable trips on app mount
  nuxtApp.hook('app:beforeMount', () => {
    groupTripsStore.loadAllBookableTrips()
  })
  
  // Clean up on app unmount
  nuxtApp.hook('app:unmount', () => {
    groupTripsStore.cleanup()
  })
}) 