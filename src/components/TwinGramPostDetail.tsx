import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TwinGramPostCard } from './TwinGramPostCard';
import { ShareModal } from './ShareModal';
import { CommentModal } from './CommentModal';
import { api } from '../services/api';

export const TwinGramPostDetail: React.FC<{ postId: string, session: any, onOpenAuth: () => void, isAdmin?: boolean }> = ({ postId, session, onOpenAuth, isAdmin }) => {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPostForComments, setSelectedPostForComments] = useState<any | null>(null);
  const [selectedPostForSharing, setSelectedPostForSharing] = useState<any | null>(null);
  const [processingReaction, setProcessingReaction] = useState<string | null>(null);
  const [processingVerification, setProcessingVerification] = useState<string | null>(null);

  const fetchPost = async () => {
    setLoading(true);
    
    // 1. Fetch the post
    const { data: postData, error: postError } = await supabase
      .from('twingram_posts')
      .select('id, content, created_at, user_id, image_url, location, verification_status')
      .eq('id', postId)
      .single();
    
    if (postError) {
      console.error('[TwinGramPostDetail] Error fetching post:', postError);
      setLoading(false);
      return;
    }

    if (postData) {
      // 2. Fetch enrichment data (profile, reactions, comments count)
      const [profile, reactions, comments] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, username, avatar_url').eq('id', postData.user_id).single(),
        supabase.from('twingram_reactions').select('reaction_type, user_id').eq('post_id', postId),
        supabase.from('twingram_comments').select('id').eq('post_id', postId)
      ]);
      
      const reactionsData = reactions.data || [];
      const commentsData = comments.data || [];
      
      setPost({
        ...postData,
        user_profiles: profile.data || { full_name: 'Unknown', username: 'unknown', avatar_url: '' },
        likes: reactionsData.filter(r => r.reaction_type === 'like').length,
        dislikes: reactionsData.filter(r => r.reaction_type === 'dislike').length,
        commentsCount: commentsData.length,
        userReaction: session ? reactionsData.find(r => r.user_id === session.user.id)?.reaction_type : null
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPost();
  }, [postId, session]);

  const handleReaction = async (postId: string, reactionType: 'like' | 'dislike') => {
    if (!session) {
      onOpenAuth();
      return;
    }

    setProcessingReaction(postId);

    try {
      const existingReaction = post?.userReaction;

      if (existingReaction === reactionType) {
        await supabase
          .from('twingram_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', session.user.id);
      } else {
        await supabase
          .from('twingram_reactions')
          .upsert({
            post_id: postId,
            user_id: session.user.id,
            reaction_type: reactionType
          }, { onConflict: 'post_id, user_id' });
      }

      await fetchPost();
    } catch (err: any) {
      console.error(err);
    } finally {
      setProcessingReaction(null);
    }
  };

  const handleUpdatePostStatus = async (postId: string, status: 'verified' | 'fake') => {
    setProcessingVerification(postId);
    try {
      const result = await api.updateTwinGramPostStatus(postId, status);
      if (result.success && result.data) {
        setPost((p: any) => ({ ...p, ...result.data }));
      } else if (!result.success) {
        alert('Error updating post status: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error updating post status');
    } finally {
      setProcessingVerification(null);
    }
  };

  if (loading) return <p className="text-center py-12 text-slate-500">Loading post...</p>;
  if (!post) return (
    <div className="text-center py-12 space-y-4">
      <p className="text-slate-900 font-bold">Post not found.</p>
      <a href="/" className="text-blue-600 hover:underline">Back to TwinGram</a>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <TwinGramPostCard 
        post={post}
        onReaction={handleReaction}
        processingReaction={processingReaction}
        onCommentClick={setSelectedPostForComments}
        onShareClick={setSelectedPostForSharing}
        isAdmin={isAdmin}
        onUpdatePostStatus={handleUpdatePostStatus}
        processingVerification={processingVerification}
      />
      
      {selectedPostForComments && (
        <CommentModal 
          post={selectedPostForComments}
          session={session}
          onClose={() => setSelectedPostForComments(null)}
          onOpenAuth={onOpenAuth}
          onCommentChanged={fetchPost}
        />
      )}
      
      {selectedPostForSharing && (
        <ShareModal 
          isOpen={!!selectedPostForSharing}
          onClose={() => setSelectedPostForSharing(null)}
          postUrl={`${window.location.origin}/twingram/post/${selectedPostForSharing.id}`}
        />
      )}
    </div>
  );
};
