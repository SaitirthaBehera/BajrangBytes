import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { User, Camera, AlertCircle, Check, Heart, ThumbsDown, MessageCircle, Share2, Trash2 } from 'lucide-react';
import { getDefaultAvatarUrl } from '../lib/avatar';
import { TwinGramPostCard } from './TwinGramPostCard';
import { CommentModal } from './CommentModal';
import { ShareModal } from './ShareModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { TwinGramAchievementCard } from './TwinGramAchievementCard';
import { api } from '../services/api';

interface ProfilePageProps {
  user: any;
  profile: any;
  refreshProfile: () => void;
  isAdmin?: boolean;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, profile, refreshProfile, isAdmin }) => {
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New state for profile posts
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [selectedPostForComments, setSelectedPostForComments] = useState<any | null>(null);
  const [selectedPostForSharing, setSelectedPostForSharing] = useState<any | null>(null);
  const [selectedPostForDeletion, setSelectedPostForDeletion] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processingReaction, setProcessingReaction] = useState<string | null>(null);
  const [processingVerification, setProcessingVerification] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setUsername(profile?.username || '');
    setAvatarPreview(profile?.avatar_url || null);
    setRemoveAvatar(false);
    setUsernameError('');
  }, [profile]);

  // Fetch posts for the profile user
  useEffect(() => {
    if (profile?.id) {
      fetchUserPosts();
    }
  }, [profile?.id]);

  const fetchUserPosts = async () => {
    setPostsLoading(true);
    setPostsError('');

    try {
      // 1. Fetch user's posts
      const { data: postsData, error: postsError } = await supabase
        .from('twingram_posts')
        .select('id, content, created_at, user_id, image_url, location, verification_status')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setPostsLoading(false);
        return;
      }

      // 2. Fetch enrichment data (reactions, comments count)
      const postIds = postsData.map(p => p.id);
      
      const [reactions, comments] = await Promise.all([
        supabase.from('twingram_reactions').select('post_id, reaction_type, user_id').in('post_id', postIds),
        supabase.from('twingram_comments').select('post_id').in('post_id', postIds)
      ]);
      
      const reactionsData = reactions.data || [];
      const commentsData = comments.data || [];

      // 3. Update with enriched data
      setPosts(postsData.map(post => {
        const postReactions = reactionsData.filter(r => r.post_id === post.id);
        const postComments = commentsData.filter(c => c.post_id === post.id);

        return {
          ...post,
          user_profiles: profile, // Reuse current profile data
          likes: postReactions.filter(r => r.reaction_type === 'like').length,
          dislikes: postReactions.filter(r => r.reaction_type === 'dislike').length,
          commentsCount: postComments.length,
          userReaction: user ? postReactions.find(r => r.user_id === user.id)?.reaction_type : null
        };
      }));
    } catch (err: any) {
      console.error('[ProfilePage] Error fetching posts:', err);
      setPostsError('Failed to load posts.');
    } finally {
      setPostsLoading(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: 'like' | 'dislike') => {
    if (!user) return; // Should handle auth elsewhere if needed

    setProcessingReaction(postId);

    try {
      const existingReaction = posts.find(p => p.id === postId)?.userReaction;

      if (existingReaction === reactionType) {
        await supabase
          .from('twingram_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('twingram_reactions')
          .upsert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType
          }, { onConflict: 'post_id, user_id' });
      }

      await fetchUserPosts();
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
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...result.data } : p));
      } else if (!result.success) {
        alert('Error updating post status: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error updating post status');
    } finally {
      setProcessingVerification(null);
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPostForDeletion || !user) return;

    setIsDeleting(true);
    try {
      // 1. Delete image if exists
      if (selectedPostForDeletion.image_url) {
        // Construct path: /{user_id}/{postId}.{ext}
        // Actually, the path in Storage for this post was /{user.id}/{postId}.{ext}
        // Let's list files in the user's directory to find the file
        const { data: files } = await supabase.storage
          .from('twingram-media')
          .list(user.id);
        
        const file = files?.find(f => f.name.startsWith(selectedPostForDeletion.id));
        if (file) {
          await supabase.storage
            .from('twingram-media')
            .remove([`${user.id}/${file.name}`]);
        }
      }

      // 2. Delete comments (cascade might handle it, but being explicit is safer)
      await supabase.from('twingram_comments').delete().eq('post_id', selectedPostForDeletion.id);
      
      // 3. Delete reactions
      await supabase.from('twingram_reactions').delete().eq('post_id', selectedPostForDeletion.id);

      // 4. Delete post
      const { error } = await supabase
        .from('twingram_posts')
        .delete()
        .eq('id', selectedPostForDeletion.id)
        .eq('user_id', user.id); // Security check
      
      if (error) throw error;

      await fetchUserPosts();
      setSelectedPostForDeletion(null);
      alert('Post deleted successfully.');
    } catch (err: any) {
      console.error('[ProfilePage] Error deleting post:', err);
      alert('Failed to delete post.');
    } finally {
      setIsDeleting(false);
    }
  };

  const validateUsernameFormat = (name: string) => {
    const pattern = /^[a-z0-9_]+$/;
    if (name && !pattern.test(name)) {
      setUsernameError('Username can only contain lowercase letters, numbers, and underscores.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5 MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, and WEBP images are allowed.');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    if (!validateUsernameFormat(username)) {
      setError('Username can only contain lowercase letters, numbers, and underscores.');
      setLoading(false);
      return;
    }

    try {
      // 1. Check username availability
      if (username !== profile.username) {
        const { data, error: rpcError } = await supabase
          .rpc('check_username_available', { p_username: username });
        
        if (rpcError) throw rpcError;
        if (data === false) {
          throw new Error('This username is already taken.');
        }
      }

      let avatarUrl = profile.avatar_url;

      // 2. Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `avatar.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('profile-avatars')
          .upload(filePath, avatarFile, { upsert: true });
        
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('profile-avatars')
          .getPublicUrl(filePath);
        
        avatarUrl = urlData.publicUrl;
      } else if (removeAvatar) {
        avatarUrl = getDefaultAvatarUrl();
      }

      // 3. Update profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName, username, avatar_url: avatarUrl })
        .eq('id', user.id);
      
      if (updateError) throw updateError;

      setSuccess('Profile updated successfully!');
      refreshProfile();
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      {isEditing ? (
        <>
          <h2 className="text-2xl font-black text-slate-900 mb-6">Edit Profile</h2>

          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

          <div className="space-y-4">
            <div className="flex flex-col items-center mb-6">
              <label className="cursor-pointer relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                  {avatarPreview ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-slate-400" />}
                </div>
                <div className="absolute bottom-0 right-0 p-1.5 bg-blue-600 rounded-full text-white">
                  <Camera className="w-4 h-4" />
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/jpeg,image/png,image/webp" />
              </label>
              {avatarPreview && (
                <button type="button" onClick={handleRemoveAvatar} className="mt-2 text-xs text-rose-600 font-bold hover:underline">
                  Remove
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => { 
                  setUsername(e.target.value);
                  validateUsernameFormat(e.target.value);
                }} 
                className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" 
              />
              {usernameError && <p className="text-xs text-rose-600 mt-1">{usernameError}</p>}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsEditing(false)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-3 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate} 
                disabled={loading} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-black text-slate-900 mb-6">Profile</h2>
          
          {success && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg flex items-center gap-2"><Check className="w-4 h-4" />{success}</div>}

          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 mb-4">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-slate-400" />}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{profile?.full_name}</h3>
            <p className="text-sm text-slate-500">@{profile?.username}</p>
          </div>

          <button 
            onClick={() => setIsEditing(true)} 
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-sm py-3 rounded-xl transition-all cursor-pointer"
          >
            Edit Profile
          </button>

          <div className="mt-6">
            <TwinGramAchievementCard 
              score={profile?.score} 
              badgeName={profile?.badge} 
              badgeUrl={profile?.badge_url}
              nextBadgeName={profile?.next_badge}
              nextBadgeUrl={profile?.next_badge_url}
              nextBadgePoints={profile?.next_badge_points}
            />
          </div>

          {/* Posts Section */}
          <div className="mt-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Posts</h3>
            {postsLoading ? (
              <p className="text-center text-slate-500">Loading posts...</p>
            ) : postsError ? (
              <p className="text-center text-rose-600">{postsError}</p>
            ) : posts.length === 0 ? (
              <p className="text-center text-slate-500">No posts yet.</p>
            ) : (
              <div className="space-y-6">
                {posts.map(post => (
                  <TwinGramPostCard 
                    key={post.id} 
                    post={post} 
                    onReaction={handleReaction}
                    processingReaction={processingReaction}
                    onCommentClick={setSelectedPostForComments}
                    onShareClick={setSelectedPostForSharing}
                    onDelete={user?.id === profile?.id ? setSelectedPostForDeletion : undefined}
                    isAdmin={isAdmin}
                    onUpdatePostStatus={handleUpdatePostStatus}
                    processingVerification={processingVerification}
                  />
                ))}
              </div>
            )}
          </div>

          {selectedPostForComments && (
            <CommentModal 
              post={selectedPostForComments}
              session={user ? { user } : null}
              onClose={() => setSelectedPostForComments(null)}
              onOpenAuth={() => {}}
              onCommentChanged={fetchUserPosts}
            />
          )}
          
          {selectedPostForSharing && (
            <ShareModal 
              isOpen={!!selectedPostForSharing}
              onClose={() => setSelectedPostForSharing(null)}
              postUrl={`${window.location.origin}/twingram/post/${selectedPostForSharing.id}`}
            />
          )}

          {selectedPostForDeletion && (
            <DeleteConfirmationModal 
              isOpen={!!selectedPostForDeletion}
              onClose={() => setSelectedPostForDeletion(null)}
              onConfirm={handleDeletePost}
              isDeleting={isDeleting}
            />
          )}
        </>
      )}
    </div>
  );
};
