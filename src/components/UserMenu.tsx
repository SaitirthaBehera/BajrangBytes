import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, User } from 'lucide-react';

interface UserMenuProps {
  user: any;
  setActiveTab: (tab: string) => void;
  profile: any;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, setActiveTab, profile }) => {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => setActiveTab('profile')}
        className="flex items-center space-x-2 text-slate-700 bg-slate-100 px-1.5 py-1.5 rounded-full border border-slate-200 hover:bg-slate-200 transition-colors"
        title="View Profile"
      >
        {profile?.avatar_url ? (
          <img src={`${profile.avatar_url}?t=${new Date().getTime()}`} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <User className="w-4 h-4" />
        )}
      </button>
      <button
        onClick={handleSignOut}
        className="text-slate-500 hover:text-rose-600 transition-colors"
        title="Sign Out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};
