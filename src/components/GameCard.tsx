import React from 'react';
import { Link } from 'react-router-dom';
import { Game } from '../types';
import { Play, ThumbsUp, Users, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { CATEGORY_THUMBNAILS } from '../constants';

interface GameCardProps {
  game: Game;
  key?: string | number;
}

export function GameCard({ game }: GameCardProps) {
  const thumbnail = game.thumbnailUrl || CATEGORY_THUMBNAILS[game.category] || CATEGORY_THUMBNAILS['Other'];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="group relative flex flex-col gap-2"
    >
      <Link to={`/games/${game.id}`} className="aspect-square overflow-hidden relative rounded-2xl border bg-card shadow-sm transition-all hover:shadow-xl hover:shadow-primary/10">
        <img
          src={thumbnail}
          alt={game.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-primary text-primary-foreground p-4 rounded-full transform scale-90 group-hover:scale-100 transition-transform shadow-xl">
            <Play className="w-8 h-8 fill-current" />
          </div>
        </div>
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {game.playCount > 1000 && (
            <div className="bg-yellow-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">
              Top
            </div>
          )}
          {game.avgRating > 4.5 && (
            <div className="bg-primary text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">
              Hot
            </div>
          )}
        </div>

        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-black text-white uppercase tracking-widest">
          {game.category}
        </div>
      </Link>

      <div className="px-1">
        <Link to={`/games/${game.id}`} className="font-bold text-sm line-clamp-1 hover:text-primary transition-colors">
          {game.title}
        </Link>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium mt-0.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{game.playCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-current text-yellow-500" />
              <span>{game.avgRating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
