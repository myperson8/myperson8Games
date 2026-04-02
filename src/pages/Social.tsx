import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion, onSnapshot, orderBy, limit, deleteDoc, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, FriendRequest, Chat, GameInvitation } from '../types';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User, MessageSquare, Gamepad2, UserPlus, CheckCircle2, XCircle, Loader2, Users, Bell, MessageCircle, Search, ArrowRight, Ghost } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export function Social() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [invitations, setInvitations] = useState<GameInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'chats' | 'invitations'>('friends');

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    // Listen for pending requests
    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubRequests = onSnapshot(requestsQuery, (snap) => {
      setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest)));
    });

    // Listen for invitations
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubInvitations = onSnapshot(invitationsQuery, (snap) => {
      setInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() } as GameInvitation)));
    });

    // Listen for chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubChats = onSnapshot(chatsQuery, (snap) => {
      setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat)));
    });

    // Fetch friends
    const fetchFriends = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;
        const friendUids = profile.friends || [];
        
        if (friendUids.length > 0) {
          // Firestore 'in' query limited to 10 items, for a real app we'd paginate or use multiple queries
          const friendsQuery = query(collection(db, 'users'), where('uid', 'in', friendUids.slice(0, 10)));
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        } else {
          setFriends([]);
        }
      }
      setLoading(false);
    };
    fetchFriends();

    return () => {
      unsubRequests();
      unsubInvitations();
      unsubChats();
    };
  }, [user]);

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), { status: 'accepted' });
      await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(request.fromUid) });
      await updateDoc(doc(db, 'users', request.fromUid), { friends: arrayUnion(user.uid) });
      
      const chatQuery = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const chatSnap = await getDocs(chatQuery);
      const existingChat = chatSnap.docs.find(d => (d.data().participants as string[]).includes(request.fromUid));
      
      if (!existingChat) {
        await addDoc(collection(db, 'chats'), {
          participants: [user.uid, request.fromUid],
          updatedAt: new Date().toISOString(),
          lastMessage: 'You are now friends! Start chatting.'
        });
      }
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleDeclineRequest = async (request: FriendRequest) => {
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), { status: 'declined' });
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse font-black uppercase tracking-widest text-xs">Syncing Social Data...</p>
    </div>
  );

  if (!user) return (
    <div className="container mx-auto px-4 py-20 text-center space-y-6 max-w-md">
      <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
        <Users className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-3xl font-black tracking-tight">Login Required</h1>
      <p className="text-muted-foreground">You need to be logged in to connect with other gamers and manage your social hub.</p>
      <Link to="/login" className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-black hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
        Login Now
      </Link>
    </div>
  );

  const tabs = [
    { id: 'friends', label: 'Friends', icon: Users, count: friends.length, color: 'text-primary' },
    { id: 'requests', label: 'Requests', icon: Bell, count: pendingRequests.length, color: 'text-yellow-500' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, count: chats.length, color: 'text-accent' },
    { id: 'invitations', label: 'Invites', icon: Gamepad2, count: invitations.length, color: 'text-secondary' },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter">Social Hub</h1>
          </div>
          <p className="text-muted-foreground font-medium pl-1">Build your squad and conquer the leaderboard together.</p>
        </div>

        <div className="flex flex-wrap gap-2 p-1.5 bg-card/50 backdrop-blur-xl border border-white/5 rounded-[2rem] shadow-xl">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-black transition-all relative",
                activeTab === tab.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-white" : tab.color)} />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-black",
                  activeTab === tab.id ? "bg-white text-primary" : "bg-primary text-white"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card/30 backdrop-blur-xl border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black tracking-tight">Your Squad</h2>
                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/30 px-4 py-2 rounded-xl">
                  {friends.length} Active Friends
                </div>
              </div>
              
              {friends.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {friends.map((friend, i) => (
                    <motion.div 
                      key={friend.uid}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between p-6 rounded-[2rem] border border-white/5 bg-card/50 hover:border-primary/30 hover:bg-card transition-all group shadow-lg"
                    >
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-primary/20 group-hover:border-primary transition-all flex items-center justify-center">
                            {friend.photoURL ? (
                              <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-8 h-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                        </div>
                        <div>
                          <p className="font-black text-lg group-hover:text-primary transition-colors">{friend.displayName}</p>
                          <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest">@{friend.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/users/${friend.username || friend.uid}`}
                          className="p-3 rounded-2xl bg-muted/50 hover:bg-muted text-muted-foreground transition-all"
                          title="View Profile"
                        >
                          <User className="w-5 h-5" />
                        </Link>
                        <button 
                          onClick={() => navigate(`/social/chat/${friend.uid}`)}
                          className="p-3 rounded-2xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all shadow-sm"
                          title="Message"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 space-y-6 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                  <div className="bg-muted/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                    <Ghost className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black">Lone Wolf?</p>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                      Your friends list is empty. Use the search bar to find other gamers by their unique username!
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-black tracking-tight">Incoming Requests</h2>
              {pendingRequests.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {pendingRequests.map((request, i) => (
                    <motion.div 
                      key={request.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center justify-between p-6 rounded-[2rem] border border-white/5 bg-card/50 shadow-xl"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-yellow-500/20 flex items-center justify-center">
                          {request.fromPhoto ? (
                            <img src={request.fromPhoto} alt={request.fromName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <User className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-lg">{request.fromName}</p>
                          <p className="text-xs text-muted-foreground font-medium">Sent you a friend request</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleAcceptRequest(request)}
                          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                          <CheckCircle2 className="w-5 h-5" /> Accept
                        </button>
                        <button 
                          onClick={() => handleDeclineRequest(request)}
                          className="p-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all border border-destructive/20"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-4">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No pending requests</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-black tracking-tight">Active Chats</h2>
              {chats.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {chats.map((chat, i) => (
                    <motion.button 
                      key={chat.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/social/chat/${chat.participants.find(p => p !== user.uid)}`)}
                      className="w-full flex items-center justify-between p-6 rounded-[2rem] border border-white/5 bg-card/50 hover:border-accent/30 hover:bg-card transition-all text-left group shadow-lg"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center border-2 border-accent/20 group-hover:border-accent transition-all">
                          <MessageCircle className="w-8 h-8 text-accent" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-black text-lg group-hover:text-accent transition-colors">Direct Message</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[250px] font-medium">{chat.lastMessage}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/30 px-3 py-1 rounded-lg">
                          {new Date(chat.updatedAt).toLocaleDateString()}
                        </span>
                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-4">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">No active conversations</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'invitations' && (
            <motion.div
              key="invitations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black tracking-tight">Game Invites</h2>
                <div className="text-xs font-black uppercase tracking-widest text-muted-foreground bg-muted/30 px-4 py-2 rounded-xl">
                  {invitations.length} Pending
                </div>
              </div>
              
              {invitations.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {invitations.map((invite, i) => (
                    <motion.div 
                      key={invite.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-[2.5rem] border border-white/5 bg-card/50 shadow-xl gap-6 group"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center border-2 border-secondary/20 group-hover:border-secondary transition-all shrink-0">
                          <Gamepad2 className="w-10 h-10 text-secondary" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-black text-xl group-hover:text-secondary transition-colors">{invite.fromName}</p>
                          <p className="text-sm text-muted-foreground font-medium">
                            Challenged you to play <span className="text-secondary font-black underline decoration-2 underline-offset-4">{invite.gameTitle}</span>
                          </p>
                          <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest pt-1">
                            {new Date(invite.createdAt?.toDate?.() || Date.now()).toLocaleDateString()} • {new Date(invite.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <button 
                          onClick={() => navigate(`/games/${invite.gameId}`)}
                          className="flex-1 md:flex-none px-10 py-4 rounded-2xl bg-secondary text-secondary-foreground font-black text-sm hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
                        >
                          <Gamepad2 className="w-5 h-5" />
                          Accept & Play
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'invitations', invite.id));
                            } catch (error) {
                              console.error('Error deleting invitation:', error);
                            }
                          }}
                          className="p-4 rounded-2xl bg-muted/50 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all border border-white/5"
                          title="Dismiss"
                        >
                          <XCircle className="w-6 h-6" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-6">
                  <div className="bg-muted/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                    <Gamepad2 className="w-12 h-12 text-muted-foreground opacity-20" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black">No Challenges</p>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto font-medium">
                      Your inbox is quiet. Invite your friends to a game from their profile or chat!
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
