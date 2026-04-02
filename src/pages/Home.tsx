import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Game, UserProfile } from '../types';
import { GameCard } from '../components/GameCard';
import { useAuthState } from 'react-firebase-hooks/auth';
import { TrendingUp, Sparkles, Clock, Flame, Search, Loader2, ChevronRight, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { CATEGORY_THUMBNAILS } from '../constants';

export function Home() {
  const [user] = useAuthState(auth);
  const [featuredGames, setFeaturedGames] = useState<Game[]>([]);
  const [mostPlayedGames, setMostPlayedGames] = useState<Game[]>([]);
  const [mostActiveGames, setMostActiveGames] = useState<Game[]>([]);
  const [recommendedGames, setRecommendedGames] = useState<Game[]>([]);
  const [recentlyPlayedGames, setRecentlyPlayedGames] = useState<Game[]>([]);
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const fetchGames = async () => {
      setLoading(true);
      try {
        const gamesRef = collection(db, 'games');

        // Most Played
        const mostPlayedQuery = query(gamesRef, where('isPublic', '==', true), orderBy('playCount', 'desc'), limit(10));
        const mostPlayedSnap = await getDocs(mostPlayedQuery);
        setMostPlayedGames(mostPlayedSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .filter(g => g.isBanned !== true)
          .slice(0, 4)
        );

        // Trending Now (using trendingScore)
        const trendingQuery = query(gamesRef, where('isPublic', '==', true), orderBy('trendingScore', 'desc'), limit(10));
        const trendingSnap = await getDocs(trendingQuery);
        setMostActiveGames(trendingSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .filter(g => g.isBanned !== true)
          .slice(0, 4)
        );

        // Latest Games
        const latestQuery = query(gamesRef, where('isPublic', '==', true), orderBy('createdAt', 'desc'), limit(10));
        const latestSnap = await getDocs(latestQuery);
        setFeaturedGames(latestSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .filter(g => g.isBanned !== true)
          .slice(0, 8)
        );

        // Recommendations & Recently Played
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            const playedIds = profile.playedGameIds || [];
            const recentIds = profile.recentlyPlayed || [];
            const favCats = profile.favoriteCategories || [];

            // Fetch Recently Played
            if (recentIds.length > 0) {
              const recentGames: Game[] = [];
              for (const rid of recentIds.slice(0, 4)) {
                const gDoc = await getDoc(doc(db, 'games', rid));
                if (gDoc.exists()) {
                  recentGames.push({ id: gDoc.id, ...gDoc.data() } as Game);
                }
              }
              setRecentlyPlayedGames(recentGames);
            }

            if (favCats.length > 0) {
              const recQuery = query(
                gamesRef,
                where('isPublic', '==', true),
                where('isBanned', '!=', true),
                where('category', 'in', favCats.slice(0, 10)),
                orderBy('isBanned'),
                orderBy('trendingScore', 'desc'),
                limit(10)
              );
              const recSnap = await getDocs(recQuery);
              const recs = recSnap.docs
                .map(d => ({ id: d.id, ...d.data() } as Game))
                .filter(g => !playedIds.includes(g.id));
              setRecommendedGames(recs.slice(0, 4));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [user]);

  // Improved Search Algorithm
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const gamesRef = collection(db, 'games');
        // Firestore doesn't support full-text search well, so we fetch and filter
        // or use multiple queries. For now, let's fetch more and filter client-side
        // but prioritize matches in title then category.
        const q = query(gamesRef, where('isPublic', '==', true), limit(100));
        const snap = await getDocs(q);
        const allGames = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Game))
          .filter(g => g.isBanned !== true);
        
        const queryLower = searchQuery.toLowerCase();
        const results = allGames.filter(g => 
          g.title.toLowerCase().includes(queryLower) ||
          g.category.toLowerCase().includes(queryLower) ||
          g.description.toLowerCase().includes(queryLower)
        ).sort((a, b) => {
          // Prioritize title matches
          const aTitleMatch = a.title.toLowerCase().includes(queryLower);
          const bTitleMatch = b.title.toLowerCase().includes(queryLower);
          if (aTitleMatch && !bTitleMatch) return -1;
          if (!aTitleMatch && bTitleMatch) return 1;
          return b.trendingScore - a.trendingScore;
        });

        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading games...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-12">
      {/* Hero Section - Top Picks */}
      {!searchQuery.trim() && mostPlayedGames.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-black tracking-tight">Top picks for you</h2>
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-[2.5rem] group border border-white/5 shadow-2xl">
            <img 
              src={mostPlayedGames[0].thumbnailUrl || CATEGORY_THUMBNAILS[mostPlayedGames[0].category] || CATEGORY_THUMBNAILS['Other']} 
              alt={mostPlayedGames[0].title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 flex items-end justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl shrink-0">
                  <img 
                    src={mostPlayedGames[0].thumbnailUrl || CATEGORY_THUMBNAILS[mostPlayedGames[0].category] || CATEGORY_THUMBNAILS['Other']} 
                    alt="Icon"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl md:text-4xl font-black text-white tracking-tighter">{mostPlayedGames[0].title}</h3>
                  <p className="text-white/60 font-bold text-sm md:text-lg uppercase tracking-widest">{mostPlayedGames[0].category}</p>
                </div>
              </div>
              
              <Link 
                to={`/games/${mostPlayedGames[0].id}`}
                className="bg-primary text-primary-foreground px-8 py-4 md:px-12 md:py-6 rounded-3xl font-black text-lg md:text-2xl hover:bg-primary/90 transition-all shadow-2xl shadow-primary/40 flex items-center gap-3 group/btn"
              >
                <Play className="w-6 h-6 md:w-8 md:h-8 fill-current group-hover/btn:scale-110 transition-transform" />
                Play
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Search Results */}
      {searchQuery.trim() && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Search Results for "{searchQuery}"</h2>
            </div>
            <button onClick={() => setSearchQuery('')} className="text-sm text-muted-foreground hover:text-primary transition-colors">Clear Search</button>
          </div>
          {/* Search Results Grid */}
          {searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {searchResults.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : !isSearching && (
            <div className="text-center py-12 border rounded-xl bg-muted/30">
              <p className="text-muted-foreground">No games found matching your search.</p>
            </div>
          )}
        </section>
      )}

      {!searchQuery.trim() && (
        <>
          {/* Continue Playing */}
          {user && recentlyPlayedGames.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Continue Playing</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {recentlyPlayedGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}

          {/* Recommended for You */}
          {user && recommendedGames.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Recommended for You</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {recommendedGames.map(game => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </section>
          )}

          {/* Most Played */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Most Played</h2>
              </div>
              <Link 
                to="/mostplayed" 
                className="flex items-center gap-1 text-sm font-black text-primary hover:gap-2 transition-all"
              >
                View More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {mostPlayedGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>

          {/* Trending Now */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-orange-500" />
                <h2 className="text-2xl font-bold">Trending Now</h2>
              </div>
              <Link 
                to="/mostactive" 
                className="flex items-center gap-1 text-sm font-black text-primary hover:gap-2 transition-all"
              >
                View More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {mostActiveGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>

          {/* Latest Games */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">Latest Games</h2>
              </div>
              <Link 
                to="/latest" 
                className="flex items-center gap-1 text-sm font-black text-primary hover:gap-2 transition-all"
              >
                View More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {featuredGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
