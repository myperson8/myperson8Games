import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Upload as UploadIcon, FileCode, Image as ImageIcon, Info, Keyboard, Tag, Loader2, ShieldCheck, ShieldAlert, Shield, Eye, X, Plus, Trash2, MousePointer2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ControlMapping, UserProfile } from '../types';

const MALICIOUS_PATTERNS = [
  { regex: /<script.*src=["']http:\/\/.*["']/i, label: 'Insecure External Script (HTTP)' },
  { regex: /eval\s*\(/i, label: 'Dynamic Code Execution (eval)' },
  { regex: /document\.cookie/i, label: 'Cookie Access' },
  { regex: /atob\s*\(/i, label: 'Base64 Decoding (Potential Obfuscation)' },
  { regex: /String\.fromCharCode/i, label: 'Character Code Conversion (Potential Obfuscation)' },
  { regex: /location\.href\s*=/i, label: 'Automatic Redirect' },
  { regex: /window\.open\s*\(/i, label: 'Popup Trigger' },
  { regex: /<iframe.*src=["'](?!https:\/\/).*["']/i, label: 'Insecure Iframe' },
];

const CATEGORIES = [
  'Action', 'Adventure', 'Arcade', 'Puzzle', 'Strategy', 'Racing', 'Sports', 'RPG', 'Simulation', 'Other'
];

const COMMON_KEYS = [
  { label: 'Arrow Up', value: 'ArrowUp' },
  { label: 'Arrow Down', value: 'ArrowDown' },
  { label: 'Arrow Left', value: 'ArrowLeft' },
  { label: 'Arrow Right', value: 'ArrowRight' },
  { label: 'Space', value: 'Space' },
  { label: 'Enter', value: 'Enter' },
  { label: 'Shift', value: 'Shift' },
  { label: 'W', value: 'w' },
  { label: 'A', value: 'a' },
  { label: 'S', value: 's' },
  { label: 'D', value: 'd' },
  { label: 'Left Click', value: 'Mouse0' },
  { label: 'Right Click', value: 'Mouse1' },
  { label: 'Middle Click', value: 'Mouse2' },
];

export function Upload() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [rateLimited, setRateLimited] = useState<{ limited: boolean; remainingTime: string }>({ limited: false, remainingTime: '' });
  const [scanResults, setScanResults] = useState<{
    passed: boolean;
    warnings: string[];
    errors: string[];
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [capturingKeyIndex, setCapturingKeyIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    controls: '',
    controlMappings: [] as ControlMapping[],
    category: 'Action',
    thumbnailUrl: '',
    videoUrl: '',
    htmlContent: '',
    isPublic: true,
    adMobUnitId: '',
    agreedToTerms: false
  });

  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => {
    const checkRateLimit = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          if (profile.lastUploadAt) {
            const lastUpload = profile.lastUploadAt.toDate();
            const now = new Date();
            const diff = now.getTime() - lastUpload.getTime();
            const sixHours = 6 * 60 * 60 * 1000;

            if (diff < sixHours) {
              const remaining = sixHours - diff;
              const hours = Math.floor(remaining / (60 * 60 * 1000));
              const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
              setRateLimited({
                limited: true,
                remainingTime: `${hours}h ${minutes}m`
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking rate limit:', error);
      }
    };

    checkRateLimit();
  }, [user]);

  const generateGameId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const performSecurityScan = (content: string) => {
    setScanning(true);
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic HTML validation
    if (!content.toLowerCase().includes('<html') && !content.toLowerCase().includes('<body') && !content.toLowerCase().includes('<script')) {
      errors.push('Invalid HTML structure: Missing basic tags or scripts.');
    }

    // Pattern matching
    MALICIOUS_PATTERNS.forEach(pattern => {
      if (pattern.regex.test(content)) {
        // Some things are just warnings (like cookies/popups which games might use)
        if (['Cookie Access', 'Popup Trigger', 'Base64 Decoding (Potential Obfuscation)'].includes(pattern.label)) {
          warnings.push(`Potential risk found: ${pattern.label}`);
        } else {
          errors.push(`Security threat detected: ${pattern.label}`);
        }
      }
    });

    setScanResults({
      passed: errors.length === 0,
      warnings,
      errors
    });
    setScanning(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('File is too large! Max size is 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setFormData(prev => ({ ...prev, htmlContent: content }));
        performSecurityScan(content);
      };
      reader.readAsText(file);
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 512 * 1024) {
        alert('Thumbnail is too large! Max size is 512KB.');
        return;
      }
      setUploadingThumbnail(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData(prev => ({ ...prev, thumbnailUrl: base64 }));
        setThumbnailPreview(base64);
        setUploadingThumbnail(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('Video is too large! Max size is 1MB for direct upload. For larger videos, please use a link.');
        return;
      }
      setUploadingVideo(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData(prev => ({ ...prev, videoUrl: base64 }));
        setVideoPreview(base64);
        setUploadingVideo(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const addControlMapping = () => {
    setFormData(prev => ({
      ...prev,
      controlMappings: [...prev.controlMappings, { action: '', key: '' }]
    }));
  };

  const removeControlMapping = (index: number) => {
    setFormData(prev => ({
      ...prev,
      controlMappings: prev.controlMappings.filter((_, i) => i !== index)
    }));
  };

  const updateControlMapping = (index: number, field: keyof ControlMapping, value: string) => {
    setFormData(prev => ({
      ...prev,
      controlMappings: prev.controlMappings.map((m, i) => i === index ? { ...m, [field]: value } : m)
    }));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (capturingKeyIndex === null) return;
    e.preventDefault();
    const key = e.key === ' ' ? 'Space' : e.key;
    updateControlMapping(capturingKeyIndex, 'key', key);
    setCapturingKeyIndex(null);
  };

  useEffect(() => {
    if (capturingKeyIndex !== null) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [capturingKeyIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let gameId = generateGameId();
      let isUnique = false;
      let attempts = 0;

      // Ensure uniqueness (max 5 attempts for safety)
      while (!isUnique && attempts < 5) {
        const existingDoc = await getDoc(doc(db, 'games', gameId));
        if (!existingDoc.exists()) {
          isUnique = true;
        } else {
          gameId = generateGameId();
          attempts++;
        }
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const profile = userDoc.data() as UserProfile;

      const gameRef = doc(db, 'games', gameId);
      const newGame = {
        ...formData,
        id: gameId,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorUsername: profile.username,
        playCount: 0,
        activeCount: 0,
        likes: 0,
        dislikes: 0,
        trendingScore: 0,
        avgRating: 0,
        ratingCount: 0,
        isBanned: false,
        createdAt: serverTimestamp()
      };

      // Remove agreedToTerms from the object before saving to Firestore
      const { agreedToTerms, ...gameData } = newGame;

      await setDoc(gameRef, gameData);
      
      // Update user's last upload time
      await setDoc(doc(db, 'users', user.uid), {
        lastUploadAt: serverTimestamp()
      }, { merge: true });

      navigate(`/games/${gameId}`);
    } catch (error) {
      console.error('Error uploading game:', error);
      alert('Failed to upload game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold">Please login to upload games</h2>
        <p className="text-muted-foreground">You need an account to share your creations with the community.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Upload Your Game</h1>
          <p className="text-muted-foreground">Share your HTML5 game with the world. Fill in the details below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-2xl border shadow-sm">
          {rateLimited.limited && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold">Upload Limit Active</p>
                <p>You can only upload 1 game every 6 hours. Please wait {rateLimited.remainingTime}.</p>
              </div>
            </div>
          )}

          {/* Visibility Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border">
            <div className="space-y-0.5">
              <label className="text-sm font-bold uppercase tracking-wider">Visibility</label>
              <p className="text-xs text-muted-foreground">
                {formData.isPublic ? 'Public - Everyone can play' : 'Private - Only you can see'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isPublic: !prev.isPublic }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isPublic ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4" /> Game Title
            </label>
            <input
              required
              type="text"
              placeholder="Enter a catchy title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4" /> Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4" /> Description
            </label>
            <textarea
              required
              rows={4}
              placeholder="Tell players what your game is about..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Keyboard className="w-4 h-4" /> Game Controls
              </label>
              <button
                type="button"
                onClick={addControlMapping}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Control
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.controlMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                  <div className="flex-1">
                    <input
                      required
                      type="text"
                      placeholder="Action (e.g. Jump, Shoot)"
                      value={mapping.action}
                      onChange={(e) => updateControlMapping(index, 'action', e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                  <div className="w-32 relative">
                    <button
                      type="button"
                      onClick={() => setCapturingKeyIndex(index)}
                      className={cn(
                        "w-full px-4 py-2 rounded-xl border text-sm font-bold transition-all truncate",
                        capturingKeyIndex === index ? "bg-primary text-primary-foreground ring-2 ring-primary/20" : "bg-muted/50 hover:bg-muted"
                      )}
                    >
                      {capturingKeyIndex === index ? 'Press a key...' : mapping.key || 'Assign Key'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeControlMapping(index)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <div className="p-4 bg-muted/30 rounded-xl border border-dashed">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  Click "Assign Key" then press any key on your keyboard to map it.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Additional Instructions (Optional)</label>
                <textarea
                  placeholder="Any extra details about controls..."
                  value={formData.controls}
                  onChange={(e) => setFormData({ ...formData, controls: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 outline-none transition-all h-20 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Thumbnail & Video Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Thumbnail */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Thumbnail
                </label>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Max 512KB</span>
              </div>
              
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailUpload}
                  className="hidden"
                  id="thumbnail-upload"
                />
                <label
                  htmlFor="thumbnail-upload"
                  className="flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed border-white/10 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer group overflow-hidden"
                >
                  {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <>
                      <div className="p-3 bg-primary/10 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest">Upload Thumbnail</p>
                      <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP</p>
                    </>
                  )}
                  {uploadingThumbnail && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </label>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Or provide a link</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={formData.thumbnailUrl.startsWith('data:') ? '' : formData.thumbnailUrl}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }));
                    setThumbnailPreview(e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-xl border bg-background outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
              </div>
            </div>

            {/* Video */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4 text-primary" />
                  Preview Video
                </label>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Max 1MB</span>
              </div>
              
              <div className="relative group">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed border-white/10 bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all cursor-pointer group overflow-hidden"
                >
                  {videoPreview ? (
                    <video src={videoPreview} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <>
                      <div className="p-3 bg-primary/10 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 text-primary" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-widest">Upload Video</p>
                      <p className="text-[10px] text-muted-foreground">MP4, WebM</p>
                    </>
                  )}
                  {uploadingVideo && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )}
                </label>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Or provide a link</label>
                <input
                  type="url"
                  placeholder="https://example.com/video.mp4"
                  value={formData.videoUrl.startsWith('data:') ? '' : formData.videoUrl}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, videoUrl: e.target.value }));
                    setVideoPreview(e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-xl border bg-background outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          {/* AdMob Section */}
          <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Tag className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-wider text-sm">Monetization (AdMob)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your AdMob Ad Unit ID to show ads on your game page and earn revenue.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ad Unit ID</label>
              <input
                type="text"
                placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX"
                value={formData.adMobUnitId}
                onChange={(e) => setFormData(prev => ({ ...prev, adMobUnitId: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>

          {/* HTML File */}
          <div className="space-y-4">
            <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4" /> Game HTML File (index.html)
            </label>
            <div className="relative group">
              <input
                required
                type="file"
                accept=".html"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadIcon className="w-8 h-8 mb-3 text-muted-foreground group-hover:text-primary" />
                  <p className="mb-2 text-sm text-muted-foreground group-hover:text-primary">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">HTML files only (max 1MB)</p>
                </div>
              </label>
            </div>

            {/* Security Scan Results */}
            <AnimatePresence>
              {scanning && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-muted/30 rounded-xl border flex items-center gap-3"
                >
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">Scanning for malicious code...</p>
                </motion.div>
              )}

              {scanResults && !scanning && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    "p-4 rounded-xl border space-y-3",
                    scanResults.passed ? "bg-green-500/5 border-green-500/20" : "bg-destructive/5 border-destructive/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {scanResults.passed ? (
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-destructive" />
                    )}
                    <h4 className={cn("font-bold text-sm", scanResults.passed ? "text-green-600" : "text-destructive")}>
                      {scanResults.passed ? 'Security Scan Passed' : 'Security Scan Failed'}
                    </h4>
                  </div>

                  {scanResults.errors.length > 0 && (
                    <div className="space-y-1">
                      {scanResults.errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1">
                          <X className="w-3 h-3" /> {err}
                        </p>
                      ))}
                    </div>
                  )}

                  {scanResults.warnings.length > 0 && (
                    <div className="space-y-1">
                      {scanResults.warnings.map((warn, i) => (
                        <p key={i} className="text-xs text-yellow-600 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> {warn}
                        </p>
                      ))}
                    </div>
                  )}

                  {scanResults.passed && (
                    <p className="text-xs text-green-600 font-medium">
                      The file appears to be safe and correctly structured.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {formData.htmlContent && scanResults?.passed && (
              <div className="flex items-center gap-3">
                <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                  <FileCode className="w-3 h-3" /> File ready: {formData.htmlContent.length} bytes
                </p>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Preview Game
                </button>
              </div>
            )}
          </div>

          {/* TOS & Privacy Policy */}
          <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border">
            <input
              required
              type="checkbox"
              id="terms"
              checked={formData.agreedToTerms}
              onChange={(e) => setFormData(prev => ({ ...prev, agreedToTerms: e.target.checked }))}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
              I agree to the <span className="text-primary font-bold hover:underline cursor-pointer">Terms of Service</span> and <span className="text-primary font-bold hover:underline cursor-pointer">Privacy Policy</span>. I confirm that I own the rights to this game and it does not contain malicious code or copyrighted material without permission.
            </label>
          </div>

          <button
            disabled={loading || !formData.htmlContent || !scanResults?.passed || rateLimited.limited || !formData.agreedToTerms}
            type="submit"
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              'Publish Game'
            )}
          </button>
        </form>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreview(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl aspect-video bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-4 bg-card border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Game Preview</span>
                </div>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <iframe
                title="Game Preview"
                srcDoc={formData.htmlContent}
                className="w-full h-full border-none"
                sandbox="allow-scripts allow-same-origin"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Key Picker Modal */}
      <AnimatePresence>
        {capturingKeyIndex !== null && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCapturingKeyIndex(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black">Assign Control</h3>
                  <p className="text-xs text-muted-foreground">Press a key or select from common options</p>
                </div>
                <button 
                  onClick={() => setCapturingKeyIndex(null)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl text-center">
                <Keyboard className="w-12 h-12 text-primary mx-auto mb-4 animate-bounce" />
                <p className="text-sm font-bold animate-pulse">Waiting for key press...</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Common Options</p>
                <div className="grid grid-cols-3 gap-2">
                  {COMMON_KEYS.map(key => (
                    <button
                      key={key.value}
                      type="button"
                      onClick={() => {
                        updateControlMapping(capturingKeyIndex, 'key', key.value);
                        setCapturingKeyIndex(null);
                      }}
                      className="px-3 py-2 rounded-xl bg-muted/50 hover:bg-primary hover:text-primary-foreground text-[10px] font-bold transition-all truncate"
                    >
                      {key.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
