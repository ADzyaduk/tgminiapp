import { defineStore } from 'pinia'
import { useSupabaseClient } from '#imports'

interface Notification {
  id: string
  userId: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  createdAt: string
  metadata?: any
}

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    notifications: [] as Notification[],
    unreadCount: 0,
    isLoading: false
  }),

  actions: {
    async fetchNotifications(userId: string) {
      if (!userId) return
      
      this.isLoading = true
      
      const supabase = useSupabaseClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (!error && data) {
        this.notifications = data.map(n => ({
          id: n.id,
          userId: n.user_id,
          message: n.message,
          type: n.type,
          read: n.read,
          createdAt: n.created_at,
          metadata: n.metadata
        }))
        
        this.unreadCount = data.filter(n => !n.read).length
      }
      
      this.isLoading = false
    },
    
    async markAsRead(notificationId: string) {
      const supabase = useSupabaseClient()
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
      
      if (!error) {
        const notification = this.notifications.find(n => n.id === notificationId)
        if (notification && !notification.read) {
          notification.read = true
          this.unreadCount -= 1
        }
      }
    },
    
    async markAllAsRead(userId: string) {
      const supabase = useSupabaseClient()
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
      
      if (!error) {
        this.notifications.forEach(n => {
          n.read = true
        })
        this.unreadCount = 0
      }
    },
    
    // Отправляет уведомление через Telegram и сохраняет в базу
    async sendNotification(userId: string, message: string, type: 'info' | 'success' | 'warning' | 'error', metadata?: any) {
      const supabase = useSupabaseClient()
      
      // Создаем уведомление в базе данных
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message,
          type,
          read: false,
          metadata
        })
        .select()
        .single()
      
      if (error) {
        console.error('Error saving notification:', error)
        return null
      }
      
      // Получаем Telegram данные пользователя
      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_id')
        .eq('id', userId)
        .single()
      
      if (profile?.telegram_id) {
        // Отправляем уведомление через Telegram Bot API
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            telegram_id: profile.telegram_id,
            message,
            type
          }
        })
      }
      
      return data
    }
  },
  
  getters: {
    hasUnread: (state) => state.unreadCount > 0
  }
}) 