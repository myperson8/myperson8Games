import React, { useState, useEffect } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { Link } from 'react-router-dom';
import { Users, Search, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export function ExplorePlayers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), limit(100));
        const snap = await getDocs(q);
        const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        
        // Shuffle randomly
        const shuffled = [...allUsers].sort(() => Math.random() - 0.5);
        setUsers(shuffled);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Finding players...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
          <Users className="w-10 h-10 text-primary" />
          Explore Players
        </h1>
        <p className="text-muted-foreground text-lg">
          Meet the community! Discover developers, gamers, and friends.
        </p>
        
        <div className="relative group max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search players by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background/50 backdrop-blur-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredUsers.map((player, index) => (
          <motion.div
            key={player.uid}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link 
              to={`/users/${player.username || player.uid}`}
              className="group block p-6 rounded-3xl bg-card border hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all text-center space-y-4"
            >
              <div className="relative mx-auto w-24 h-24 rounded-full overflow-hidden border-4 border-background group-hover:border-primary/20 transition-colors">
                <img 
                  src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`} 
                  alt={player.displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-black text-lg truncate group-hover:text-primary transition-colors">
                  {player.displayName || 'Anonymous Player'}
                </h3>
                <p className="text-xs text-primary font-bold uppercase tracking-wider">
                  @{player.username}
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-4 text-xs font-bold text-muted-foreground">
                <div className="flex flex-col">
                  <span className="text-foreground">{player.playedGameIds?.length || 0}</span>
                  <span>Played</span>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="flex flex-col">
                  <span className="text-foreground">{player.friends?.length || 0}</span>
                  <span>Friends</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground font-medium">No players found matching your search.</p>
        </div>
      )}
    </div>
  );
}
