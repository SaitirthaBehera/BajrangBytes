import { supabase } from './src/lib/supabase';

async function run() {
  const { data, error } = await supabase.from('user_profiles').select('id').ilike('username', 'sneha_poeli').maybeSingle();
  console.log("DATA:", data);
  console.log("ERROR:", error);
}
run();
