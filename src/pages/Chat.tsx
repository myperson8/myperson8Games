import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, onSnapshot, orderBy, limit, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, Chat, ChatMessage, Game } from '../types';
import { useAuthState } from 'react-firebase-hooks/auth';
import { User, Send, Gamepad2, Loader2, ChevronLeft, MessageSquare, Plus, MoreVertical, ShieldAlert, Ghost, Trophy, Calendar, ArrowLeft, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export function ChatPage() {
  const { friendUid } = useParams<{ friendUid: string }>();
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userGames, setUserGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!user || !friendUid) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        // Fetch friend profile
        const friendDoc = await getDoc(doc(db, 'users', friendUid));
        if (friendDoc.exists()) {
          setFriendProfile({ uid: friendDoc.id, ...friendDoc.data() } as UserProfile);
        }

        // Find or create chat
        const chatsQuery = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', user.uid)
        );
        const chatsSnap = await getDocs(chatsQuery);
        let activeChat = chatsSnap.docs.find(d => {
          const participants = d.data().participants as string[];
          return participants.includes(friendUid);
        });

        if (!activeChat) {
          const newChatRef = await addDoc(collection(db, 'chats'), {
            participants: [user.uid, friendUid],
            updatedAt: new Date().toISOString(),
            lastMessage: 'Chat started'
          });
          const newChatSnap = await getDoc(newChatRef);
          setChat({ id: newChatSnap.id, ...newChatSnap.data() } as Chat);
        } else {
          setChat({ id: activeChat.id, ...activeChat.data() } as Chat);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching chat data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user, friendUid]);

  useEffect(() => {
    if (!chat) return;

    const messagesQuery = query(
      collection(db, 'chats', chat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsub = onSnapshot(messagesQuery, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsub();
  }, [chat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chat || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const msgText = newMessage.trim();
      setNewMessage('');
      
      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        senderUid: user.uid,
        text: msgText,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessage: msgText,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleInviteToPlay = async (game: Game) => {
    if (!user || !friendUid || !chat) return;
    try {
      await addDoc(collection(db, 'invitations'), {
        fromUid: user.uid,
        fromName: user.displayName || 'Gamer',
        toUid: friendUid,
        gameId: game.id,
        gameTitle: game.title,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setShowInviteModal(false);
      
      const inviteText = `🎮 Invited you to play: ${game.title}`;
      await addDoc(collection(db, 'chats', chat.id, 'messages'), {
        senderUid: user.uid,
        text: inviteText,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chat.id), {
        lastMessage: inviteText,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
    }
  };

  const fetchUserGames = async () => {
    if (!user) return;
    const q = query(collection(db, 'games'), where('authorId', '==', user.uid));
    const snap = await getDocs(q);
    setUserGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
    setShowInviteModal(true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse font-black uppercase tracking-widest text-xs">Connecting to Chat Server...</p>
    </div>
  );

  if (!friendProfile || !chat) return (
    <div className="flex flex-col items-center justify-center h-[80vh] space-y-6">
      <div className="bg-destructive/10 p-6 rounded-full">
        <ShieldAlert className="w-12 h-12 text-destructive" />
      </div>
      <h1 className="text-3xl font-black">Chat Not Found</h1>
      <button onClick={() => navigate('/social')} className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-black">Back to Social</button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl h-[calc(100vh-120px)] flex flex-col">
      {/* Chat Header */}
      <div className="bg-card/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-4 mb-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/social')}
            className="p-3 rounded-2xl hover:bg-muted/50 text-muted-foreground transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border-2 border-primary/20 flex items-center justify-center">
                {friendProfile.photoURL ? (
                  <img src={friendProfile.photoURL} alt={friendProfile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
            </div>
            <div>
              <h2 className="font-black text-lg leading-tight">{friendProfile.displayName}</h2>
              <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">ID: {friendProfile.id}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            to={`/users/${friendProfile.id}`}
            className="p-3 rounded-2xl hover:bg-muted/50 text-muted-foreground transition-all"
            title="View Profile"
          >
            <User className="w-5 h-5" />
          </Link>
          <button 
            onClick={fetchUserGames}
            className="p-3 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
            title="Invite to Play"
          >
            <Gamepad2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 bg-card/30 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent shadow-inner">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <Ghost className="w-16 h-16 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-black uppercase tracking-widest text-xs">No messages yet</p>
              <p className="text-xs font-medium">Be the first to say hello!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderUid === user?.uid;
            const showAvatar = i === 0 || messages[i-1].senderUid !== msg.senderUid;
            
            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex items-end gap-2",
                  isMe ? "flex-row-reverse" : "flex-row"
                )}
              >
                {!isMe && (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0 mb-1 border border-white/5 flex items-center justify-center">
                    {showAvatar && (
                      friendProfile.photoURL ? (
                        <img src={friendProfile.photoURL} alt={friendProfile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )
                    )}
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] px-5 py-3 rounded-[1.5rem] text-sm font-medium shadow-sm",
                  isMe 
                    ? "bg-primary text-primary-foreground rounded-br-none" 
                    : "bg-card border border-white/5 text-foreground rounded-bl-none"
                )}>
                  {msg.text.includes('🎮 Invited you to play:') ? (
                    <div className="space-y-3">
                      <p className="font-black flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4" /> Game Invitation
                      </p>
                      <div className="bg-black/20 p-3 rounded-xl border border-white/10">
                        <p className="text-xs font-bold opacity-80">{msg.text.split(': ')[1]}</p>
                      </div>
                      {!isMe && (
                        <button 
                          onClick={() => navigate(`/social`)} // Navigate to social hub to accept
                          className="w-full bg-white text-primary py-2 rounded-xl text-xs font-black hover:bg-white/90 transition-all"
                        >
                          View Invite
                        </button>
                      )}
                    </div>
                  ) : (
                    msg.text
                  )}
                  <p className={cn(
                    "text-[8px] mt-1 opacity-50 font-bold uppercase tracking-widest",
                    isMe ? "text-right" : "text-left"
                  )}>
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="flex gap-3">
        <button
          type="button"
          onClick={fetchUserGames}
          className="p-4 rounded-[1.5rem] bg-card border border-white/5 text-muted-foreground hover:text-primary transition-all shadow-lg"
        >
          <Gamepad2 className="w-6 h-6" />
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="w-full bg-card/50 backdrop-blur-xl border border-white/5 rounded-[1.5rem] px-6 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium shadow-xl"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="absolute right-2 top-2 bottom-2 px-6 rounded-2xl bg-primary text-primary-foreground font-black disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      </form>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-white/10 rounded-[3rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black flex items-center gap-2">
                  <Gamepad2 className="w-6 h-6 text-primary" />
                  Invite to Play
                </h3>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="p-3 rounded-full hover:bg-muted transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {userGames.map(game => (
                  <button
                    key={game.id}
                    onClick={() => handleInviteToPlay(game)}
                    className="flex flex-col items-start p-4 rounded-[2rem] border border-white/5 bg-background/50 hover:border-primary transition-all text-left group"
                  >
                    <div className="w-full aspect-video rounded-2xl overflow-hidden mb-3 border border-white/5">
                      <img src={game.thumbnailUrl} alt={game.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                    </div>
                    <p className="font-black text-sm line-clamp-1 group-hover:text-primary transition-colors">{game.title}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{game.category}</p>
                  </button>
                ))}
              </div>

              {userGames.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-4">
                  <Ghost className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-black">No games found</p>
                    <Link to="/upload" className="text-primary font-black text-sm hover:underline">Upload a game first</Link>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
