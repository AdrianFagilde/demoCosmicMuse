import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cdeooqfiyuxierrqyxbz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZW9vcWZpeXV4aWVycnF5eGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MjU3ODYsImV4cCI6MjEwMjUwMTc4Nn0.L62ZKusqWGllH1UME6gfY9ntDIihj1C91-pxmSU4vk4'

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Logging in as admin...')
  const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@cosmomusic.com', password: 'admin123',
  })
  if (loginErr) { console.error('Login failed:', loginErr.message); return }
  console.log('Logged in as admin, ID:', authData.user.id)

  // Check if admin profile exists, create if not
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', authData.user.id).single()
  if (!existing) {
    console.log('Creating admin profile...')
    const { error: e } = await supabase.from('profiles').insert({
      id: authData.user.id,
      full_name: 'Aurora Rivera',
      username: 'admin',
      email: 'admin@cosmomusic.com',
      role: 'admin',
    })
    console.log(e ? `Error creating admin profile: ${e.message}` : 'Created admin profile')
  } else {
    console.log('Admin profile exists')
  }

  // Fetch all profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, email, role')
  if (pErr) { console.error('Error fetching profiles:', pErr.message); return }
  console.log(`Found ${profiles.length} profiles:`, profiles.map(p => `${p.email}(${p.role})`))

  const adminId = profiles.find(p => p.email === 'admin@cosmomusic.com')?.id
  const mariaId = profiles.find(p => p.email === 'maria.lopez@cosmomusic.com')?.id
  const javierId = profiles.find(p => p.email === 'javier.torres@cosmomusic.com')?.id

  // Update student profiles with extra data
  if (mariaId) {
    const { error: e } = await supabase.from('profiles').update({
      instrument: 'Piano', level: 'Intermedio', teacher: 'Clara Estévez',
      phone: '+584121234567', progress: 82, attendance: 92,
      next_lesson: '2026-06-03T17:00:00', status: 'Activo',
    }).eq('id', mariaId)
    console.log(e ? `Error updating Maria: ${e.message}` : 'Updated Maria profile')
  }

  if (javierId) {
    const { error: e } = await supabase.from('profiles').update({
      instrument: 'Guitarra', level: 'Principiante', teacher: 'Luis Martínez',
      phone: '+584123456789', progress: 68, attendance: 88,
      next_lesson: '2026-06-02T18:30:00', status: 'Activo',
    }).eq('id', javierId)
    console.log(e ? `Error updating Javier: ${e.message}` : 'Updated Javier profile')
  }

  // Clear old seed data
  await supabase.from('payment_reminders').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('lessons').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  console.log('Cleared old seed data')

  // Seed lessons
  if (mariaId && javierId) {
    const { error: e } = await supabase.from('lessons').insert([
      { student_id: mariaId, instrument: 'Piano', lesson_date: '2026-06-03', lesson_time: '17:00', duration: '45 min', teacher: 'Clara Estévez' },
      { student_id: javierId, instrument: 'Guitarra', lesson_date: '2026-06-02', lesson_time: '18:30', duration: '60 min', teacher: 'Luis Martínez' },
    ])
    console.log(e ? `Error seeding lessons: ${e.message}` : 'Seeded lessons')
  }

  // Seed tasks
  if (mariaId && javierId && adminId) {
    const { error: e } = await supabase.from('tasks').insert([
      { title: 'Practicar escalas mayores y menores', description: 'Realiza 20 minutos de práctica de escalas con el metrónomo.', student_id: mariaId, assigned_by: adminId, due_date: '2026-06-03', status: 'En progreso', progress: 65 },
      { title: 'Ejercicio de arpegios en Mi mayor', description: 'Completa el ejercicio de arpegios en la guitarra con tempo constante.', student_id: javierId, assigned_by: adminId, due_date: '2026-06-05', status: 'Pendiente', progress: 25 },
    ])
    console.log(e ? `Error seeding tasks: ${e.message}` : 'Seeded tasks')
  }

  // Seed payments
  if (mariaId && javierId && adminId) {
    const { error: e } = await supabase.from('payments').insert([
      { student_id: mariaId, amount: 50, payment_date: '2026-05-05', method: 'Pago móvil', frequency: 'Mensual', notes: 'Pago mensual de mayo', recorded_by: adminId },
      { student_id: javierId, amount: 45, payment_date: '2026-05-10', method: 'Efectivo', frequency: 'Mensual', notes: 'Pago de suscripción de mayo', recorded_by: adminId },
    ])
    console.log(e ? `Error seeding payments: ${e.message}` : 'Seeded payments')
  }

  // Seed reminders
  if (mariaId && adminId) {
    const { error: e } = await supabase.from('payment_reminders').insert([
      { student_id: mariaId, message: 'Recordatorio de pago pendiente para este mes.', notify_whatsapp: false, schedule_at: '2026-06-01T09:00:00Z', interval_value: 7, interval_unit: 'Días', target_group: 'Morosos', active: true, created_by: adminId },
    ])
    console.log(e ? `Error seeding reminders: ${e.message}` : 'Seeded reminders')
  }

  // Delete test user profiles
  console.log('\nCleaning up test users...')
  const testUsers = profiles.filter(p => !p.email.endsWith('@cosmomusic.com'))
  if (testUsers.length) {
    await supabase.from('profiles').delete().in('id', testUsers.map(p => p.id))
    console.log(`Deleted ${testUsers.length} test profile(s)`)
  }

  // Verify login
  console.log('\n--- Verification ---')
  await supabase.auth.signOut()

  const { error: adminLogin } = await supabase.auth.signInWithPassword({ email: 'admin@cosmomusic.com', password: 'admin123' })
  console.log(adminLogin ? `Admin login FAILED: ${adminLogin.message}` : 'Admin login OK')

  const { data: adminProfile } = await supabase.from('profiles').select('*').eq('email', 'admin@cosmomusic.com').single()
  console.log(`Admin: ${adminProfile?.full_name} (${adminProfile?.role})`)

  const { error: mariaLogin } = await supabase.auth.signInWithPassword({ email: 'maria.lopez@cosmomusic.com', password: 'student123' })
  console.log(mariaLogin ? `Maria login FAILED: ${mariaLogin.message}` : 'Maria login OK')

  const { data: mariaProfile } = await supabase.from('profiles').select('*').eq('email', 'maria.lopez@cosmomusic.com').single()
  console.log(`Maria: ${mariaProfile?.full_name} (${mariaProfile?.role}) instrument: ${mariaProfile?.instrument}`)

  console.log('\nAll done!')
  process.exit(0)
}

seed()
