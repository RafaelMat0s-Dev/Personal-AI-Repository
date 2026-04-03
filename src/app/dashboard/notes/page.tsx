import { createClient } from '@/lib/supabase/server'
import NotesClient from '@/components/notes/NotesClient'

export default async function NotesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  return <NotesClient initialNotes={notes || []} userId={user.id} />
}
