import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Game } from '../types';
import { GameCard } from '../components/GameCard';
import { TrendingUp, Clock, Flame, Loader2, Search } from 'lucide-react';
import { motion } from 'motion/react';

interface GameListPagesProps {
  type: 'mostplayed' | 'mostactive' | 'latest';
}

export function GameListPages({ type }: GameListPagesProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const config = {
    mostplayed: {
      title: 'Most Played Games',
      description: 'The community favorites! These games have the highest play counts.',
      icon: <TrendingUp className="w-10 h-10 text-primary" />,
      orderBy: 'playCount'
    },
    mostactive: {
      title: 'Most Active (Trending)',
      description: 'What everyone is playing right now! Trending based on recent activity.',
      icon: <Flame className="w-10 h-10 text-orange-500" />,
      orderBy: 'trendingScore'
    },
    latest: {
      title: 'Latest Games',
      description: 'Fresh from the community! Check out the newest additions.',
      icon: <Clock className="w-10 h-10 text-primary" />,
      orderBy: 'createdAt'
    }
  }[type];

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        const gamesRef = collection(db, 'games');
        const q = query(
          gamesRef, 
          where('isPublic', '==', true), 
          orderBy(config.orderBy, 'desc'), 
          limit(100)
        );
        const snap = await getDocs(q);
        setGames(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .filter(g => g.isBanned !== true)
        );
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [type, config.orderBy]);

  const filteredGames = games.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading {config.title}...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
          {config.icon}
          {config.title}
        </h1>
        <p className="text-muted-foreground text-lg">
          {config.description}
        </p>
        
        <div className="relative group max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search in this list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background/50 backdrop-blur-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredGames.map((game, index) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
          >
            <GameCard game={game} />
          </motion.div>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl">
          <p className="text-muted-foreground font-medium">No games found matching your search.</p>
        </div>
      )}
    </div>
  );
}
