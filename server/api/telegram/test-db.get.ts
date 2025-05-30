import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    // Тестируем подключение к базе
    console.log('Testing Supabase connection...')

    // Проверяем переменные окружения
    const env = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_KEY: process.env.SUPABASE_KEY?.substring(0, 20) + '...'
    }

    // Пытаемся получить лодки
    const { data: boats, error } = await supabase
      .from('boats')
      .select('*')
      .eq('active', true)

    if (error) {
      console.error('Database error:', error)
      return {
        status: 500,
        body: {
          error: 'Database error',
          details: error,
          env
        }
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        boats_count: boats?.length || 0,
        boats: boats?.slice(0, 3), // Первые 3 лодки для примера
        env
      }
    }
  } catch (error) {
    console.error('General error:', error)
    return {
      status: 500,
      body: {
        error: 'General error',
        details: error.message
      }
    }
  }
})
