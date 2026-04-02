import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Game } from '../types';
import { Gamepad2, Edit, Trash2, Eye, EyeOff, Play, Loader2, Plus, Star, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORY_THUMBNAILS } from '../constants';

export function MyGames() {
  const [user] = useAuthState(auth);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyGames = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'games'),
          where('authorId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
      } catch (error) {
        console.error('Error fetching my games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMyGames();
  }, [user]);

  const handleDelete = async (gameId: string) => {
    setDeletingId(gameId);
    try {
      await deleteDoc(doc(db, 'games', gameId));
      setGames(prev => prev.filter(g => g.id !== gameId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) return <div className="text-center py-20">Please login to manage your games.</div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight">My Games</h1>
            <p className="text-muted-foreground">Manage your published and private games.</p>
          </div>
          <Link
            to="/upload"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
          >
            <Plus className="w-5 h-5" />
            Upload New
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : games.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {games.map((game) => (
                <motion.div
                  key={game.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card border rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-shadow"
                >
                  <div className="w-full md:w-48 aspect-video rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
                    <img 
                      src={game.thumbnailUrl || CATEGORY_THUMBNAILS[game.category] || CATEGORY_THUMBNAILS['Other']} 
                      alt={game.title} 
                      className="w-full h-full object-cover" 
                    />
                    {!game.isPublic && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-lg backdrop-blur-sm">
                        <EyeOff className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <h3 className="text-xl font-bold">{game.title}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        {game.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{game.description}</p>
                    <div className="flex items-center justify-center md:justify-start gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {game.playCount} plays</span>
                      {game.avgRating > 0 && (
                        <span className="flex items-center gap-1 text-yellow-500 font-bold">
                          <Star className="w-3 h-3 fill-current" /> {game.avgRating.toFixed(1)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        {game.isPublic ? <><Eye className="w-3 h-3" /> Public</> : <><EyeOff className="w-3 h-3" /> Private</>}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                    <Link
                      to={`/games/${game.id}`}
                      className="p-3 rounded-xl border hover:bg-muted transition-colors"
                      title="View Game"
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <Link
                      to={`/edit/${game.id}`}
                      className="p-3 rounded-xl border hover:bg-muted transition-colors text-primary"
                      title="Edit Game"
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => setShowDeleteConfirm(game.id)}
                      disabled={deletingId === game.id}
                      className="p-3 rounded-xl border hover:bg-destructive/10 transition-colors text-destructive"
                      title="Delete Game"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
            <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold">No games yet</h3>
            <p className="text-muted-foreground mb-6">You haven't uploaded any games yet. Start sharing your creations!</p>
            <Link
              to="/upload"
              className="inline-flex bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all"
            >
              Upload Your First Game
            </Link>
          </div>
        )}
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Delete Game?</h3>
                <p className="text-muted-foreground">
                  Are you sure you want to delete <span className="font-bold text-foreground">"{games.find(g => g.id === showDeleteConfirm)?.title}"</span>? 
                  This action is permanent and cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold border hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deletingId === showDeleteConfirm}
                  className="flex-1 bg-destructive text-destructive-foreground px-6 py-3 rounded-xl font-bold hover:bg-destructive/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deletingId === showDeleteConfirm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
