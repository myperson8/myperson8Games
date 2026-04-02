import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment, collection, query, where, limit, getDocs, setDoc, deleteDoc, orderBy, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Game, Like, UserProfile, Comment, Rating } from '../types';
import { useAuthState } from 'react-firebase-hooks/auth';
import { ThumbsUp, ThumbsDown, Share2, Users, Calendar, User, Info, Keyboard, ChevronRight, MessageSquare, Star, Send, Trash2, Loader2, EyeOff, Edit, Maximize2, Minimize2, MousePointer2, ScrollText, Flag, ShieldAlert, Play, Gamepad2, X } from 'lucide-react';
import { GameCard } from '../components/GameCard';
import { GameBar } from '../components/GameBar';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getDeviceType } from '../lib/device';
import { Smartphone, Monitor, Gamepad } from 'lucide-react';

export function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const [user] = useAuthState(auth);
  const [game, setGame] = useState<Game | null>(null);
  const [recommended, setRecommended] = useState<Game[]>([]);
  const [userLike, setUserLike] = useState<Like | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isGesturesCaptured, setIsGesturesCaptured] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Comments & Ratings state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userRating, setUserRating] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [showControlsModal, setShowControlsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (isGesturesCaptured) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.touchAction = 'auto';
    };
  }, [isGesturesCaptured]);

  useEffect(() => {
    const fetchGameData = async () => {
      if (!id) return;
      setLoading(true);
      setIsPlaying(false);
      setShowVideo(false);
      try {
        const gameDoc = await getDoc(doc(db, 'games', id));
        if (gameDoc.exists()) {
          const gameData = { id: gameDoc.id, ...gameDoc.data() } as Game;
          setGame(gameData);

          // Increment play count and device stats
          const device = getDeviceType();
          await updateDoc(doc(db, 'games', id), {
            playCount: increment(1),
            [`deviceStats.${device}`]: increment(1)
          });

          // Update user's played history
          if (user) {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const profile = userSnap.data() as UserProfile;
              const playedIds = profile.playedGameIds || [];
              const recentPlayed = profile.recentlyPlayed || [];
              const favCats = profile.favoriteCategories || [];
              
              // Update playedGameIds
              const newPlayedIds = playedIds.includes(id) ? playedIds : [...playedIds, id];
              
              // Update recentlyPlayed (keep last 10, move current to front)
              const filteredRecent = recentPlayed.filter(rid => rid !== id);
              const newRecent = [id, ...filteredRecent].slice(0, 10);

              await updateDoc(userRef, {
                playedGameIds: newPlayedIds,
                recentlyPlayed: newRecent,
                favoriteCategories: Array.from(new Set([...favCats, gameData.category]))
              });
            } else {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                playedGameIds: [id],
                recentlyPlayed: [id],
                favoriteCategories: [gameData.category],
                createdAt: serverTimestamp()
              });
            }

            // Check if user liked/disliked
            const likeQuery = query(
              collection(db, 'likes'),
              where('userId', '==', user.uid),
              where('gameId', '==', id)
            );
            const likeSnap = await getDocs(likeQuery);
            if (!likeSnap.empty) {
              setUserLike({ id: likeSnap.docs[0].id, ...likeSnap.docs[0].data() } as Like);
            }

            // Check user rating
            const ratingQuery = query(
              collection(db, 'ratings'),
              where('userId', '==', user.uid),
              where('gameId', '==', id)
            );
            const ratingSnap = await getDocs(ratingQuery);
            if (!ratingSnap.empty) {
              setUserRating(ratingSnap.docs[0].data().value);
            }
          }

          // Fetch recommended games (same category)
          const recQuery = query(
            collection(db, 'games'),
            where('category', '==', gameData.category),
            limit(5)
          );
          const recSnap = await getDocs(recQuery);
          setRecommended(recSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Game))
            .filter(g => g.id !== id)
          );
        }
      } catch (error) {
        console.error('Error fetching game:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();

    // Real-time comments
    if (id) {
      const q = query(
        collection(db, 'comments'),
        where('gameId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const unsubscribeComments = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      });

      // Real-time ratings summary
      const rq = query(collection(db, 'ratings'), where('gameId', '==', id));
      const unsubscribeRatings = onSnapshot(rq, (snapshot) => {
        const ratings = snapshot.docs.map(doc => doc.data().value);
        if (ratings.length > 0) {
          const sum = ratings.reduce((a, b) => a + b, 0);
          setAvgRating(sum / ratings.length);
          setTotalRatings(ratings.length);
        } else {
          setAvgRating(0);
          setTotalRatings(0);
        }
      });

      return () => {
        unsubscribeComments();
        unsubscribeRatings();
      };
    }
  }, [id, user]);

  const updateGameScore = async (gameId: string) => {
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId));
      if (!gameDoc.exists()) return;
      const data = gameDoc.data();
      
      // Calculate average rating from ratings collection
      const rq = query(collection(db, 'ratings'), where('gameId', '==', gameId));
      const rSnap = await getDocs(rq);
      const ratings = rSnap.docs.map(d => d.data().value);
      const count = ratings.length;
      const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : 0;
      
      // Score = (likes * 2) - (dislikes) + (avgRating * 10) + (playCount / 100)
      const score = (data.likes * 2) - (data.dislikes) + (avg * 10) + (data.playCount / 100);
      
      await updateDoc(doc(db, 'games', gameId), {
        avgRating: avg,
        ratingCount: count,
        trendingScore: score
      });
    } catch (error) {
      console.error('Error updating game score:', error);
    }
  };

  useEffect(() => {
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (!isPlaying) {
        setShowVideo(false);
        idleTimerRef.current = setTimeout(() => {
          if (game?.videoUrl) {
            setShowVideo(true);
          }
        }, 3000);
      }
    };

    const handleInteraction = () => {
      resetIdleTimer();
    };

    if (!isPlaying && game?.videoUrl) {
      window.addEventListener('mousemove', handleInteraction);
      window.addEventListener('keydown', handleInteraction);
      window.addEventListener('touchstart', handleInteraction);
      resetIdleTimer();
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, [isPlaying, game?.videoUrl]);

  const handleLike = async (type: 'like' | 'dislike') => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (!game || !id) return;

    try {
      if (userLike) {
        if (userLike.type === type) {
          // Remove like/dislike
          await deleteDoc(doc(db, 'likes', userLike.id));
          await updateDoc(doc(db, 'games', id), {
            [type === 'like' ? 'likes' : 'dislikes']: increment(-1)
          });
          setUserLike(null);
        } else {
          // Switch like to dislike or vice versa
          await updateDoc(doc(db, 'likes', userLike.id), { type });
          await updateDoc(doc(db, 'games', id), {
            [type === 'like' ? 'likes' : 'dislikes']: increment(1),
            [type === 'like' ? 'dislikes' : 'likes']: increment(-1)
          });
          setUserLike({ ...userLike, type });
        }
      } else {
        // Add new like/dislike
        const likeRef = doc(collection(db, 'likes'));
        await setDoc(likeRef, {
          userId: user.uid,
          gameId: id,
          type
        });
        await updateDoc(doc(db, 'games', id), {
          [type === 'like' ? 'likes' : 'dislikes']: increment(1)
        });
        setUserLike({ id: likeRef.id, userId: user.uid, gameId: id, type });
      }

      await updateGameScore(id);

      // Refresh game data for counts
      const updatedGame = await getDoc(doc(db, 'games', id));
      setGame({ id: updatedGame.id, ...updatedGame.data() } as Game);
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleRating = async (value: number) => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (!id) return;
    try {
      const ratingQuery = query(
        collection(db, 'ratings'),
        where('userId', '==', user.uid),
        where('gameId', '==', id)
      );
      const ratingSnap = await getDocs(ratingQuery);
      
      if (!ratingSnap.empty) {
        await updateDoc(doc(db, 'ratings', ratingSnap.docs[0].id), { value });
      } else {
        await addDoc(collection(db, 'ratings'), {
          userId: user.uid,
          gameId: id,
          value,
          createdAt: serverTimestamp()
        });
      }
      setUserRating(value);
      await updateGameScore(id);
    } catch (error) {
      console.error('Error rating game:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const profile = userDoc.data() as UserProfile;

      await addDoc(collection(db, 'comments'), {
        gameId: id,
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userUsername: profile.username,
        userPhoto: user.photoURL || '',
        text: newComment.trim(),
        createdAt: serverTimestamp()
      });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !game || !reportReason.trim()) return;

    setSubmittingReport(true);
    try {
      await addDoc(collection(db, 'reports'), {
        gameId: id,
        gameTitle: game.title,
        reporterUid: user.uid,
        reporterName: user.displayName || 'Anonymous',
        reason: reportReason.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setShowReportModal(false);
      setReportReason('');
      alert('Game reported successfully. Admins will review it.');
    } catch (error) {
      console.error('Error reporting game:', error);
      alert('Failed to report game. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const toggleFocusMode = () => {
    setIsFocusMode(!isFocusMode);
    if (isFocusMode) {
      setIsGesturesCaptured(false);
    }
  };

  const toggleGestureCapture = () => {
    setIsGesturesCaptured(!isGesturesCaptured);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Loading game...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-black tracking-tighter mb-4">Game not found</h2>
        <Link to="/" className="text-primary font-bold uppercase tracking-widest text-xs hover:underline">Back to Home</Link>
      </div>
    );
  }

  const isAuthor = user?.uid === game.authorId;

  if (!game.isPublic && !isAuthor) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-4 space-y-6">
        <div className="bg-destructive/10 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto">
          <EyeOff className="w-10 h-10 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black tracking-tighter">This game is private</h2>
          <p className="text-muted-foreground font-medium">Only the author can view this game.</p>
        </div>
        <Link to="/" className="text-primary font-bold uppercase tracking-widest text-xs hover:underline block">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-20">
      {/* Game Header Section */}
      <div className="relative w-full bg-[#0a0a0a] border-b border-white/5 pt-8 pb-12">
        <div className="container mx-auto px-4 flex flex-col items-center text-center space-y-8">
          {/* Game Preview Area */}
          <div className="relative w-full max-w-2xl aspect-video rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group">
            {isPlaying ? (
              <iframe
                ref={iframeRef}
                srcDoc={game.htmlContent}
                className="w-full h-full border-none"
                title={game.title}
                sandbox="allow-scripts allow-same-origin"
                allowFullScreen
              />
            ) : (
              <>
                <AnimatePresence mode="wait">
                  {showVideo && game.videoUrl ? (
                    <motion.video
                      key="video"
                      ref={videoRef}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      src={game.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <motion.img
                      key="thumbnail"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      src={game.thumbnailUrl || 'https://picsum.photos/seed/' + game.id + '/1920/1080'}
                      alt={game.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </AnimatePresence>
                
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  {!isPlaying && (
                    <>
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
                        {game.category}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsPlaying(true)}
                        className="w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-2xl shadow-primary/40 group/play"
                      >
                        <Play className="w-8 h-8 fill-current ml-1 group-hover/play:scale-110 transition-transform" />
                      </motion.button>
                    </>
                  )}
                </div>
              </>
            )}
            
            <GameBar
              isPlaying={isPlaying}
              onPlay={() => setIsPlaying(true)}
              onStop={() => setIsPlaying(false)}
              isFocusMode={isFocusMode}
              onToggleFocus={toggleFocusMode}
              isGesturesCaptured={isGesturesCaptured}
              onToggleGestures={toggleGestureCapture}
              onShowControls={() => setShowControlsModal(true)}
              deviceStats={game.deviceStats}
              iframeRef={iframeRef}
            />
          </div>
              
            <div className="flex items-center justify-center gap-3">
              <button 
                onClick={() => setShowControlsModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest"
              >
                <Keyboard className="w-4 h-4" />
                Action
              </button>
              <button
                onClick={() => handleLike('like')}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-black text-xs uppercase tracking-widest",
                  userLike?.type === 'like' && "text-primary bg-primary/10 border-primary/20"
                )}
              >
                <ThumbsUp className={cn("w-4 h-4", userLike?.type === 'like' && "fill-current")} />
                {game.likes >= 1000 ? (game.likes / 1000).toFixed(1) + 'K' : game.likes}
              </button>
              <button
                onClick={() => handleLike('dislike')}
                className={cn(
                  "p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all",
                  userLike?.type === 'dislike' && "text-destructive bg-destructive/10 border-destructive/20"
                )}
              >
                <ThumbsDown className={cn("w-4 h-4", userLike?.type === 'dislike' && "fill-current")} />
              </button>
              <button className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                <Star className="w-4 h-4" />
              </button>
              <button onClick={handleShare} className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                <Share2 className="w-4 h-4" />
              </button>
              <button className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      <div className="container mx-auto px-4 py-12 space-y-16">
        {/* Related Games Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-widest text-muted-foreground">More games like this</h2>
            <Link to="/" className="text-xs font-black uppercase tracking-widest text-primary hover:underline">Show more games</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {recommended.map(g => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>

        {/* Game Details & Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Link to="/home" className="hover:text-primary">Games</Link>
              <ChevronRight className="w-3 h-3" />
              <Link to={`/category/${game.category}`} className="hover:text-primary">{game.category}</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white">{game.title}</span>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-black tracking-tighter">{game.title}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-sm">
                  <div className="flex justify-between py-3 border-b border-white/5">
                    <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Developer:</span>
                    <Link to={`/users/${game.authorUsername || game.authorId}`} className="font-black text-primary hover:underline">{game.authorName}</Link>
                  </div>
                <div className="flex justify-between py-3 border-b border-white/5">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Rating:</span>
                  <span className="font-black">{avgRating.toFixed(1)} ({totalRatings} votes)</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Released:</span>
                  <span className="font-black">{new Date(game.createdAt?.toDate()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Technology:</span>
                  <span className="font-black">HTML5</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Platforms:</span>
                  <span className="font-black">Browser (desktop, mobile, tablet)</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Mobile Players:</span>
                  <span className="font-black">{game.deviceStats?.mobile || 0}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/5">
                  <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Console Players:</span>
                  <span className="font-black">{game.deviceStats?.console || 0}</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Link to={`/category/${game.category}`} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                {game.category} <span className="text-muted-foreground">522</span>
              </Link>
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                Mobile <span className="text-muted-foreground">1,900</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                3D <span className="text-muted-foreground">1,320</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed text-sm font-medium">
                {game.description}
              </p>
            </div>

            {/* Controls */}
            <div className="space-y-6">
              <h3 className="text-xl font-black tracking-tight">Controls</h3>
              <div className="p-8 bg-white/5 rounded-3xl border border-white/5 space-y-6">
                {game.controlMappings && game.controlMappings.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {game.controlMappings.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{m.action}</span>
                        <kbd className="px-3 py-1.5 rounded-lg bg-white/10 border-b-2 border-white/20 font-mono text-[10px] font-black text-primary">
                          {m.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground italic">
                    {game.controls}
                  </p>
                )}
                {game.controlMappings && game.controlMappings.length > 0 && game.controls && (
                  <p className="text-xs text-muted-foreground italic pt-4 border-t border-white/5">
                    {game.controls}
                  </p>
                )}
              </div>
            </div>

            {/* Back to game button */}
            <div className="flex justify-center pt-8">
              <button 
                onClick={() => {
                  setIsPlaying(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
              >
                <Play className="w-4 h-4 fill-current" />
                Back to game
              </button>
            </div>
          </div>

          {/* Sidebar - Comments & Ratings */}
          <div className="lg:col-span-4 space-y-8">
            {/* Rating Summary */}
            <div className="p-8 bg-card rounded-3xl border border-white/5 space-y-6">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Rate this game</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRating(star)}
                      className={cn(
                        "p-1 transition-all hover:scale-110",
                        userRating >= star ? "text-yellow-500" : "text-white/10 hover:text-yellow-500/50"
                      )}
                    >
                      <Star className={cn("w-6 h-6", userRating >= star && "fill-current")} />
                    </button>
                  ))}
                </div>
                <span className="text-xl font-black">{avgRating.toFixed(1)}</span>
              </div>
            </div>

            {/* Comments Section */}
            <div className="p-8 bg-card rounded-3xl border border-white/5 space-y-6">
              <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground">Comments ({comments.length})</h3>
              
              {user ? (
                <form onSubmit={handleAddComment} className="relative">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all min-h-[100px] resize-none"
                  />
                  <button
                    disabled={submittingComment || !newComment.trim()}
                    type="submit"
                    className="absolute bottom-4 right-4 p-2 bg-primary text-primary-foreground rounded-xl disabled:opacity-50"
                  >
                    {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-white/5 rounded-2xl text-center space-y-3">
                  <p className="text-xs font-bold text-muted-foreground">Login to join the conversation</p>
                  <Link to="/login" className="block w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest">Login</Link>
                </div>
              )}

              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-2 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg overflow-hidden bg-white/10">
                          {comment.userPhoto ? (
                            <img src={comment.userPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <Link 
                          to={`/users/${comment.userUsername || comment.userId}`}
                          className="text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors"
                        >
                          {comment.userName}
                        </Link>
                      </div>
                      {user?.uid === comment.userId && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                      {comment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Prompt Modal */}
      <AnimatePresence>
        {showLoginPrompt && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginPrompt(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-white/10 rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto">
                <Gamepad2 className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black tracking-tighter">Login Required</h3>
                <p className="text-sm text-muted-foreground font-medium">You need to be logged in to perform this action.</p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20"
                >
                  Login now
                </Link>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="w-full py-4 bg-white/5 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Controls Modal */}
      <AnimatePresence>
        {showControlsModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowControlsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-card border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                    <Keyboard className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black tracking-tighter">Game Controls</h3>
                </div>
                <button 
                  onClick={() => setShowControlsModal(false)}
                  className="p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-white/5 rounded-3xl space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">How to Play</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {game.controls || 'No specific controls provided for this game.'}
                  </p>
                </div>

                {game.controlMappings && game.controlMappings.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Key Mappings</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {game.controlMappings.map((mapping, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                          <span className="text-sm font-bold">{mapping.action}</span>
                          <kbd className="px-3 py-1 bg-white/10 rounded-lg text-xs font-black border-b-2 border-black/40">
                            {mapping.key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowControlsModal(false)}
                className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20"
              >
                Got it!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
