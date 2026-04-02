import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';

export async function isUsernameUnique(username: string): Promise<boolean> {
  const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
}

export async function ensureUserProfile(user: User, requestedUsername?: string): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const userDocSnap = await getDoc(userDocRef);
  
  if (userDocSnap.exists()) {
    return userDocSnap.data() as UserProfile;
  }
  
  let username = requestedUsername?.toLowerCase() || user.displayName?.toLowerCase().replace(/\s+/g, '') || `gamer${Math.floor(Math.random() * 10000)}`;
  
  // Ensure username is unique
  let isUnique = await isUsernameUnique(username);
  let counter = 1;
  while (!isUnique) {
    const tempUsername = `${username}${counter}`;
    isUnique = await isUsernameUnique(tempUsername);
    if (isUnique) {
      username = tempUsername;
    }
    counter++;
  }

  const newProfile: UserProfile = {
    uid: user.uid,
    username: username,
    email: user.email || '',
    displayName: user.displayName || 'Gamer',
    photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
    playedGameIds: [],
    favoriteCategories: [],
    friends: [],
    allowFriendRequests: true,
    createdAt: new Date().toISOString()
  };
  
  await setDoc(userDocRef, newProfile);
  return newProfile;
}
