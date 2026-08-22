import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Trash2, Send, AlertCircle } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_profiles: {
    full_name: string;
    username: string;
    avatar_url: string;
  };
}

interface CommentModalProps {
  post: any; // Using any for simplicity as it's passed from TwinGramPage
  session: Session | null;
  onClose: () => void;
  onOpenAuth: () => void;
  onCommentChanged: () => void;
}

export const CommentModal: React.FC<CommentModalProps> = ({ post, session, onClose, onOpenAuth, onCommentChanged }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [post.id]);

  const fetchComments = async () => {
    setLoading(true);
    const { data: commentsData, error } = await supabase
      .from('twingram_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      setLoading(false);
      return;
    }

    if (!commentsData || commentsData.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds);

    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

    setComments(commentsData.map(c => ({
      ...c,
      user_profiles: profilesMap.get(c.user_id) || { full_name: 'Unknown', username: 'unknown', avatar_url: '' }
    })));
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
      onOpenAuth();
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    const { error } = await supabase
      .from('twingram_comments')
      .insert({
        post_id: post.id,
        user_id: session.user.id,
        content: newComment.trim()
      });

    if (error) {
      console.error('Error adding comment:', error);
    } else {
      setNewComment('');
      fetchComments();
      onCommentChanged();
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from('twingram_comments')
      .delete()
      .eq('id', commentId);
    
    if (error) {
      console.error('Error deleting comment:', error);
    } else {
      fetchComments();
      onCommentChanged();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[80vh] flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Comments</h2>
        
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {loading ? (
            <p className="text-center text-slate-500">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-slate-500 text-sm">No comments yet. Be the first!</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex space-x-3">
                <img src={comment.user_profiles.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Default'} alt={comment.user_profiles.username} className="w-8 h-8 rounded-full" />
                <div className="flex-1 bg-slate-50 p-3 rounded-2xl text-sm">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-slate-900 text-xs">{comment.user_profiles.full_name}</p>
                    {session?.user.id === comment.user_id && (
                      <button onClick={() => handleDelete(comment.id)} className="text-slate-400 hover:text-rose-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-slate-800 mt-1">{comment.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(comment.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center space-x-2 border-t pt-4">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
