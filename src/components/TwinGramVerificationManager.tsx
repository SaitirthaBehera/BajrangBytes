import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle2, AlertTriangle, Filter, Search } from 'lucide-react';

interface TwinGramVerificationManagerProps {
  posts: any[];
  onUpdateStatus: (postId: string, status: 'verified' | 'fake') => void;
}

export const TwinGramVerificationManager: React.FC<TwinGramVerificationManagerProps> = ({ posts, onUpdateStatus }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'fake'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredPosts = posts.filter(p => filter === 'all' || (p.verification_status || 'pending') === filter);

  const handleUpdate = async (postId: string, status: 'verified' | 'fake') => {
    setProcessingId(postId);
    try {
      const { error } = await supabase
        .from('twingram_posts')
        .update({ verification_status: status })
        .eq('id', postId);
      
      if (error) throw error;
      
      onUpdateStatus(postId, status);
      alert(`Post marked as ${status} successfully.`);
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert('Failed to update status.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">TwinGram Post Verification ({posts.filter(p => (p.verification_status || 'pending') === 'pending').length} Pending)</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="fake">Fake</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredPosts.map(post => (
          <div key={post.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {post.image_url && <img src={post.image_url} alt="post" className="w-16 h-16 rounded-xl object-cover" />}
              <div>
                <p className="font-bold text-sm text-slate-900">{post.content.substring(0, 50)}...</p>
                <p className="text-xs text-slate-500">@{post.user_profiles?.username} • {new Date(post.created_at).toLocaleDateString()}</p>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    (post.verification_status || 'pending') === 'verified' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                    (post.verification_status || 'pending') === 'fake' ? 'text-rose-700 bg-rose-50 border-rose-200' :
                    'text-amber-700 bg-amber-50 border-amber-200'
                }`}>{(post.verification_status || 'pending').toUpperCase()}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                disabled={processingId === post.id}
                onClick={() => handleUpdate(post.id, 'verified')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> ✓ Verify
              </button>
              <button 
                disabled={processingId === post.id}
                onClick={() => handleUpdate(post.id, 'fake')}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" /> ⚠ Mark Fake
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
