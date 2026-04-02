import React, { useState, useEffect, useRef } from 'react';
import { 
  linkWithPopup, 
  unlink, 
  GoogleAuthProvider, 
  EmailAuthProvider, 
  updateProfile,
  updateEmail,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User, Mail, Lock, Settings as SettingsIcon, Loader2, Link as LinkIcon, Unlink, CheckCircle2, Camera, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

const DEFAULT_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe',
];

export function Settings() {
  const [user, loadingAuth] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    email: '',
    newPassword: '',
    confirmPassword: '',
    photoURL: '',
    allowFriendRequests: true
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setProfile(data);
          setFormData({
            displayName: data.displayName || '',
            username: data.username || '',
            email: user.email || '',
            newPassword: '',
            confirmPassword: '',
            photoURL: data.photoURL || user.photoURL || '',
            allowFriendRequests: data.allowFriendRequests ?? true
          });
        }
      }
    };
    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    try {
      // Update Auth Profile
      await updateProfile(user, {
        displayName: formData.displayName,
        photoURL: formData.photoURL
      });

      // Update Firestore Profile
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        username: formData.username,
        photoURL: formData.photoURL,
        allowFriendRequests: formData.allowFriendRequests
      });

      // Update Email if changed
      if (formData.email !== user.email) {
        await updateEmail(user, formData.email);
        await updateDoc(doc(db, 'users', user.uid), {
          email: formData.email
        });
      }

      // Update Password if provided
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await updatePassword(user, formData.newPassword);
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      console.error('Update profile error:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!IMGBB_API_KEY) {
      setMessage({ type: 'error', text: 'ImgBB API Key is missing. Please add it to your secrets.' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        const downloadURL = result.data.url;
        setFormData(prev => ({ ...prev, photoURL: downloadURL }));
        setMessage({ type: 'success', text: 'Profile picture uploaded to ImgBB! Save changes to apply.' });
      } else {
        throw new Error(result.error?.message || 'Failed to upload to ImgBB');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: `Upload failed: ${error.message}` });
    } finally {
      setUploading(false);
    }
  };

  const selectDefaultAvatar = (url: string) => {
    setFormData(prev => ({ ...prev, photoURL: url }));
  };

  const handleLinkGoogle = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await linkWithPopup(user, googleProvider);
      setMessage({ type: 'success', text: 'Google account linked successfully!' });
    } catch (error: any) {
      console.error('Linking error:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await unlink(user, 'google.com');
      setMessage({ type: 'success', text: 'Google account unlinked.' });
    } catch (error: any) {
      console.error('Unlinking error:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loadingAuth) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  if (!user) return <div className="text-center py-20">Please login to access settings.</div>;

  const isGoogleLinked = user.providerData.some(p => p.providerId === 'google.com');

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <SettingsIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-muted-foreground">Manage your profile and account connections</p>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}>
            {message.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleUpdateProfile} className="bg-card p-8 rounded-3xl border shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Profile Information
                </h2>
                {profile?.id && (
                  <div className="bg-muted px-3 py-1 rounded-lg text-xs font-mono font-bold text-muted-foreground">
                    ID: {profile.id}
                  </div>
                )}
              </div>
              
              {/* Avatar Selection */}
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile Picture</label>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 overflow-hidden bg-muted">
                      {formData.photoURL ? (
                        <img src={formData.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full text-white"
                    >
                      {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">Choose a default avatar:</p>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_AVATARS.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectDefaultAvatar(url)}
                          className={cn(
                            "w-10 h-10 rounded-full border-2 transition-all overflow-hidden hover:scale-110",
                            formData.photoURL === url ? "border-primary" : "border-transparent"
                          )}
                        >
                          <img src={url} alt={`Default ${i}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Display Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Change Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Privacy Settings</h3>
                <div className="flex items-center justify-between p-4 rounded-2xl border bg-background/50">
                  <div>
                    <p className="text-sm font-bold">Allow Friend Requests</p>
                    <p className="text-xs text-muted-foreground">Control who can send you friend requests</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, allowFriendRequests: !formData.allowFriendRequests })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      formData.allowFriendRequests ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      formData.allowFriendRequests ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              </div>

              <button
                disabled={loading || uploading}
                type="submit"
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Connections */}
          <div className="space-y-6">
            <div className="bg-card p-8 rounded-3xl border shadow-sm space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" /> Connections
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl border bg-background/50">
                  <div className="flex items-center gap-3">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                    <div>
                      <p className="text-sm font-bold">Google Account</p>
                      <p className="text-xs text-muted-foreground">{isGoogleLinked ? 'Connected' : 'Not connected'}</p>
                    </div>
                  </div>
                  <button
                    onClick={isGoogleLinked ? handleUnlinkGoogle : handleLinkGoogle}
                    disabled={loading}
                    className={`p-2 rounded-xl transition-all ${
                      isGoogleLinked ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'
                    }`}
                  >
                    {isGoogleLinked ? <Unlink className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
