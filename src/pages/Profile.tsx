import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, onSnapshot, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, Game, FriendRequest } from '../types';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User, MessageSquare, Gamepad2, UserPlus, CheckCircle2, Clock, Loader2, ShieldAlert, Trophy, Calendar, Hash, ExternalLink, Share2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GameCard } from '../components/GameCard';
import { cn } from '../lib/utils';

export function Profile() {
  const { username } = useParams<{ username: string }>();
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userGames, setUserGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const profileData = { uid: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as UserProfile;
          setProfile(profileData);
          fetchSecondaryData(profileData);
        } else {
          // Fallback: try fetching by UID if it's a valid UID format
          const docRef = doc(db, 'users', username);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profileData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
            setProfile(profileData);
            fetchSecondaryData(profileData);
          } else {
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchSecondaryData = async (profileData: UserProfile) => {
      // Fetch user's games
      const gamesQuery = query(collection(db, 'games'), where('authorId', '==', profileData.uid), where('isPublic', '==', true));
      const gamesSnap = await getDocs(gamesQuery);
      setUserGames(gamesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
      
      // Check friendship status
      if (user) {
        if (profileData.friends?.includes(user.uid)) {
          setRequestStatus('friends');
        } else {
          const reqQuery = query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', user.uid),
            where('toUid', '==', profileData.uid),
            where('status', '==', 'pending')
          );
          const reqSnap = await getDocs(reqQuery);
          if (!reqSnap.empty) {
            setRequestStatus('pending');
          }
        }

        // Check following status
        const followRef = doc(db, 'follows', `${user.uid}_${profileData.uid}`);
        const followSnap = await getDoc(followRef);
        setIsFollowing(followSnap.exists());
      }
    };

    fetchProfile();
  }, [username, user]);

  const handleFollow = async () => {
    if (!user || !profile || followLoading) return;
    setFollowLoading(true);
    try {
      const followRef = doc(db, 'follows', `${user.uid}_${profile.uid}`);
      const userRef = doc(db, 'users', user.uid);
      const targetRef = doc(db, 'users', profile.uid);

      if (isFollowing) {
        await deleteDoc(followRef);
        await updateDoc(userRef, { followingCount: increment(-1) });
        await updateDoc(targetRef, { followersCount: increment(-1) });
        setIsFollowing(false);
        setProfile(prev => prev ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) } : null);
      } else {
        await setDoc(followRef, {
          followerId: user.uid,
          followingId: profile.uid,
          createdAt: serverTimestamp()
        });
        await updateDoc(userRef, { followingCount: increment(1) });
        await updateDoc(targetRef, { followersCount: increment(1) });
        setIsFollowing(true);
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : null);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!user || !profile || sendingRequest) return;
    setSendingRequest(true);
    try {
      await addDoc(collection(db, 'friendRequests'), {
        fromUid: user.uid,
        fromName: user.displayName || 'Gamer',
        fromPhoto: user.photoURL || '',
        toUid: profile.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setRequestStatus('pending');
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">Loading Gamer Profile...</p>
    </div>
  );

  if (!profile) return (
    <div className="container mx-auto px-4 py-20 text-center space-y-6">
      <div className="bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
        <ShieldAlert className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold">User Not Found</h1>
      <p className="text-muted-foreground max-w-md mx-auto">
        The user ID you're looking for doesn't exist or has been deactivated.
      </p>
      <Link to="/" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
        Return Home
      </Link>
    </div>
  );

  const isOwnProfile = user?.uid === profile.uid;
  const totalPlays = userGames.reduce((acc, game) => acc + (game.playCount || 0), 0);
  const totalLikes = userGames.reduce((acc, game) => acc + (game.likes || 0), 0);

  return (
    <div className="min-h-screen pb-20">
      {/* Cover Header */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
        <img 
          src={`https://picsum.photos/seed/${profile.username}/1920/1080?blur=10`} 
          alt="Cover" 
          className="w-full h-full object-cover opacity-30"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar: Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl text-center space-y-6"
            >
              <div className="relative inline-block group">
                <div className="w-36 h-36 rounded-full border-4 border-primary/30 overflow-hidden mx-auto bg-muted shadow-2xl group-hover:border-primary transition-all duration-500">
                  {profile.photoURL ? (
                    <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-16 h-16 m-10 text-muted-foreground" />
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <h1 className="text-2xl font-black tracking-tight">{profile.displayName}</h1>
                {profile.username ? (
                  <p className="text-primary font-medium text-sm">@{profile.username}</p>
                ) : (
                  <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Member</p>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 pt-2">
                <button 
                  onClick={handleShare}
                  className="p-3 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground transition-all relative"
                  title="Share Profile"
                >
                  <Share2 className="w-5 h-5" />
                  <AnimatePresence>
                    {showShareTooltip && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-lg whitespace-nowrap font-bold"
                      >
                        Copied!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
                {isOwnProfile ? (
                  <Link 
                    to="/settings"
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    Edit Profile
                  </Link>
                ) : user ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <button 
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={cn(
                        "w-full py-3 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2",
                        isFollowing 
                          ? "bg-muted text-muted-foreground hover:bg-muted/80" 
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-secondary/20"
                      )}
                    >
                      {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <CheckCircle2 className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    {requestStatus === 'friends' ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => navigate(`/social/chat/${profile.uid}`)}
                          className="flex-1 bg-primary text-primary-foreground p-3 rounded-2xl font-black text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" /> Chat
                        </button>
                      </div>
                    ) : requestStatus === 'pending' ? (
                      <div className="w-full bg-muted text-muted-foreground py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border border-white/5">
                        <Clock className="w-4 h-4" /> Pending
                      </div>
                    ) : profile.allowFriendRequests ? (
                      <button 
                        onClick={handleAddFriend}
                        disabled={sendingRequest}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                      >
                        {sendingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Add Friend
                      </button>
                    ) : (
                      <div className="w-full bg-muted/30 text-muted-foreground py-3 rounded-2xl font-bold text-[10px] italic flex items-center justify-center gap-2 border border-white/5">
                        <ShieldAlert className="w-3 h-3" /> Private
                      </div>
                    )}
                  </div>
                ) : (
                  <Link 
                    to="/login"
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    Login to Connect
                  </Link>
                )}
              </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-xl text-center space-y-1">
                <p className="text-2xl font-black text-primary">{userGames.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Games</p>
              </div>
              <div className="bg-card/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-xl text-center space-y-1">
                <p className="text-2xl font-black text-secondary">{profile.followersCount || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Followers</p>
              </div>
              <div className="bg-card/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-xl text-center space-y-1">
                <p className="text-2xl font-black text-accent">{profile.followingCount || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Following</p>
              </div>
              <div className="bg-card/50 backdrop-blur-xl p-6 rounded-[2rem] border border-white/5 shadow-xl text-center space-y-1">
                <p className="text-2xl font-black text-red-500">{totalLikes}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Likes</p>
              </div>
            </div>

            {/* Badges/Achievements Section */}
            <div className="bg-card/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-xl space-y-6">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" /> Achievements
              </h3>
              <div className="flex flex-wrap gap-3">
                {userGames.length >= 1 && (
                  <div className="bg-yellow-500/10 text-yellow-500 p-2 rounded-xl border border-yellow-500/20" title="Creator: Uploaded at least 1 game">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                )}
                {totalPlays >= 100 && (
                  <div className="bg-blue-500/10 text-blue-500 p-2 rounded-xl border border-blue-500/20" title="Popular: Over 100 total plays">
                    <Trophy className="w-5 h-5" />
                  </div>
                )}
                {profile.friends?.length >= 5 && (
                  <div className="bg-green-500/10 text-green-500 p-2 rounded-xl border border-green-500/20" title="Socialite: Has 5 or more friends">
                    <UserPlus className="w-5 h-5" />
                  </div>
                )}
                <div className="bg-primary/10 text-primary p-2 rounded-xl border border-primary/20" title="Member: Joined myperson8Games">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Games & Activity */}
          <div className="lg:col-span-3 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black tracking-tighter">Gamer Library</h2>
                <p className="text-muted-foreground font-medium">Public creations and shared experiences</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-muted/30 p-1 rounded-2xl border">
                <button className="px-4 py-2 rounded-xl bg-background text-primary font-bold text-xs shadow-sm">All Games</button>
                <button className="px-4 py-2 rounded-xl text-muted-foreground font-bold text-xs hover:text-foreground transition-colors">Popular</button>
              </div>
            </div>

            {userGames.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {userGames.map((game, i) => (
                  <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <GameCard game={game} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-32 bg-card/30 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-white/5 space-y-4">
                <div className="bg-muted/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                  <Gamepad2 className="w-10 h-10 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-black">No Public Games</p>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    This gamer hasn't shared any creations with the world yet.
                  </p>
                </div>
                {isOwnProfile && (
                  <Link to="/upload" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                    Upload Your First Game
                  </Link>
                )}
              </div>
            )}

            {/* Favorite Categories / Interests */}
            {profile.favoriteCategories?.length > 0 && (
              <div className="bg-card/50 backdrop-blur-xl p-10 rounded-[3rem] border border-white/5 shadow-xl space-y-6">
                <h3 className="text-2xl font-black tracking-tight">Favorite Genres</h3>
                <div className="flex flex-wrap gap-3">
                  {profile.favoriteCategories.map(cat => (
                    <div key={cat} className="px-6 py-3 rounded-2xl bg-muted/50 border border-white/5 text-sm font-black hover:bg-primary/10 hover:border-primary/30 transition-all cursor-default">
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
