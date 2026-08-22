import { supabase } from './src/lib/supabase';

async function run() {
  const { data, error } = await supabase.from('buildings').select('*');
  console.log("DATA:", data);
  console.log("ERROR:", error);
}
run();
