import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, where, getDoc, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Game, UserProfile, Report, Comment, Rating } from '../types';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Shield, Users, Gamepad2, Flag, Trash2, Ban, CheckCircle, XCircle, Search, Edit3, Save, X, Loader2, TrendingUp, Star, MessageSquare, Settings, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { seedDefaultGames } from '../lib/seed';

const ADMIN_EMAILS = ['nothingnope07@gmail.com', 'nothingnope15@gmail.com'];

export function AdminPanel() {
  const [user] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'games' | 'maintenance'>('reports');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [managingContent, setManagingContent] = useState<{ gameId: string, title: string } | null>(null);
  const [gameComments, setGameComments] = useState<Comment[]>([]);
  const [gameRatings, setGameRatings] = useState<Rating[]>([]);
  const [seeding, setSeeding] = useState(false);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

  useEffect(() => {
    if (!isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'reports') {
          const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
        } else if (activeTab === 'users') {
          const q = query(collection(db, 'users'), limit(100));
          const snap = await getDocs(q);
          setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        } else if (activeTab === 'games') {
          const q = query(collection(db, 'games'), limit(100));
          const snap = await getDocs(q);
          setGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (!managingContent) return;
    const fetchContent = async () => {
      try {
        const cq = query(collection(db, 'comments'), where('gameId', '==', managingContent.gameId));
        const rq = query(collection(db, 'ratings'), where('gameId', '==', managingContent.gameId));
        const [cSnap, rSnap] = await Promise.all([getDocs(cq), getDocs(rq)]);
        setGameComments(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
        setGameRatings(rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Rating)));
      } catch (error) {
        console.error('Error fetching game content:', error);
      }
    };
    fetchContent();
  }, [managingContent]);

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-20 text-center space-y-4">
        <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have administrative privileges.</p>
      </div>
    );
  }

  const handleResolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' });
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    } catch (error) {
      console.error('Error resolving report:', error);
    }
  };

  const handleBanUser = async (uid: string, isBanned: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isBanned });
      setUsers(users.map(u => u.uid === uid ? { ...u, isBanned } : u));
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const handleBanGame = async (gameId: string, isBanned: boolean) => {
    try {
      await updateDoc(doc(db, 'games', gameId), { isBanned });
      setGames(games.map(g => g.id === gameId ? { ...g, isBanned } : g));
    } catch (error) {
      console.error('Error banning game:', error);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this game?')) return;
    try {
      await deleteDoc(doc(db, 'games', gameId));
      setGames(games.filter(g => g.id !== gameId));
    } catch (error) {
      console.error('Error deleting game:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      setGameComments(gameComments.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleDeleteRating = async (ratingId: string) => {
    try {
      await deleteDoc(doc(db, 'ratings', ratingId));
      setGameRatings(gameRatings.filter(r => r.id !== ratingId));
    } catch (error) {
      console.error('Error deleting rating:', error);
    }
  };

  const handleUpdateGameStats = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;
    try {
      await updateDoc(doc(db, 'games', editingGame.id), {
        likes: editingGame.likes,
        playCount: editingGame.playCount,
        trendingScore: editingGame.trendingScore
      });
      setGames(games.map(g => g.id === editingGame.id ? editingGame : g));
      setEditingGame(null);
    } catch (error) {
      console.error('Error updating game stats:', error);
    }
  };

  const handleSyncGames = async () => {
    if (!window.confirm('This will update all games to ensure they have required fields like isBanned, trendingScore, etc. Continue?')) return;
    setSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'games'));
      setSyncProgress({ current: 0, total: snap.docs.length });
      
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const updates: any = {};
        
        if (data.isBanned === undefined) updates.isBanned = false;
        if (data.trendingScore === undefined) updates.trendingScore = 0;
        if (data.playCount === undefined) updates.playCount = 0;
        if (data.likes === undefined) updates.likes = 0;
        if (data.dislikes === undefined) updates.dislikes = 0;
        if (data.avgRating === undefined) updates.avgRating = 0;
        if (data.ratingCount === undefined) updates.ratingCount = 0;
        if (data.isPublic === undefined) updates.isPublic = true;
        if (data.controlMappings === undefined) updates.controlMappings = [];

        if (Object.keys(updates).length > 0) {
          await updateDoc(d.ref, updates);
        }
        count++;
        setSyncProgress(prev => ({ ...prev, current: count }));
      }
      alert('Database sync complete!');
    } catch (error) {
      console.error('Error syncing games:', error);
      alert('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSeedGames = async () => {
    if (!window.confirm('This will add default games to the database. Continue?')) return;
    setSeeding(true);
    try {
      await seedDefaultGames();
      alert('Default games seeded successfully!');
      // Refresh games list if on games tab
      if (activeTab === 'games') {
        const q = query(collection(db, 'games'), limit(100));
        const snap = await getDocs(q);
        setGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
      }
    } catch (error) {
      console.error('Error seeding games:', error);
      alert('Seeding failed.');
    } finally {
      setSeeding(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGames = games.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Admin Control Panel
          </h1>
          <p className="text-muted-foreground">Manage users, games, and reports.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-muted rounded-xl w-fit overflow-x-auto">
        {[
          { id: 'reports', label: 'Reports', icon: Flag },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'games', label: 'Games', icon: Gamepad2 },
          { id: 'maintenance', label: 'Maintenance', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
              activeTab === tab.id 
                ? "bg-background text-primary shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      {activeTab !== 'reports' && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border bg-card focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Fetching data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'reports' && (
            <div className="grid gap-4">
              {reports.length > 0 ? reports.map(report => (
                <div key={report.id} className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-destructive/10 rounded-lg">
                        <Flag className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <h3 className="font-bold">Report for: {report.gameTitle}</h3>
                        <p className="text-xs text-muted-foreground">Reported by {report.reporterName} • {new Date(report.createdAt?.toDate()).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      report.status === 'resolved' ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {report.status}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl text-sm italic">
                    "{report.reason}"
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to={`/games/${report.gameId}`} className="text-sm text-primary hover:underline font-medium">View Game</Link>
                    {report.status === 'pending' && (
                      <button 
                        onClick={() => handleResolveReport(report.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-all"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                  <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground">No reports found.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="grid gap-4">
              {filteredUsers.map(u => (
                <div key={u.uid} className="p-6 bg-card border rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Users className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        {u.displayName}
                        {u.isBanned && <span className="text-[10px] bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">BANNED</span>}
                      </h3>
                      <p className="text-xs text-muted-foreground">{u.email} • @{u.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link to={`/users/${u.username || u.uid}`} className="p-2 rounded-lg hover:bg-muted transition-colors" title="View Profile">
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </Link>
                    <button 
                      onClick={() => handleBanUser(u.uid, !u.isBanned)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        u.isBanned ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      )}
                      title={u.isBanned ? "Unban User" : "Ban User"}
                    >
                      <Ban className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'games' && (
            <div className="grid gap-4">
              {filteredGames.map(g => (
                <div key={g.id} className="p-6 bg-card border rounded-2xl shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                    <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {g.thumbnailUrl ? (
                        <img src={g.thumbnailUrl} alt={g.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Gamepad2 className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                      <div>
                        <h3 className="font-bold flex items-center gap-2">
                          {g.title}
                          {g.isBanned && <span className="text-[10px] bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">BANNED</span>}
                        </h3>
                        <p className="text-xs text-muted-foreground">by {g.authorName} • {g.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setManagingContent({ gameId: g.id, title: g.title })}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Manage Comments/Ratings"
                      >
                        <MessageSquare className="w-5 h-5 text-muted-foreground" />
                      </button>
                      <button 
                        onClick={() => setEditingGame(g)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                        title="Edit Stats"
                      >
                        <Edit3 className="w-5 h-5 text-muted-foreground" />
                      </button>
                      <button 
                        onClick={() => handleBanGame(g.id, !g.isBanned)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          g.isBanned ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        )}
                        title={g.isBanned ? "Unban Game" : "Ban Game"}
                      >
                        <Ban className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteGame(g.id)}
                        className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        title="Delete Game"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-muted/30 rounded-xl">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Plays</div>
                      <div className="text-lg font-extrabold">{g.playCount}</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-xl">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Likes</div>
                      <div className="text-lg font-extrabold">{g.likes}</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-xl">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">Score</div>
                      <div className="text-lg font-extrabold">{g.trendingScore?.toFixed(1) || '0.0'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="p-8 bg-card border rounded-3xl space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Database Maintenance</h3>
                <p className="text-muted-foreground">Tools to keep the database healthy and fix issues with old data.</p>
              </div>

              <div className="p-6 bg-muted/30 rounded-2xl border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold">Sync Game Data</h4>
                    <p className="text-sm text-muted-foreground">Ensures all games have required fields (isBanned, trendingScore, etc.). Fixes visibility issues for old games.</p>
                  </div>
                  <button
                    disabled={syncing}
                    onClick={handleSyncGames}
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {syncing ? 'Syncing...' : 'Start Sync'}
                  </button>
                </div>
                {syncing && (
                  <div className="space-y-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300" 
                        style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-center font-bold text-primary">
                      Processing {syncProgress.current} of {syncProgress.total} games...
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-muted/30 rounded-2xl border space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold">Seed Default Games</h4>
                    <p className="text-sm text-muted-foreground">Adds a set of high-quality default games to the platform.</p>
                  </div>
                  <button
                    disabled={seeding}
                    onClick={handleSeedGames}
                    className="bg-accent text-accent-foreground px-6 py-2 rounded-xl font-bold hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {seeding ? 'Seeding...' : 'Seed Games'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Game Stats Modal */}
      <AnimatePresence>
        {editingGame && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingGame(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <Edit3 className="w-6 h-6 text-primary" />
                  Edit Game Stats
                </h3>
                <button onClick={() => setEditingGame(null)} className="p-2 rounded-full hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateGameStats} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Play Count</label>
                  <input
                    type="number"
                    value={editingGame.playCount}
                    onChange={(e) => setEditingGame({ ...editingGame, playCount: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Likes</label>
                  <input
                    type="number"
                    value={editingGame.likes}
                    onChange={(e) => setEditingGame({ ...editingGame, likes: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Trending Score</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingGame.trendingScore}
                    onChange={(e) => setEditingGame({ ...editingGame, trendingScore: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl border bg-background outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingGame(null)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold border hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Content Modal */}
      <AnimatePresence>
        {managingContent && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManagingContent(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-card border rounded-3xl p-8 shadow-2xl space-y-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-primary" />
                  Manage Content: {managingContent.title}
                </h3>
                <button onClick={() => setManagingContent(null)} className="p-2 rounded-full hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                {/* Comments */}
                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments ({gameComments.length})
                  </h4>
                  <div className="space-y-3">
                    {gameComments.map(comment => (
                      <div key={comment.id} className="p-4 bg-muted/30 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-xs font-bold mb-1">
                            <span>{comment.userName}</span>
                            <span className="text-muted-foreground">{new Date(comment.createdAt?.toDate()).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm">{comment.text}</p>
                        </div>
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {gameComments.length === 0 && <p className="text-sm text-muted-foreground italic">No comments found.</p>}
                  </div>
                </div>

                {/* Ratings */}
                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Ratings ({gameRatings.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {gameRatings.map(rating => (
                      <div key={rating.id} className="p-4 bg-muted/30 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-yellow-500">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="font-bold">{rating.value}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">by {rating.userId.slice(0, 8)}...</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteRating(rating.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {gameRatings.length === 0 && <p className="text-sm text-muted-foreground italic">No ratings found.</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
