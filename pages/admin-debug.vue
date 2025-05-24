<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white rounded-lg shadow-lg p-6">
        <h1 class="text-3xl font-bold text-gray-900 mb-6">🔧 Admin Access Debug</h1>
        
        <!-- Status Overview -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="bg-blue-50 p-4 rounded-lg">
            <h3 class="font-semibold text-blue-900">User Status</h3>
            <p class="text-blue-700">{{ isLoggedIn ? '✅ Logged In' : '❌ Not Logged In' }}</p>
          </div>
          
          <div class="bg-green-50 p-4 rounded-lg">
            <h3 class="font-semibold text-green-900">Admin Rights</h3>
            <p class="text-green-700">{{ isAdmin ? '✅ Admin' : '❌ Not Admin' }}</p>
          </div>
          
          <div class="bg-purple-50 p-4 rounded-lg">
            <h3 class="font-semibold text-purple-900">Profile</h3>
            <p class="text-purple-700">{{ profile ? '✅ Loaded' : '❌ Missing' }}</p>
          </div>
          
          <div class="bg-orange-50 p-4 rounded-lg">
            <h3 class="font-semibold text-orange-900">Initializing</h3>
            <p class="text-orange-700">{{ initializing ? '⏳ Yes' : '✅ Done' }}</p>
          </div>
        </div>

        <!-- Detailed Info -->
        <div class="space-y-6">
          <!-- User Info -->
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="font-semibold text-gray-900 mb-3">User Information</h3>
            <div class="space-y-2 text-sm">
              <p><strong>Email:</strong> {{ userEmail || 'Not available' }}</p>
              <p><strong>User ID:</strong> {{ userId || 'Not available' }}</p>
              <p><strong>User metadata role:</strong> {{ user?.user_metadata?.role || 'Not set' }}</p>
            </div>
          </div>

          <!-- Profile Info -->
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="font-semibold text-gray-900 mb-3">Profile Information</h3>
            <div class="space-y-2 text-sm">
              <p><strong>Profile role:</strong> {{ profile?.role || 'Not set' }}</p>
              <p><strong>Full profile:</strong></p>
              <pre class="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-auto">{{ profile ? JSON.stringify(profile, null, 2) : 'No profile data' }}</pre>
            </div>
          </div>

          <!-- Admin Access Conditions -->
          <div class="bg-gray-50 p-4 rounded-lg">
            <h3 class="font-semibold text-gray-900 mb-3">Admin Access Conditions</h3>
            <div class="space-y-2 text-sm">
              <p><strong>Condition 1:</strong> profile.role === 'admin' → {{ profile?.role === 'admin' ? '✅ TRUE' : '❌ FALSE' }}</p>
              <p><strong>Condition 2:</strong> user.user_metadata.role === 'admin' → {{ user?.user_metadata?.role === 'admin' ? '✅ TRUE' : '❌ FALSE' }}</p>
              <p><strong>Final result:</strong> {{ isAdmin ? '✅ ADMIN ACCESS' : '❌ NO ADMIN ACCESS' }}</p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-4">
            <h3 class="font-semibold text-gray-900">Actions</h3>
            <div class="flex flex-wrap gap-2">
              <UButton @click="reloadProfile" color="blue" variant="outline">
                🔄 Reload Profile
              </UButton>
              
              <UButton @click="makeUserAdmin" color="green" variant="outline">
                👑 Make Current User Admin
              </UButton>
              
              <UButton @click="viewDatabaseProfile" color="yellow" variant="outline">
                🗄️ Check Database Profile
              </UButton>
              
              <UButton @click="tryAdminAccess" color="purple" variant="outline">
                🚪 Try Admin Access
              </UButton>
            </div>
          </div>

          <!-- Debug Output -->
          <div class="space-y-4">
            <h3 class="font-semibold text-gray-900">Debug Output</h3>
            <div class="bg-black text-green-400 p-4 rounded-lg text-sm font-mono max-h-96 overflow-y-auto">
              <div v-for="(log, index) in debugLogs" :key="index" class="mb-1">
                {{ log }}
              </div>
              <div v-if="debugLogs.length === 0" class="text-gray-500">
                No debug output yet. Use the buttons above.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSupabaseClient } from '#imports'

// Метаданные страницы
definePageMeta({
  title: 'Admin Debug',
  description: 'Debug admin access issues'
})

const { 
  user, 
  session, 
  profile, 
  initializing,
  isLoggedIn, 
  isAdmin, 
  userEmail, 
  userId,
  loadProfile
} = useAuth()

const supabase = useSupabaseClient()
const debugLogs = ref<string[]>([])

// Функция для добавления логов
const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  debugLogs.value.push(`[${timestamp}] ${message}`)
}

// Перезагрузить профиль
const reloadProfile = async () => {
  debugLogs.value = []
  addLog('🔄 Reloading profile...')
  
  try {
    await loadProfile()
    addLog('✅ Profile reloaded successfully')
    addLog(`Profile role: ${profile.value?.role || 'None'}`)
    addLog(`Is admin: ${isAdmin.value}`)
  } catch (error) {
    addLog(`❌ Profile reload error: ${error}`)
  }
}

// Сделать текущего пользователя администратором
const makeUserAdmin = async () => {
  debugLogs.value = []
  addLog('👑 Making current user admin...')
  
  if (!user.value) {
    addLog('❌ No user logged in')
    return
  }
  
  try {
    // Сначала проверим, есть ли запись в profiles
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      addLog(`❌ Error checking existing profile: ${fetchError.message}`)
      return
    }
    
    if (existingProfile) {
      // Обновляем существующий профиль
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.value.id)
        .select()
      
      if (error) {
        addLog(`❌ Error updating profile: ${error.message}`)
      } else {
        addLog('✅ Profile updated to admin role')
        await loadProfile()
      }
    } else {
      // Создаем новый профиль
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.value.id,
          email: user.value.email,
          role: 'admin'
        })
        .select()
      
      if (error) {
        addLog(`❌ Error creating admin profile: ${error.message}`)
      } else {
        addLog('✅ Admin profile created')
        await loadProfile()
      }
    }
  } catch (error) {
    addLog(`❌ Unexpected error: ${error}`)
  }
}

// Проверить профиль в базе данных
const viewDatabaseProfile = async () => {
  debugLogs.value = []
  addLog('🗄️ Checking database profile...')
  
  if (!user.value) {
    addLog('❌ No user logged in')
    return
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
    
    if (error) {
      addLog(`❌ Database query error: ${error.message}`)
    } else {
      addLog(`✅ Database query successful`)
      addLog(`Records found: ${data.length}`)
      if (data.length > 0) {
        addLog(`Profile data: ${JSON.stringify(data[0], null, 2)}`)
      } else {
        addLog('No profile record found in database')
      }
    }
  } catch (error) {
    addLog(`❌ Unexpected error: ${error}`)
  }
}

// Попробовать перейти на админ страницу
const tryAdminAccess = async () => {
  debugLogs.value = []
  addLog('🚪 Trying to access admin page...')
  
  addLog(`Current admin status: ${isAdmin.value}`)
  
  if (isAdmin.value) {
    addLog('✅ Admin rights confirmed, navigating...')
    await navigateTo('/admin')
  } else {
    addLog('❌ No admin rights, access denied')
  }
}
</script> 