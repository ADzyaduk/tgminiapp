import { defineStore } from 'pinia'
import { useSupabaseClient } from '#imports'
import { useBoatImages } from '~/composables/useBoatImages'

export const useGroupTripsStore = defineStore('groupTrips', {
  state: () => ({
    trips: [],
    activeTrip: null,
    isLoading: false,
    lastUpdated: null,
    loadedBoatIds: new Set(),
    unsubscribe: null
  }),
  
  getters: {
    // Поездки, доступные для бронирования (только те, которые собираются и имеют свободные места)
    bookableTrips: (state) => state.trips.filter(trip => 
      trip.status === 'scheduled' && 
      trip.available_seats > 0
    ),
    
    // Получить все текущие поездки (для менеджеров)
    currentTrips: (state) => state.trips.filter(trip => 
      ['scheduled', 'in_progress'].includes(trip.status)
    ),
    
    // Завершенные поездки (для истории и отчетов)
    completedTrips: (state) => state.trips.filter(trip => 
      trip.status === 'completed'
    ),
    
    // Поездки для конкретной лодки
    getTripsForBoat: (state) => (boatId) => 
      state.trips.filter(trip => trip.boat_id === boatId)
  },
  
  actions: {
    /**
     * Загрузка групповых поездок для конкретной лодки
     */
    async loadGroupTripsForBoat(boatId, forceRefresh = false) {
      // Если мы уже загрузили поездки для этой лодки и не нужно обновлять, то выходим
      if (this.loadedBoatIds.has(boatId) && !forceRefresh) {
        return
      }
      
      try {
        this.isLoading = true
        const supabaseClient = useSupabaseClient()
        
        const { data, error } = await supabaseClient
          .from('group_trips')
          .select(`
            *,
            boat:boats(id, name, slug)
          `)
          .eq('boat_id', boatId)
          .order('start_time', { ascending: true })
        
        if (error) {
          console.error('Error loading group trips:', error)
          throw error
        }
        
        // Если у нас уже есть поездки для других лодок, добавляем эти в список
        // Иначе заменяем весь список
        if (this.loadedBoatIds.size > 0 && !forceRefresh) {
          // Удаляем существующие поездки для этой лодки, если они есть
          const otherBoatTrips = this.trips.filter(trip => trip.boat_id !== boatId)
          this.trips = [...otherBoatTrips, ...(data || [])]
        } else {
          this.trips = data || []
        }
        
        // Запоминаем, что мы загрузили поездки для этой лодки
        this.loadedBoatIds.add(boatId)
        this.lastUpdated = new Date()
        
      } catch (error) {
        console.error('Error in loadGroupTripsForBoat:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },
    
    /**
     * Загрузка всех доступных групповых поездок (для любой лодки)
     */
    async loadAllBookableTrips() {
      try {
        this.isLoading = true
        const supabaseClient = useSupabaseClient()
        
        const { data, error } = await supabaseClient
          .from('group_trips')
          .select(`
            *,
            boat:boats(id, name, slug)
          `)
          .eq('status', 'scheduled') // Только со статусом "scheduled" (собирается группа)
          .gt('available_seats', 0)   // Только с доступными местами
          .order('start_time', { ascending: true })
        
        if (error) {
          console.error('Error loading available trips:', error)
          throw error
        }
        
        this.trips = data || []
        this.lastUpdated = new Date()
        
      } catch (error) {
        console.error('Error in loadAllBookableTrips:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    },
    
    /**
     * Создание новой групповой поездки
     */
    async createGroupTrip(tripData) {
      try {
        const supabaseClient = useSupabaseClient()
        const { data, error } = await supabaseClient
          .from('group_trips')
          .insert(tripData)
          .select(`
            *,
            boat:boats(id, name, slug)
          `)
        
        if (error) throw error
        
        // Обновляем локальное состояние
        if (data && data[0]) {
          this.trips.push(data[0])
          this.lastUpdated = new Date()
        }
        
        return { data, error: null }
      } catch (error) {
        console.error('Error creating group trip:', error)
        return { data: null, error }
      }
    },
    
    /**
     * Обновление статуса поездки или количества мест
     */
    async updateGroupTrip(tripId, updateData) {
      try {
        const supabaseClient = useSupabaseClient()
        const { data, error } = await supabaseClient
          .from('group_trips')
          .update(updateData)
          .eq('id', tripId)
          .select(`
            *,
            boat:boats(id, name, slug)
          `)
        
        if (error) throw error
        
        // Обновляем локальное состояние
        if (data && data[0]) {
          const index = this.trips.findIndex(trip => trip.id === tripId)
          if (index !== -1) {
            // Сохраняем данные о лодке из существующей записи, если в обновленных данных их нет
            if (this.trips[index].boat && !data[0].boat) {
              data[0].boat = this.trips[index].boat;
            }
            this.trips[index] = { ...this.trips[index], ...data[0] }
            this.lastUpdated = new Date()
          }
        }
        
        return { data, error: null }
      } catch (error) {
        console.error('Error updating group trip:', error)
        return { data: null, error }
      }
    },
    
    /**
     * Обновление количества свободных мест для поездки
     */
    async updateTripSeats(tripId, availableSeats) {
      return this.updateGroupTrip(tripId, { available_seats: availableSeats })
    },
    
    /**
     * Отправка лодки (изменение статуса на "в пути")
     */
    async startTrip(tripId) {
      return this.updateGroupTrip(tripId, { status: 'in_progress' })
    },
    
    /**
     * Завершение поездки
     */
    async completeTrip(tripId) {
      return this.updateGroupTrip(tripId, { status: 'completed' })
    },
    
    /**
     * Отмена поездки
     */
    async cancelTrip(tripId) {
      return this.updateGroupTrip(tripId, { status: 'cancelled' })
    },
    
    /**
     * Установка активной поездки (для бронирования и т.д.)
     */
    setActiveTrip(trip) {
      this.activeTrip = trip
    },
    
    /**
     * Подписка на обновления групповых поездок в реальном времени
     */
    subscribeToTrips() {
      const supabaseClient = useSupabaseClient()
      
      if (this.unsubscribe) {
        // Если уже подписаны, сначала очищаем
        this.unsubscribe()
      }
      
      const subscription = supabaseClient
        .channel('group_trips_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'group_trips' 
        }, (payload) => {
          // Real-time обновления групповых поездок
          this.handleRealTimeUpdate(payload)
        })
        .subscribe()
      
      // Сохраняем функцию отписки
      this.unsubscribe = () => {
        subscription.unsubscribe()
      }
    },
    
    /**
     * Загрузка одной поездки с информацией о лодке
     */
    async loadTripWithBoatInfo(tripId) {
      const supabaseClient = useSupabaseClient()
      
      const { data, error } = await supabaseClient
        .from('group_trips')
        .select(`
          *,
          boat:boats(id, name, slug)
        `)
        .eq('id', tripId)
        .single()
      
      if (error) {
        console.error('Error loading trip with boat info:', error)
        return null
      }
      
      return data
    },
    
    /**
     * Очистка подписок
     */
    cleanup() {
      if (this.unsubscribe) {
        this.unsubscribe()
        this.unsubscribe = null
      }
    },
    
    /**
     * Получение URL изображения лодки по slug
     */
    getBoatImageUrl(boat) {
      if (boat && boat.slug) {
        const { primary } = useBoatImages(boat);
        if (primary.value) return primary.value;
      }
      return '/images/default-boat.jpg';
    }
  }
}) 