import { defineEventHandler, deleteCookie } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Удаляем cookies с токенами
    deleteCookie(event, 'tg-access-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    deleteCookie(event, 'tg-refresh-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    console.log('✅ User logged out successfully')

    return {
      success: true,
      message: 'Logged out successfully'
    }

  } catch (error: any) {
    console.error('❌ Logout error:', error)
    return {
      success: false,
      error: 'Internal server error'
    }
  }
})
