import { supabase } from './src/lib/supabase';

async function testProfileRead() {
  console.log('Testing profile read access...');
  // Try fetching a generic set of profiles or even one specific one
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, username, avatar_url')
    .limit(5);

  if (error) {
    console.error('RLS/Read error:', error);
  } else {
    console.log('Profiles read successfully:', data);
  }
}

testProfileRead();
