import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { AppUser } from '@/types/user';
import { COLLECTIONS, ADMIN_EMAIL } from '@/constants/collections';

/**
 * Creates or updates a user document when they sign in
 * Auto-assigns admin status if email matches ADMIN_EMAIL
 */
export const createOrUpdateUser = async (firebaseUser: User): Promise<AppUser> => {
  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  const isAdmin = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (userSnap.exists()) {
    // Update last login time
    await updateDoc(userRef, {
      lastLoginAt: Timestamp.now(),
      // Update these in case they changed
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      photoURL: firebaseUser.photoURL || null,
      // Only upgrade to admin, never downgrade automatically
      ...(isAdmin ? { isAdmin: true } : {}),
    });

    const data = userSnap.data();
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: data.displayName || firebaseUser.displayName || '',
      photoURL: data.photoURL || firebaseUser.photoURL,
      isAdmin: isAdmin || data.isAdmin || false,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastLoginAt: new Date(),
    };
  } else {
    // Create new user document
    const newUser: Omit<AppUser, 'createdAt' | 'lastLoginAt'> & {
      createdAt: ReturnType<typeof Timestamp.now>;
      lastLoginAt: ReturnType<typeof Timestamp.now>;
    } = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      photoURL: firebaseUser.photoURL || undefined,
      isAdmin,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    };

    await setDoc(userRef, newUser);

    return {
      ...newUser,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
  }
};

/**
 * Get a user by their UID
 */
export const getUserById = async (uid: string): Promise<AppUser | null> => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const data = userSnap.data();
  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL,
    isAdmin: data.isAdmin || false,
    createdAt: data.createdAt?.toDate() || new Date(),
    lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
  };
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (): Promise<AppUser[]> => {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const q = query(usersRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      isAdmin: data.isAdmin || false,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
    };
  });
};

/**
 * Get multiple users by their UIDs (for displaying shared users)
 */
export const getUsersByIds = async (uids: string[]): Promise<AppUser[]> => {
  if (!uids.length) return [];

  const users: AppUser[] = [];

  // Firestore 'in' query limited to 10 items, so batch if needed
  const batches = [];
  for (let i = 0; i < uids.length; i += 10) {
    batches.push(uids.slice(i, i + 10));
  }

  for (const batch of batches) {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('uid', 'in', batch));
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      users.push({
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        isAdmin: data.isAdmin || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
      });
    });
  }

  return users;
};

/**
 * Search users by email (for sharing dialog)
 */
export const searchUsersByEmail = async (emailQuery: string): Promise<AppUser[]> => {
  if (!emailQuery || emailQuery.length < 2) return [];

  const usersRef = collection(db, COLLECTIONS.USERS);
  // Firestore doesn't support full-text search, so we fetch all and filter client-side
  // For production, consider using Algolia or similar
  const snapshot = await getDocs(usersRef);

  const queryLower = emailQuery.toLowerCase();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        isAdmin: data.isAdmin || false,
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLoginAt: data.lastLoginAt?.toDate() || new Date(),
      };
    })
    .filter(
      (user) =>
        user.email.toLowerCase().includes(queryLower) ||
        user.displayName.toLowerCase().includes(queryLower)
    );
};

/**
 * Toggle admin status for a user (admin only)
 */
export const setUserAdminStatus = async (uid: string, isAdmin: boolean): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, { isAdmin });
};

/**
 * Check if user is admin (from Firestore, not claims)
 */
export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  const user = await getUserById(uid);
  return user?.isAdmin || false;
};
