import React, { useState, useEffect } from 'react';
import { Trophy, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaderboardUser {
  rank: number;
  id: string;
  full_name: string;
  username: string;
  badge: string;
  score: number;
  avatar_url: string;
  badge_url: string;
}

interface LeaderboardPageProps {
  onBack: () => void;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onBack }) => {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_twingram_leaderboard');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError('Unable to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-red-600 font-bold">{error}</p>
        <button onClick={fetchLeaderboard} className="text-blue-600 font-bold flex items-center justify-center gap-2 mx-auto">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 font-medium">No contributors yet.</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-slate-600 font-bold text-sm hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to TwinGram</span>
      </button>

      <div className="text-center space-y-2">
        <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">TwinGram Leaderboard</h1>
        <p className="text-slate-600 font-medium">Top contributors making campus accessibility better.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
            <tr>
              <th className="px-6 py-4">Rank</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Badge</th>
              <th className="px-6 py-4 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className={user.rank <= 3 ? 'bg-amber-50/30' : ''}>
                <td className="px-6 py-4 font-black text-slate-900 text-lg">
                  {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : `#${user.rank}`}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <img src={user.avatar_url || ''} alt={user.full_name} className="w-10 h-10 rounded-full bg-slate-200" />
                    <div>
                      <p className="font-bold text-slate-900">{user.full_name}</p>
                      <p className="text-sm text-slate-500">@{user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <img 
                      src={user.badge_url 
                        ? supabase.storage.from('twingram-badges').getPublicUrl(user.badge_url).data.publicUrl 
                        : supabase.storage.from('twingram-badges').getPublicUrl('new-contributor.png').data.publicUrl} 
                      alt={user.badge || 'New Contributor'} 
                      className="w-8 h-8 object-contain"
                    />
                    <span className="text-sm font-bold text-slate-700">{user.badge || 'New Contributor'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-black text-slate-900 text-lg">
                  {user.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
