import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, secondaryAuth } from './config';
import { addDocument, getDocument, updateDocument } from './db';
import { User } from '@/types/models';

export async function registerUser(email: string, password: string) {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

export function setupAuthlistener(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function createUserDocument(
  uid: string,
  userData: Partial<User>
) {
  try {
    await addDocument('users', {
      ...userData,
      id: uid,
    }, uid);
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
}

export async function getUserDocument(uid: string): Promise<User | null> {
  try {
    const user = await getDocument('users', uid);
    return user as User | null;
  } catch (error) {
    console.error('Error getting user document:', error);
    throw error;
  }
}

export async function updateUserDocument(uid: string, userData: Partial<User>) {
  try {
    await updateDocument('users', uid, userData);
  } catch (error) {
    console.error('Error updating user document:', error);
    throw error;
  }
}

// Creates a new Firebase Auth user WITHOUT switching the current admin session
export async function createUserWithoutSignIn(email: string, password: string) {
  try {
    console.log('Creating auth user via secondary app...');
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    console.log('Auth user created:', userCredential.user.uid);
    // Sign out from secondary app immediately (cleanup)
    await signOut(secondaryAuth);
    return userCredential.user;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    console.error('Error creating auth user:', firebaseError.code, firebaseError.message);
    throw error;
  }
}
