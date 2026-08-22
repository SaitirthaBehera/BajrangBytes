import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getDefaultAvatarUrl } from '../lib/avatar';
import { X, Mail, Lock, User, AlertCircle, Camera, Check, Circle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', check: (pwd: string) => pwd.length >= 8 },
  { label: 'At least 1 uppercase letter', check: (pwd: string) => /[A-Z]/.test(pwd) },
  { label: 'At least 1 lowercase letter', check: (pwd: string) => /[a-z]/.test(pwd) },
  { label: 'At least 1 number', check: (pwd: string) => /\d/.test(pwd) },
  { label: 'At least 1 special character', check: (pwd: string) => /[^A-Za-z0-9]/.test(pwd) },
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const validateUsernameFormat = (name: string) => {
    const pattern = /^[a-z0-9_]+$/;
    if (name && !pattern.test(name)) {
      setUsernameError('Username can only contain lowercase letters, numbers, and underscores.');
      return false;
    }
    setUsernameError('');
    return true;
  };

  const checkUsernameAvailability = async (name: string) => {
    if (!name || name.length < 3 || !validateUsernameFormat(name)) {
      setUsernameStatus('idle');
      return false;
    }
    
    setUsernameStatus('checking');
    const { data, error } = await supabase
      .rpc('check_username_available', { p_username: name });
      
    if (error) {
      console.error('Username check error:', error);
      setUsernameStatus('idle');
      return false;
    }
      
    if (data === false) {
      setUsernameStatus('taken');
      return false;
    } else {
      setUsernameStatus('available');
      return true;
    }
  };

  const isPasswordValid = PASSWORD_REQUIREMENTS.every(req => req.check(password));
  const doPasswordsMatch = password === confirmPassword && confirmPassword !== '';

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
    const reader = new FileReader();
    reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp && (!isPasswordValid || !doPasswordsMatch)) return;

    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!validateUsernameFormat(username)) {
          setError('Username can only contain lowercase letters, numbers, and underscores.');
          setLoading(false);
          return;
        }

        const isAvailable = await checkUsernameAvailability(username);
        if (!isAvailable) {
          setError('This username is already taken. Please choose another username.');
          setLoading(false);
          return;
        }

        console.log("Signup starting...");
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { full_name: fullName, username } }
        });
        console.log("Signup result:", authData, signUpError);
        if (signUpError) throw signUpError;
        
        const user = authData.user;
        console.log("User:", user);
        if (!user) throw new Error('User creation failed.');

        console.log("Session exists:", !!authData.session);

        // Only upload avatar if user is fully authenticated
        if (authData.session) {
          let avatarUrl = getDefaultAvatarUrl();

          if (avatarFile) {
            console.log("Attempting avatar upload for user:", user.id);
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `avatar.${fileExt}`;
            const { error: uploadError } = await supabase.storage
              .from('profile-avatars')
              .upload(`${user.id}/${fileName}`, avatarFile, { upsert: true });
            
            console.log("Upload result:", uploadError);
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from('profile-avatars')
              .getPublicUrl(`${user.id}/${fileName}`);

            avatarUrl = urlData.publicUrl;
          }

          console.log("Avatar URL:", avatarUrl);
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', user.id);
          
          console.log("Update result:", updateError);
          if (updateError) throw updateError;
        } else {
          console.log("Account created but email confirmation pending; avatar upload deferred.");
          alert('Account created! Please check your email to confirm.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'We couldn\'t create your account right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X /></button>
        <h2 className="text-2xl font-black text-slate-900 mb-6">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
        
        {error && <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" required />
              <div className="space-y-1">
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={username} 
                  onChange={(e) => { 
                    setUsername(e.target.value); 
                    validateUsernameFormat(e.target.value);
                    setUsernameStatus('idle'); 
                  }}
                  onBlur={() => checkUsernameAvailability(username)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" 
                  required 
                />
                {usernameError && <p className="text-xs text-rose-600">{usernameError}</p>}
                {!usernameError && usernameStatus === 'checking' && <p className="text-xs text-slate-500">Checking username...</p>}
                {!usernameError && usernameStatus === 'available' && <p className="text-xs text-emerald-600">✓ Username is available</p>}
                {!usernameError && usernameStatus === 'taken' && <p className="text-xs text-rose-600">✕ Username is already taken</p>}
              </div>
            </>
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" required />
          
          <div className="space-y-1">
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" required />
            {isSignUp && (
              <div className="space-y-1 pt-2">
                {PASSWORD_REQUIREMENTS.map((req, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${req.check(password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {req.check(password) ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                    {req.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {isSignUp && (
            <div className="space-y-1">
              <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none" required />
              <div className={`text-xs ${doPasswordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                {confirmPassword && (doPasswordsMatch ? 'Passwords match ✓' : 'Passwords do not match ✕')}
              </div>
            </div>
          )}

          {isSignUp && (
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 relative">
                  {avatarPreview ? <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-slate-400" />}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/jpeg,image/png,image/webp" />
                </div>
              </label>
              <button type="button" onClick={() => setAvatarFile(null) || setAvatarPreview(null)} className="text-xs text-rose-500 hover:underline">Remove</button>
            </div>
          )}

          <button disabled={loading || (isSignUp && (!isPasswordValid || !doPasswordsMatch))} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50">
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          {isSignUp ? 'Already have an account?' : 'Need an account?'}
          <button onClick={() => setIsSignUp(!isSignUp)} className="ml-1 text-blue-600 font-bold hover:underline">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
};
