import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  Query,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './config';

export async function addDocument(collectionName: string, data: any, docId?: string) {
  try {
    const docRef = docId ? doc(db, collectionName, docId) : doc(collection(db, collectionName));
    await setDoc(docRef, {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionName}:`, error);
    throw error;
  }
}

export async function getDocument(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error);
    throw error;
  }
}

export async function updateDocument(collectionName: string, docId: string, data: any) {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error);
    throw error;
  }
}

export async function deleteDocument(collectionName: string, docId: string) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error);
    throw error;
  }
}

export async function queryDocuments(
  collectionName: string,
  constraints: QueryConstraint[]
) {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    throw error;
  }
}

export async function getAllDocuments(collectionName: string) {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error getting all documents from ${collectionName}:`, error);
    throw error;
  }
}

export const firebaseConstraints = {
  where,
  limit,
  orderBy,
};
