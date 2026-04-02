export interface ControlMapping {
  action: string;
  key: string;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  controls: string; // General description
  controlMappings: ControlMapping[]; // Structured controls
  category: string;
  thumbnailUrl: string;
  videoUrl?: string;
  htmlContent: string;
  authorId: string;
  authorName: string;
  authorUsername?: string;
  playCount: number;
  activeCount: number;
  likes: number;
  dislikes: number;
  createdAt: any;
  adMobUnitId?: string;
  isPublic: boolean;
  trendingScore: number;
  avgRating: number;
  ratingCount: number;
  isBanned?: boolean;
  deviceStats?: {
    mobile: number;
    desktop: number;
    console: number;
    other: number;
  };
}

export interface UserProfile {
  uid: string;
  username: string; // Unique username used for routing
  email: string;
  displayName: string;
  photoURL: string;
  playedGameIds: string[];
  favoriteCategories: string[];
  friends: string[]; // Array of uids
  allowFriendRequests: boolean;
  createdAt: any;
  isBanned?: boolean;
  recentlyPlayed?: string[]; // Array of game IDs
  lastUploadAt?: any;
  followersCount?: number;
  followingCount?: number;
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  text: string;
  createdAt: any;
}

export interface Chat {
  id: string;
  participants: string[]; // Array of uids
  lastMessage?: string;
  updatedAt: any;
}

export interface GameInvitation {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  gameId: string;
  gameTitle: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
}

export interface Like {
  id: string;
  userId: string;
  gameId: string;
  type: 'like' | 'dislike';
}

export interface Comment {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userUsername?: string;
  userPhoto: string;
  text: string;
  createdAt: any;
}

export interface Rating {
  id: string;
  gameId: string;
  userId: string;
  value: number; // 1-5
  createdAt: any;
}

export interface Report {
  id: string;
  gameId: string;
  gameTitle: string;
  reporterUid: string;
  reporterName: string;
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: any;
}
