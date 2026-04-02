import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, Search, User, LogOut, Settings, Menu, X, Bell, Users, MessageSquare, ChevronDown, Sparkles, LogIn, Upload, Shield, LayoutGrid } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const ADMIN_EMAILS = ['nothingnope07@gmail.com', 'nothingnope15@gmail.com'];

export function Navbar() {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(0);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

  useEffect(() => {
    if (!user) return;
    
    // Listen for pending friend requests for notification badge
    const q = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', user.uid),
      where('status', '==', 'pending')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.length);
    });
    
    return () => unsub();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim().length < 3) return;
    
    setIsSearching(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', searchId.toLowerCase().trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        navigate(`/users/${searchId.toLowerCase().trim()}`);
        setSearchId('');
      } else {
        alert('User not found');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/home');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSurprise = async () => {
    try {
      const q = query(collection(db, 'games'), where('isPublic', '==', true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const randomIndex = Math.floor(Math.random() * snap.docs.length);
        const randomGame = snap.docs[randomIndex];
        navigate(`/games/${randomGame.id}`);
      }
    } catch (error) {
      console.error('Surprise error:', error);
    }
  };

  const navLinks = [
    { to: '/home', label: 'Explore', icon: Sparkles },
    { to: '/category', label: 'Categories', icon: LayoutGrid },
    { to: '/explore-players', label: 'Players', icon: Users },
    { to: '/social', label: 'Social', icon: MessageSquare, badge: notifications },
  ];

  return (
    <nav className="sticky top-0 z-[100] w-full bg-[#0a0a0a] border-b border-white/5">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2 group shrink-0">
          <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Gamepad2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-black tracking-tighter hidden sm:block text-white">
            myperson8<span className="text-primary">Games</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          <button
            onClick={handleSurprise}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all relative uppercase tracking-widest text-accent hover:text-white hover:bg-accent/10 group"
          >
            <Sparkles className="w-3.5 h-3.5 group-hover:animate-spin" />
            Surprise
          </button>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all relative uppercase tracking-widest",
                location.pathname === link.to 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <link.icon className="w-3.5 h-3.5" />
              {link.label}
              {link.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] flex items-center justify-center rounded-full border-2 border-[#0a0a0a] animate-pulse">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md relative group hidden lg:block">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className={cn(
              "w-3.5 h-3.5 transition-colors",
              isSearching ? "text-primary animate-pulse" : "text-muted-foreground group-focus-within:text-primary"
            )} />
          </div>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Search Username..."
            className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-white/10 transition-all text-white placeholder:text-muted-foreground/50"
          />
        </form>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
                <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform mr-1", showUserMenu && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowUserMenu(false)}
                      className="fixed inset-0 z-[-1]"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-64 bg-card/90 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-3 shadow-2xl overflow-hidden"
                    >
                      <div className="p-4 border-b border-white/5 mb-2">
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Account</p>
                        <p className="text-sm font-bold truncate">{user.email}</p>
                      </div>
                      <div className="space-y-1">
                        {isAdmin && (
                          <Link 
                            to="/admin" 
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black text-primary hover:bg-primary/10 transition-all"
                          >
                            <Shield className="w-4 h-4" /> Admin Panel
                          </Link>
                        )}
                        <Link 
                          to="/my-games" 
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black hover:bg-white/5 transition-all"
                        >
                          <Gamepad2 className="w-4 h-4 text-muted-foreground" /> My Games
                        </Link>
                        <Link 
                          to="/upload" 
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black hover:bg-primary hover:text-primary-foreground transition-all group"
                        >
                          <Upload className="w-4 h-4" /> Upload Game
                        </Link>
                        <Link 
                          to="/settings" 
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black hover:bg-white/5 transition-all"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" /> Settings
                        </Link>
                        <button 
                          onClick={() => {
                            handleLogout();
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <LogOut className="w-4 h-4" /> Logout
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link 
              to="/login" 
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-3 rounded-2xl bg-muted/30 border border-white/5 text-muted-foreground"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/5 bg-card overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Search Username..."
                  className="w-full bg-muted/50 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none"
                />
              </form>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    handleSurprise();
                    setIsMenuOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-accent/10 border border-accent/20 text-sm font-black text-accent"
                >
                  <Sparkles className="w-6 h-6" />
                  Surprise
                </button>
                {navLinks.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/30 border border-white/5 text-sm font-black"
                  >
                    <link.icon className="w-6 h-6 text-primary" />
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
