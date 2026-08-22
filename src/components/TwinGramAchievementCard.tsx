import React from 'react';
import { Award } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TwinGramAchievementCardProps {
  score?: number | null;
  badgeName?: string | null;
  badgeUrl?: string | null;
  nextBadgeName?: string | null;
  nextBadgeUrl?: string | null;
  nextBadgePoints?: number | null;
}

export const TwinGramAchievementCard: React.FC<TwinGramAchievementCardProps> = ({ 
  score, 
  badgeName, 
  badgeUrl, 
  nextBadgeName, 
  nextBadgeUrl, 
  nextBadgePoints 
}) => {
  const displayScore = score ?? 0;
  const displayBadgeName = badgeName || 'New Contributor';
  
  // Construct badge image URL
  const badgeImageUrl = badgeUrl 
    ? supabase.storage.from('twingram-badges').getPublicUrl(badgeUrl).data.publicUrl
    : supabase.storage.from('twingram-badges').getPublicUrl('new-contributor.png').data.publicUrl;

  const nextBadgeImageUrl = nextBadgeUrl 
    ? supabase.storage.from('twingram-badges').getPublicUrl(nextBadgeUrl).data.publicUrl
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900">TwinGram</h3>
      <p className="text-sm text-slate-500">Your contribution score</p>
      
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center border border-slate-800 overflow-hidden">
           <img src={badgeImageUrl} alt={displayBadgeName} className="w-10 h-10 object-contain" />
        </div>
        <div className="space-y-0.5">
          <p className="text-xl font-black text-slate-900">{displayScore} Points</p>
          <p className="text-sm font-bold text-blue-600">{displayBadgeName}</p>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 mt-2">
        <h4 className="text-sm font-bold text-slate-700 mb-3">Next Badge</h4>
        {nextBadgeName ? (
          <div className="flex items-center gap-4">
            {nextBadgeImageUrl && (
              <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center border border-slate-800 overflow-hidden">
                <img 
                  src={nextBadgeImageUrl} 
                  alt={nextBadgeName} 
                  className="w-8 h-8 object-contain" 
                />
              </div>
            )}
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-slate-900">{nextBadgeName}</p>
              {nextBadgePoints !== null && nextBadgePoints !== undefined && (
                <p className="text-xs text-slate-500">{nextBadgePoints} points needed</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">Maximum Badge Achieved</p>
        )}
      </div>
    </div>
  );
};
