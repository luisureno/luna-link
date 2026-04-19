import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'owner@mesarock.com',
    password: 'password123',
  })
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('user:', data?.user?.email)
  console.log('error:', error?.message, error?.status)
}

main()
