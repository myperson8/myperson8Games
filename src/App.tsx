import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { ExplorePlayers } from './pages/ExplorePlayers';
import { GameListPages } from './pages/GameListPages';
import { GameDetail } from './pages/GameDetail';
import { Upload } from './pages/Upload';
import { MyGames } from './pages/MyGames';
import { EditGame } from './pages/EditGame';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Social } from './pages/Social';
import { ChatPage } from './pages/Chat';
import { AdminPanel } from './pages/AdminPanel';
import { CategoryPage } from './pages/CategoryPage';

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './lib/firebase';
import { ensureUserProfile } from './lib/profile';
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

export default function App() {
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (user) {
      ensureUserProfile(user);
    }
  }, [user]);

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Navbar />
        <main className="pb-20">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/explore-players" element={<ExplorePlayers />} />
            <Route path="/mostplayed" element={<GameListPages type="mostplayed" />} />
            <Route path="/mostactive" element={<GameListPages type="mostactive" />} />
            <Route path="/latest" element={<GameListPages type="latest" />} />
            <Route path="/category" element={<CategoryPage />} />
            <Route path="/category/:categoryName" element={<CategoryPage />} />
            <Route path="/games/:id" element={<GameDetail />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/my-games" element={<MyGames />} />
            <Route path="/edit/:id" element={<EditGame />} />
            <Route path="/login" element={<Login />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users/:username" element={<Profile />} />
            <Route path="/social" element={<Social />} />
            <Route path="/social/chat/:friendUid" element={<ChatPage />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
        
        <footer className="border-t py-12 bg-muted/30">
          <div className="container mx-auto px-4 text-center space-y-4">
            <div className="font-bold text-xl tracking-tight text-primary">myperson8Games</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The ultimate platform for HTML5 game developers and players. 
              Share your creations and play the best games for free.
            </p>
            <div className="text-xs text-muted-foreground pt-8">
              © 2026 myperson8Games. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
