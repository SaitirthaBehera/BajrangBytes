import React from 'react';
import { Heart, ThumbsDown, MessageCircle, Share2, Trash2 } from 'lucide-react';

interface TwinGramPostCardProps {
  post: any;
  onReaction: (postId: string, reactionType: 'like' | 'dislike') => void;
  processingReaction: string | null;
  onCommentClick: (post: any) => void;
  onShareClick: (post: any) => void;
  onDelete?: (post: any) => void;
  isAdmin?: boolean;
  onUpdatePostStatus?: (postId: string, status: 'verified' | 'fake') => void;
  processingVerification?: string | null;
}

export const TwinGramPostCard: React.FC<TwinGramPostCardProps> = ({ 
  post, onReaction, processingReaction, onCommentClick, onShareClick, onDelete, isAdmin, onUpdatePostStatus, processingVerification
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={post.user_profiles.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Default'} alt={post.user_profiles.username} className="w-10 h-10 rounded-full" />
          <div>
            <div className="flex items-center space-x-2">
              <p className="font-bold text-slate-900 text-sm">{post.user_profiles.full_name}</p>
              {post.verification_status === 'verified' && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">✓ Verified</span>}
              {post.verification_status === 'fake' && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">⚠ Marked Fake</span>}
              {post.verification_status === 'pending' && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Pending Verification</span>}
            </div>
            <p className="text-xs text-slate-500">
              @{post.user_profiles.username} • {new Date(post.created_at).toLocaleDateString()}
              {post.location && ` • ${post.location}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {isAdmin && post.verification_status === 'pending' && (
            <>
              <button 
                onClick={() => onUpdatePostStatus && onUpdatePostStatus(post.id, 'verified')}
                disabled={processingVerification === post.id}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                ✓ Verify
              </button>
              <button 
                onClick={() => onUpdatePostStatus && onUpdatePostStatus(post.id, 'fake')}
                disabled={processingVerification === post.id}
                className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                ⚠ Fake
              </button>
            </>
          )}
          {onDelete && (
            <button 
              onClick={() => onDelete(post)}
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <p className="text-slate-800 text-sm leading-relaxed">{post.content}</p>
      
      {post.image_url && (
        <img src={post.image_url} alt="Post image" className="w-full rounded-xl object-cover" />
      )}
      
      <div className="flex items-center space-x-6 pt-2 border-t border-slate-100">
        <button
          onClick={() => onReaction(post.id, 'like')}
          disabled={processingReaction === post.id}
          className={`flex items-center space-x-1.5 transition-colors ${
            post.userReaction === 'like' ? 'text-rose-600' : 'text-slate-500 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-5 h-5 ${post.userReaction === 'like' ? 'fill-current' : ''}`} />
          <span className="text-xs font-bold">{post.likes}</span>
        </button>
        <button
          onClick={() => onReaction(post.id, 'dislike')}
          disabled={processingReaction === post.id}
          className={`flex items-center space-x-1.5 transition-colors ${
            post.userReaction === 'dislike' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ThumbsDown className={`w-5 h-5 ${post.userReaction === 'dislike' ? 'fill-current' : ''}`} />
          <span className="text-xs font-bold">{post.dislikes}</span>
        </button>
        <button 
          onClick={() => onCommentClick(post)}
          className="flex items-center space-x-1.5 text-slate-500 hover:text-blue-500 transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs font-bold">{post.commentsCount}</span>
        </button>
        <button 
          onClick={() => onShareClick(post)}
          className="flex items-center space-x-1.5 text-slate-500 hover:text-slate-900 transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
