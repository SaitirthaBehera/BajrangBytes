import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5 MB.');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedFile) return;
    if (!location.trim()) {
      setError('Please enter the exact location of this accessibility issue or feature.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to post.');

      // 1. Insert post first to get ID
      const { data: insertedPost, error: insertError } = await supabase
        .from('twingram_posts')
        .insert({ 
          content: content.trim(), 
          user_id: user.id,
          location: location.trim()
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      const postId = insertedPost.id;

      // 2. Upload image using postId as filename
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `/${user.id}/${postId}.${fileExt}`;

        console.log('DEBUG: Uploading image');
        console.log('  Authenticated user ID:', user.id);
        console.log('  New post ID:', postId);
        console.log('  Final storage object path:', filePath);

        const { error: uploadError } = await supabase.storage
          .from('twingram-media')
          .upload(filePath, selectedFile);

        if (uploadError) {
          console.error('Upload Error:', uploadError);
          // Rollback: delete the post record
          await supabase.from('twingram_posts').delete().eq('id', postId);
          throw new Error('Image upload failed. Post creation rolled back.');
        }

        const { data: urlData } = supabase.storage
          .from('twingram-media')
          .getPublicUrl(filePath);
        
        console.log('DEBUG: Generated public URL:', urlData.publicUrl);

        // 3. Update post with image URL
        const { error: updateError } = await supabase
          .from('twingram_posts')
          .update({ image_url: urlData.publicUrl })
          .eq('id', postId);
        
        if (updateError) {
          console.error('Update Error:', updateError);
          // Rollback: delete the post record
          await supabase.from('twingram_posts').delete().eq('id', postId);
          throw new Error('Failed to update post with image URL. Post creation rolled back.');
        }
      }

      setContent('');
      setLocation('');
      setSelectedFile(null);
      setPreviewUrl(null);
      onPostCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Create Post</h2>
        {error && <p className="text-rose-600 text-xs mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share an accessibility update..."
            className="w-full h-32 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none resize-none"
            required={!selectedFile}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Location / Address *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter the exact location (e.g., ITER C Block, Ground Floor, near Main Entrance)"
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none"
              required
            />
          </div>
          {previewUrl && (
            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <button 
                type="button"
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <input type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" accept="image/*" />
          <button
            type="submit"
            disabled={loading || (!content.trim() && !selectedFile) || !location.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  );
};
