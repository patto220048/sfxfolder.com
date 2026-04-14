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
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/* ========================================
   RESOURCES
   ======================================== */

export async function getResource(id) {
  if (!db) return null;
  const ref = doc(db, 'resources', id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

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
  
  // Đồng bộ tag count nếu có
  if (data.tags && data.tags.length > 0) {
    await syncTagsCount(data.tags, []);
  }

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

  // Nếu có cập nhật tags, ta cần so sánh để đồng bộ count
  if (data.tags) {
    const oldSnap = await getDoc(ref);
    if (oldSnap.exists()) {
      const oldTags = oldSnap.data().tags || [];
      const newTags = data.tags;
      const added = newTags.filter(t => !oldTags.includes(t));
      const removed = oldTags.filter(t => !newTags.includes(t));
      await syncTagsCount(added, removed);
    }
  }

  return updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteResource(id) {
  if (!db) return null;
  const ref = doc(db, 'resources', id);

  // Giảm tag count trước khi xóa
  const oldSnap = await getDoc(ref);
  if (oldSnap.exists()) {
    const oldTags = oldSnap.data().tags || [];
    if (oldTags.length > 0) {
      await syncTagsCount([], oldTags);
    }
  }

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

export async function getCategoriesWithCounts() {
  if (!db) return [];
  
  // 1. Get all categories
  const categories = await getCategories();
  
  // 2. Get counts for each category
  // Since we have < 1000 total resources, fetching all published resources 
  // and counting locally is faster/cheaper than running multiple count queries.
  const resourcesRef = collection(db, 'resources');
  const q = query(resourcesRef, where('isPublished', '==', true));
  const snapshot = await getDocs(q);
  
  const counts = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const category = data.category;
    if (category) {
      counts[category] = (counts[category] || 0) + 1;
    }
  });
  
  // 3. Attach counts to categories
  return categories.map(cat => ({
    ...cat,
    resourceCount: counts[cat.slug] || 0
  }));
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

export async function getAllAdminFolders() {
  if (!db) return [];
  const ref = collection(db, 'folders');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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
   TAGS
   ======================================== */

/**
 * Cập nhật số lượng sử dụng của các tag trong collection 'tags'.
 * @param {string[]} addedTags - Danh sách tag mới thêm vào
 * @param {string[]} removedTags - Danh sách tag bị xóa đi
 */
export async function syncTagsCount(addedTags = [], removedTags = []) {
  if (!db || (addedTags.length === 0 && removedTags.length === 0)) return;

  const tagDeltas = {}; // { tagId: { name: string, delta: number } }

  // Tổng hợp tag thêm mới
  addedTags.forEach(tagName => {
    const name = tagName.trim();
    const tagId = name.toLowerCase();
    if (!tagId) return;
    
    if (!tagDeltas[tagId]) {
      tagDeltas[tagId] = { name: name, delta: 0 };
    }
    tagDeltas[tagId].delta += 1;
  });

  // Tổng hợp tag bị xóa
  removedTags.forEach(tagName => {
    const name = tagName.trim();
    const tagId = name.toLowerCase();
    if (!tagId) return;

    if (!tagDeltas[tagId]) {
      tagDeltas[tagId] = { name: name, delta: 0 };
    }
    tagDeltas[tagId].delta -= 1;
  });

  const batch = writeBatch(db);
  let hasChanges = false;

  Object.entries(tagDeltas).forEach(([tagId, info]) => {
    if (info.delta === 0) return; // Không thay đổi thì bỏ qua

    const tagRef = doc(db, 'tags', tagId);
    hasChanges = true;

    // Sử dụng set với merge: true để tạo mới nếu chưa có, hoặc cập nhật nếu đã có
    batch.set(tagRef, {
      name: info.name,
      usageCount: increment(info.delta),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  if (hasChanges) {
    await batch.commit();
  }
}

/**
 * Ghi lại nhật ký thay đổi tag (Rename/Delete).
 */
export async function logTagAction(action, tagName, metadata = {}) {
  if (!db) return;
  const ref = collection(db, 'logs/tags/entries');
  return addDoc(ref, {
    action,
    tagName,
    metadata,
    timestamp: serverTimestamp()
  });
}

/**
 * Lấy toàn bộ danh sách Tag từ collection 'tags'.
 */
export async function getTags() {
  if (!db) return [];
  const ref = collection(db, 'tags');
  const q = query(ref, orderBy('usageCount', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Đồng bộ lại toàn bộ collection 'tags' dựa trên dữ liệu thực tế từ 'resources'.
 * Thường dùng khi khởi tạo hoặc khi dữ liệu bị sai lệch.
 */
export async function syncAllTagsFromResources() {
  if (!db) return;
  
  // 1. Lấy tất cả resources
  const resRef = collection(db, 'resources');
  const snapshot = await getDocs(resRef);
  
  const tagCounts = {};
  snapshot.docs.forEach(doc => {
    const tags = doc.data().tags || [];
    tags.forEach(tag => {
      const t = tag.trim();
      if (!t) return;
      const id = t.toLowerCase();
      if (!tagCounts[id]) {
        tagCounts[id] = { name: t, count: 0 };
      }
      tagCounts[id].count++;
    });
  });

  // 2. Cập nhật collection 'tags' bằng Batch
  const batch = writeBatch(db);

  // Xóa trắng hoặc cập nhật đè (Ở đây ta cập nhật đè để giữ các trường meta khác nếu có)
  Object.keys(tagCounts).forEach(id => {
    const tagRef = doc(db, 'tags', id);
    batch.set(tagRef, {
      name: tagCounts[id].name,
      usageCount: tagCounts[id].count,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
  return Object.keys(tagCounts).length;
}

/**
 * Đổi tên Tag trên toàn bộ hệ thống.
 */
export async function renameTagGlobally(oldName, newName) {
  if (!db) return;
  const oldId = oldName.toLowerCase().trim();
  const newId = newName.toLowerCase().trim();
  if (oldId === newId) return;

  const batch = writeBatch(db);

  // 1. Tìm tất cả resources có chứa tag cũ
  const resRef = collection(db, 'resources');
  const q = query(resRef, where('tags', 'array-contains', oldName));
  const snapshot = await getDocs(q);

  snapshot.docs.forEach(resDoc => {
    const data = resDoc.data();
    const updatedTags = data.tags.map(t => t === oldName ? newName : t);
    batch.update(resDoc.ref, { 
      tags: updatedTags,
      updatedAt: serverTimestamp()
    });
  });

  // 2. Cập nhật collection 'tags' (xóa cũ, thêm/tăng mới)
  const oldTagRef = doc(db, 'tags', oldId);
  const newTagRef = doc(db, 'tags', newId);
  
  // Lấy data tag cũ để bảo toàn count
  const oldTagSnap = await getDoc(oldTagRef);
  const count = oldTagSnap.exists() ? oldTagSnap.data().usageCount : 0;

  batch.delete(oldTagRef);
  batch.set(newTagRef, {
    name: newName,
    usageCount: increment(count),
    updatedAt: serverTimestamp()
  }, { merge: true });

  // 3. Ghi log
  await logTagAction('RENAME', oldName, { newName, count });

  await batch.commit();
  return snapshot.size;
}

/**
 * Xóa Tag khỏi toàn bộ hệ thống.
 */
export async function deleteTagGlobally(tagName) {
  if (!db) return;
  const tagId = tagName.toLowerCase().trim();

  const batch = writeBatch(db);

  // 1. Tìm tất cả resources có chứa tag này
  const resRef = collection(db, 'resources');
  const q = query(resRef, where('tags', 'array-contains', tagName));
  const snapshot = await getDocs(q);

  snapshot.docs.forEach(resDoc => {
    const data = resDoc.data();
    const updatedTags = data.tags.filter(t => t !== tagName);
    batch.update(resDoc.ref, { 
      tags: updatedTags,
      updatedAt: serverTimestamp()
    });
  });

  // 2. Xóa khỏi collection 'tags'
  batch.delete(doc(db, 'tags', tagId));

  // 3. Ghi log
  await logTagAction('DELETE', tagName, { count: snapshot.size });

  await batch.commit();
  return snapshot.size;
}

/* ========================================
   SEARCH
   ======================================== */
// Note: searchResources has been moved to lib/searchUtils.js for Client-side Fuse.js caching
