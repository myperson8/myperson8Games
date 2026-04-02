import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Upload as UploadIcon, FileCode, Image as ImageIcon, Info, Keyboard, Tag, Loader2, Save, ArrowLeft, ShieldCheck, ShieldAlert, Shield, Eye, X, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Game, ControlMapping } from '../types';
import { cn } from '../lib/utils';

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

export function EditGame() {
  const { id } = useParams<{ id: string }>();
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
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
    adMobUnitId: ''
  });

  useEffect(() => {
    const fetchGame = async () => {
      if (!id || !user) return;
      try {
        const gameDoc = await getDoc(doc(db, 'games', id));
        if (gameDoc.exists()) {
          const gameData = gameDoc.data() as Game;
          if (gameData.authorId !== user.uid) {
            alert('You do not have permission to edit this game.');
            navigate('/my-games');
            return;
          }
          setFormData({
            title: gameData.title,
            description: gameData.description,
            controls: gameData.controls,
            controlMappings: gameData.controlMappings || [],
            category: gameData.category,
            thumbnailUrl: gameData.thumbnailUrl || '',
            videoUrl: gameData.videoUrl || '',
            htmlContent: gameData.htmlContent,
            isPublic: gameData.isPublic !== undefined ? gameData.isPublic : true,
            adMobUnitId: gameData.adMobUnitId || ''
          });
        } else {
          navigate('/my-games');
        }
      } catch (error) {
        console.error('Error fetching game:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGame();
  }, [id, user, navigate]);

  const performSecurityScan = (content: string) => {
    setScanning(true);
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!content.toLowerCase().includes('<html') && !content.toLowerCase().includes('<body') && !content.toLowerCase().includes('<script')) {
      errors.push('Invalid HTML structure: Missing basic tags or scripts.');
    }

    MALICIOUS_PATTERNS.forEach(pattern => {
      if (pattern.regex.test(content)) {
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
    if (!user || !id) return;

    setSaving(true);
    try {
      const gameRef = doc(db, 'games', id);
      await updateDoc(gameRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      navigate(`/games/${id}`);
    } catch (error) {
      console.error('Error updating game:', error);
      alert('Failed to update game.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/my-games')} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">Edit Game</h1>
            <p className="text-muted-foreground">Update your game details, monetization settings, or upload a new version.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-2xl border shadow-sm">
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

          {/* Thumbnail & Video URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Thumbnail URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={formData.thumbnailUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4" /> Preview Video URL (Optional)
              </label>
              <input
                type="url"
                placeholder="Direct link to .mp4 file"
                value={formData.videoUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
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
              <FileCode className="w-4 h-4" /> Update Game HTML File (Optional)
            </label>
            <div className="relative group">
              <input
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
                    <span className="font-semibold">Click to update file</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">Leave empty to keep current file</p>
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
                </motion.div>
              )}
            </AnimatePresence>

            {formData.htmlContent && (scanResults?.passed || !scanResults) && (
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

          <button
            disabled={saving || (scanResults && !scanResults.passed)}
            type="submit"
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
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
