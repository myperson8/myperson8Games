import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Game } from '../types';
import { GameCard } from '../components/GameCard';
import { CATEGORY_THUMBNAILS } from '../constants';
import { LayoutGrid, ChevronRight, Loader2, Search, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export function CategoryPage() {
  const { categoryName } = useParams<{ categoryName?: string }>();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const categories = Object.keys(CATEGORY_THUMBNAILS);

  useEffect(() => {
    if (!categoryName) {
      setLoading(false);
      return;
    }

    const fetchCategoryGames = async () => {
      setLoading(true);
      try {
        const gamesRef = collection(db, 'games');
        const q = query(
          gamesRef,
          where('category', '==', categoryName),
          where('isPublic', '==', true),
          orderBy('trendingScore', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        setGames(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .filter(g => g.isBanned !== true)
        );
      } catch (error) {
        console.error('Error fetching category games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryGames();
  }, [categoryName]);

  const filteredGames = games.filter(g =>
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Loading {categoryName || 'Categories'}...</p>
      </div>
    );
  }

  // List all categories
  if (!categoryName) {
    return (
      <div className="container mx-auto px-4 py-12 space-y-12">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <LayoutGrid className="w-10 h-10 text-primary" />
            Explore Categories
          </h1>
          <p className="text-muted-foreground text-lg">
            Find your favorite genre and start playing the best community-made games.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((cat, index) => (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/category/${cat}`}
                className="group relative aspect-[16/9] overflow-hidden rounded-[2rem] border border-white/5 block"
              >
                <img
                  src={CATEGORY_THUMBNAILS[cat]}
                  alt={cat}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-center justify-between">
                  <h3 className="text-2xl font-black text-white tracking-tight">{cat}</h3>
                  <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // List games for a specific category
  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      <div className="space-y-8">
        <Link 
          to="/category"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Categories
        </Link>

        <div className="max-w-2xl space-y-4">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <span className="text-primary">{categoryName}</span> Games
          </h1>
          <p className="text-muted-foreground text-lg">
            Browse the best {categoryName.toLowerCase()} games created by our developers.
          </p>
          
          <div className="relative group max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder={`Search in ${categoryName}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background/50 backdrop-blur-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {filteredGames.length > 0 ? (
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
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl">
          <p className="text-muted-foreground font-medium">No games found in this category matching your search.</p>
        </div>
      )}
    </div>
  );
}
