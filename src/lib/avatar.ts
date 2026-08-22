import { supabase } from './supabase';

export const DEFAULT_AVATAR_PATH = 'default/avatar.png';

export const getDefaultAvatarUrl = () => {
  const { data } = supabase.storage
    .from('profile-avatars')
    .getPublicUrl(DEFAULT_AVATAR_PATH);
  
  return data.publicUrl;
};
