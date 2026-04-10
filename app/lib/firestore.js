import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/* ========================================
   RESOURCES
   ======================================== */

export async function getResources(categorySlug, folderId = undefined) {
  if (!db) return [];
  const ref = collection(db, 'resources');
  const constraints = [where('isPublished', '==', true)];

  if (categorySlug) {
    constraints.push(where('category', '==', categorySlug));
  }
  if (folderId !== undefined) {
    constraints.push(where('folderId', '==', folderId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(ref, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getResourceBySlug(categorySlug, resourceSlug) {
  if (!db) return null;
  const ref = collection(db, 'resources');
  const q = query(
    ref,
    where('category', '==', categorySlug),
    where('slug', '==', resourceSlug),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function addResource(data) {
  if (!db) return null;
  const ref = collection(db, 'resources');
  return addDoc(ref, {
    ...data,
    downloadCount: 0,
    isPublished: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateResource(id, data) {
  if (!db) return null;
  const ref = doc(db, 'resources', id);
  return updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteResource(id) {
  if (!db) return null;
  const ref = doc(db, 'resources', id);
  return deleteDoc(ref);
}

export async function incrementDownloadCount(id) {
  if (!db) return null;
  const ref = doc(db, 'resources', id);
  return updateDoc(ref, { downloadCount: increment(1) });
}

/* ========================================
   CATEGORIES
   ======================================== */

export async function getCategories() {
  if (!db) return [];
  const ref = collection(db, 'categories');
  const q = query(ref, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCategoryBySlug(slug) {
  if (!db) return null;
  const ref = collection(db, 'categories');
  const q = query(ref, where('slug', '==', slug), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

/* ========================================
   FOLDERS
   ======================================== */

export async function getFolders(categorySlug, parentId = null) {
  if (!db) return [];
  const ref = collection(db, 'folders');
  const constraints = [
    where('categorySlug', '==', categorySlug),
    where('parentId', '==', parentId || null),
    orderBy('order', 'asc')
  ];
  const q = query(ref, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllFolders(categorySlug) {
  if (!db) return [];
  const ref = collection(db, 'folders');
  const constraints = [
    where('categorySlug', '==', categorySlug)
  ];
  const q = query(ref, ...constraints);
  const snapshot = await getDocs(q);
  const folders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  
  // Sort locally to avoid needing a new composite index for just (categorySlug) + (order)
  return folders.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function addFolder(data) {
  if (!db) return null;
  const ref = collection(db, 'folders');
  return addDoc(ref, { 
    ...data, 
    parentId: data.parentId || null,
    resourceCount: 0,
    createdAt: serverTimestamp() 
  });
}

export async function updateFolder(id, data) {
  if (!db) return null;
  const ref = doc(db, 'folders', id);
  return updateDoc(ref, data);
}

export async function deleteFolder(id) {
  if (!db) return null;
  const ref = doc(db, 'folders', id);
  return deleteDoc(ref);
}

/* ========================================
   SETTINGS
   ======================================== */

export async function getSettings() {
  if (!db) return null;
  const ref = doc(db, 'settings', 'general');
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export async function updateSettings(data) {
  if (!db) return null;
  const ref = doc(db, 'settings', 'general');
  return updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

/* ========================================
   SEARCH
   ======================================== */

export async function searchResources(searchTerm) {
  if (!db) return [];
  // Firestore doesn't support full-text search natively.
  // We fetch published resources and filter client-side for MVP.
  // For production, consider Algolia or Typesense integration.
  const ref = collection(db, 'resources');
  const q = query(ref, where('isPublished', '==', true), orderBy('createdAt', 'desc'), limit(200));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (!searchTerm) return all;

  const term = searchTerm.toLowerCase();
  return all.filter(
    (r) =>
      r.name?.toLowerCase().includes(term) ||
      r.description?.toLowerCase().includes(term) ||
      r.tags?.some((t) => t.toLowerCase().includes(term))
  );
}
