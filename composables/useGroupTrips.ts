import { ref, computed } from 'vue'
import { useSupabaseSafe } from '~/composables/useSupabaseSafe'

// Create a state that will be shared across components
const groupTrips = ref([])
const activeTrip = ref(null)
const isLoading = ref(false)
const lastUpdated = ref(null)

// We use this to keep track of which boat IDs we've loaded
const loadedBoatIds = ref(new Set())

// Export the composable
export const useGroupTrips = () => {
  const supabaseClient = useSupabaseSafe()
  
  /**
   * Load group trips for a specific boat
   */
  const loadGroupTripsForBoat = async (boatId: string, forceRefresh = false) => {
    // If we've already loaded this boat's trips and don't need to refresh, return
    if (loadedBoatIds.value.has(boatId) && !forceRefresh) {
      return
    }
    
    try {
      isLoading.value = true
      
      const { data, error } = await supabaseClient
        .from('group_trips')
        .select('*')
        .eq('boat_id', boatId)
        .order('start_time', { ascending: true })
      
      if (error) {
        console.error('Error loading group trips:', error)
        throw error
      }
      
      // If we already have trips for other boats, add these to the list
      // Otherwise, replace the entire list
      if (loadedBoatIds.value.size > 0 && !forceRefresh) {
        // Remove existing trips for this boat if any
        const otherBoatTrips = groupTrips.value.filter(trip => trip.boat_id !== boatId)
        groupTrips.value = [...otherBoatTrips, ...(data || [])]
      } else {
        groupTrips.value = data || []
      }
      
      // Remember we've loaded this boat's trips
      loadedBoatIds.value.add(boatId)
      lastUpdated.value = new Date()
      
    } catch (error) {
      console.error('Error in loadGroupTripsForBoat:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Load all available group trips (for any boat)
   */
  const loadAllAvailableTrips = async () => {
    try {
      isLoading.value = true
      
      const { data, error } = await supabaseClient
        .from('group_trips')
        .select('*')
        .in('status', ['scheduled', 'in_progress'])
        .gt('available_seats', 0)
        .gt('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
      
      if (error) {
        console.error('Error loading available trips:', error)
        throw error
      }
      
      groupTrips.value = data || []
      lastUpdated.value = new Date()
      
    } catch (error) {
      console.error('Error in loadAllAvailableTrips:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Create a new group trip
   */
  const createGroupTrip = async (tripData) => {
    try {
      const { data, error } = await supabaseClient
        .from('group_trips')
        .insert(tripData)
        .select()
      
      if (error) throw error
      
      // Update local state
      if (data && data[0]) {
        groupTrips.value = [...groupTrips.value, data[0]]
        lastUpdated.value = new Date()
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Error creating group trip:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Update a group trip's status or seats
   */
  const updateGroupTrip = async (tripId, updateData) => {
    try {
      const { data, error } = await supabaseClient
        .from('group_trips')
        .update(updateData)
        .eq('id', tripId)
        .select()
      
      if (error) throw error
      
      // Update local state
      if (data && data[0]) {
        const index = groupTrips.value.findIndex(trip => trip.id === tripId)
        if (index !== -1) {
          groupTrips.value[index] = { ...groupTrips.value[index], ...updateData }
          // Create a new array to trigger reactivity
          groupTrips.value = [...groupTrips.value]
          lastUpdated.value = new Date()
        }
      }
      
      return { data, error: null }
    } catch (error) {
      console.error('Error updating group trip:', error)
      return { data: null, error }
    }
  }
  
  /**
   * Update available seats for a trip
   */
  const updateTripSeats = async (tripId, availableSeats) => {
    return updateGroupTrip(tripId, { available_seats: availableSeats })
  }
  
  /**
   * Start a scheduled trip (change status to in_progress)
   */
  const startTrip = async (tripId) => {
    return updateGroupTrip(tripId, { status: 'in_progress' })
  }
  
  /**
   * Complete a trip that's in progress
   */
  const completeTrip = async (tripId) => {
    return updateGroupTrip(tripId, { status: 'completed' })
  }
  
  /**
   * Cancel a trip
   */
  const cancelTrip = async (tripId) => {
    return updateGroupTrip(tripId, { status: 'cancelled' })
  }
  
  /**
   * Set the active trip (for booking, etc.)
   */
  const setActiveTrip = (trip) => {
    activeTrip.value = trip
  }
  
  /**
   * Get trips for a specific boat
   */
  const getTripsForBoat = (boatId) => {
    return computed(() => 
      groupTrips.value.filter(trip => trip.boat_id === boatId)
    )
  }
  
  /**
   * Get all scheduled and in-progress trips with available seats
   */
  const getAvailableTrips = computed(() => 
    groupTrips.value.filter(trip => 
      ['scheduled', 'in_progress'].includes(trip.status) && 
      trip.available_seats > 0 &&
      new Date(trip.start_time) > new Date()
    )
  )
  
  /**
   * Get current (scheduled and in-progress) trips
   */
  const getCurrentTrips = computed(() => 
    groupTrips.value.filter(trip => 
      ['scheduled', 'in_progress'].includes(trip.status)
    )
  )
  
  /**
   * Get completed trips
   */
  const getCompletedTrips = computed(() => 
    groupTrips.value.filter(trip => trip.status === 'completed')
  )
  
  /**
   * Listen for real-time updates to group trips
   */
  const subscribeToTrips = () => {
    // Проверяем, отключен ли realtime
    if (supabaseClient.isRealtimeDisabled) {
      console.log('Realtime отключен, используем polling для обновления групповых поездок')
      // Используем polling вместо realtime
      const pollInterval = setInterval(() => {
        loadAllAvailableTrips()
      }, 30000) // Обновляем каждые 30 секунд
      
      // Return function to unsubscribe
      return () => {
        clearInterval(pollInterval)
      }
    }
    
    const channel = supabaseClient
      .channel('group_trips_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_trips' }, (payload) => {
        // Обрабатываем real-time обновления
        handleRealtimeUpdate(payload)
      })
      .subscribe()
    
    // Return function to unsubscribe
    return () => {
      channel.unsubscribe()
    }
  }
  
  return {
    // State
    groupTrips,
    activeTrip,
    isLoading,
    lastUpdated,
    
    // Getters
    getAvailableTrips,
    getCurrentTrips,
    getCompletedTrips,
    getTripsForBoat,
    
    // Actions
    loadGroupTripsForBoat,
    loadAllAvailableTrips,
    createGroupTrip,
    updateGroupTrip,
    updateTripSeats,
    startTrip,
    completeTrip,
    cancelTrip,
    setActiveTrip,
    subscribeToTrips
  }
} 