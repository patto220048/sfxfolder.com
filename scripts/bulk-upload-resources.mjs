import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local
config({ path: '.env.local' });

// Mock WebSocket for Node 20 environments (Supabase Realtime dependency check)
globalThis.WebSocket = class {};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local!");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// MIME type map
const MIME_TYPES = {
  // audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  // video
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'gif': 'image/gif',
  // image
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp',
  // font
  'ttf': 'font/ttf',
  'otf': 'font/otf',
  'woff2': 'font/woff2',
  // lut
  'cube': 'text/plain',
  'xmp': 'text/plain',
  'lut': 'text/plain'
};

// Vietnamese tone normalization and slugify functions
const removeVietnameseTones = (str) => {
  if (!str) return "";
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  return str;
};

const cleanFileName = (name) => {
  if (!name) return "";
  let baseName = name.replace(/\.[^/.]+$/, "");
  baseName = baseName.replace(/[_-]/g, " ");
  return baseName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const convertToSlug = (text) => {
  if (!text) return "";
  let slug = removeVietnameseTones(text);
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Cache to store folders already fetched or created to minimize database roundtrips
const folderCache = new Map();

async function getOrCreateFolder(folderName, categoryId, parentId = null) {
  const cacheKey = `${categoryId}:${parentId || 'root'}:${folderName.toLowerCase()}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey);
  }

  // Check if folder exists in DB under this category and parent
  let query = supabaseAdmin
    .from('folders')
    .select('id')
    .eq('name', folderName)
    .eq('category_id', categoryId);

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`  ❌ Error querying folder "${folderName}":`, error.message);
    throw error;
  }

  if (data) {
    folderCache.set(cacheKey, data.id);
    return data.id;
  }

  // If not found, create new folder record in DB
  console.log(`  📁 Folder "${folderName}" not found. Creating in database (Category: ${categoryId}, Parent ID: ${parentId || 'None'})...`);
  const now = new Date().toISOString();
  const { data: newFolder, error: insertError } = await supabaseAdmin
    .from('folders')
    .insert([{
      name: folderName,
      category_id: categoryId,
      parent_id: parentId,
      created_at: now,
      updated_at: now,
      order: 0
    }])
    .select('id')
    .single();

  if (insertError) {
    console.error(`  ❌ Error creating folder "${folderName}":`, insertError.message);
    throw insertError;
  }

  folderCache.set(cacheKey, newFolder.id);
  return newFolder.id;
}

async function main() {
  const rootDir = process.argv[2] || 'D:\\Upload_San_Sang';
  console.log(`🚀 Starting Bulk Upload from: ${rootDir}`);

  if (!fs.existsSync(rootDir)) {
    console.error(`❌ Root directory not found: ${rootDir}`);
    process.exit(1);
  }

  // 1. Fetch categories from Supabase to validate against
  console.log("Fetching categories from database...");
  const { data: dbCategories, error: catError } = await supabaseAdmin
    .from('categories')
    .select('slug, name');

  if (catError) {
    console.error("❌ Failed to fetch categories:", catError.message);
    process.exit(1);
  }

  console.log(`Found ${dbCategories.length} categories in database.`);
  const categoryMap = new Map();
  dbCategories.forEach(cat => {
    categoryMap.set(cat.slug.toLowerCase(), cat.slug);
    categoryMap.set(cat.name.toLowerCase(), cat.slug);
  });

  // 2. Pre-scan root directory to collect all files to process
  console.log("\n🔍 Pre-scanning folder structure...");
  const filesToProcess = [];
  const rootItems = fs.readdirSync(rootDir);

  // Helper to scan a directory recursively and collect file information
  const preScanDirectory = (dirPath, categoryId, tags, subfolders = []) => {
    const items = fs.readdirSync(dirPath);
    for (const itemName of items) {
      const itemPath = path.join(dirPath, itemName);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        if (itemName.startsWith('.') || itemName.toLowerCase() === 'thumbs.db') continue;
        preScanDirectory(itemPath, categoryId, tags, [...subfolders, itemName]);
      } else {
        if (itemName.startsWith('.') || itemName.toLowerCase() === 'thumbs.db') continue;
        filesToProcess.push({
          filePath: itemPath,
          fileName: itemName,
          categoryId,
          tags,
          subfolders
        });
      }
    }
  };

  for (const categoryDirName of rootItems) {
    const categoryPath = path.join(rootDir, categoryDirName);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    // Check if folder name maps to a valid category
    const categoryId = categoryMap.get(categoryDirName.toLowerCase());
    if (!categoryId) {
      console.warn(`⚠️  Skipping folder "${categoryDirName}" - no matching category in database.`);
      continue;
    }

    const categoryItems = fs.readdirSync(categoryPath);
    for (const tagsDirName of categoryItems) {
      const tagsPath = path.join(categoryPath, tagsDirName);
      if (!fs.statSync(tagsPath).isDirectory()) continue;

      const tags = tagsDirName.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      preScanDirectory(tagsPath, categoryId, tags, []);
    }
  }

  const totalFiles = filesToProcess.length;
  console.log(`✅ Pre-scan completed! Found ${totalFiles} files to process.`);

  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // 3. Process each file
  for (let i = 0; i < totalFiles; i++) {
    const item = filesToProcess[i];
    const { filePath, fileName, categoryId, tags, subfolders } = item;
    const progressStr = `[${i + 1}/${totalFiles}]`;

    const hierarchyChain = [categoryId, tags.join(','), ...subfolders, fileName].join(' > ');
    console.log(`\n⚙️  ${progressStr} Processing: "${fileName}"`);
    console.log(`   🧬 Hierarchy: ${hierarchyChain}`);
    console.log(`   📂 File Path: ${filePath}`);
    console.log(`   📁 Category:  ${categoryId}`);
    console.log(`   🏷️  Tags:      [${tags.join(', ')}]`);
    if (subfolders.length > 0) {
      console.log(`   🌳 Subfolders: ${subfolders.join(' -> ')}`);
    }

    try {
      const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      const name = cleanFileName(fileName);
      const slug = convertToSlug(name);
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      // Resolve folder hierarchy
      console.log(`   🔍 Checking folder hierarchy in database...`);
      let parentFolderId = null;
      for (const folderName of subfolders) {
        parentFolderId = await getOrCreateFolder(folderName, categoryId, parentFolderId);
      }
      if (parentFolderId) {
        console.log(`   🔗 Mapped to folder_id: ${parentFolderId}`);
      }

      // Check if slug already exists to prevent duplicate uploads
      console.log(`   🔎 Checking if slug "${slug}" already exists in database...`);
      const { data: existing, error: existError } = await supabaseAdmin
        .from('resources')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existError) {
        console.error(`   ❌ Error checking existence for ${fileName}:`, existError.message);
        totalFailed++;
        continue;
      }

      if (existing) {
        console.log(`   ⏭️  Skipping - Resource "${name}" (slug: ${slug}) already exists in database.`);
        totalSkipped++;
        continue;
      }

      // Read file buffer
      const fileBuffer = fs.readFileSync(filePath);

      // Storage path in bucket: category_id/timestamp-slug.ext
      const timestamp = Date.now();
      const storagePath = `${categoryId}/${timestamp}-${slug}.${extension}`;
      const contentType = MIME_TYPES[extension] || 'application/octet-stream';

      console.log(`   📤 Uploading to Storage Bucket "resources" as "${storagePath}" (${fileSizeMB} MB)...`);
      const { error: uploadError } = await supabaseAdmin.storage
        .from('resources')
        .upload(storagePath, fileBuffer, {
          contentType,
          cacheControl: '31536000',
          upsert: true
        });

      if (uploadError) {
        console.error(`   ❌ Storage upload failed:`, uploadError.message);
        totalFailed++;
        continue;
      }
      console.log(`   📤 Upload successful.`);

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('resources')
        .getPublicUrl(storagePath);

      // Preview URL setup
      const isPreviewable = ['audio', 'video', 'image'].some(type => contentType.startsWith(type));
      const previewUrl = isPreviewable ? publicUrl : null;

      console.log(`   💾 Inserting resource metadata into database...`);
      const now = new Date().toISOString();
      const { error: insertError } = await supabaseAdmin
        .from('resources')
        .insert([{
          name,
          slug,
          category_id: categoryId,
          folder_id: parentFolderId,
          file_format: extension,
          file_size: fileSize,
          file_name: fileName,
          tags,
          download_count: 0,
          preview_url: previewUrl,
          thumbnail_url: null,
          download_url: publicUrl,
          is_premium: false,
          is_published: true,
          storage_path: storagePath,
          created_at: now,
          updated_at: now
        }]);

      if (insertError) {
        console.error(`   ❌ Database insertion failed:`, insertError.message);
        console.log(`   🧹 Cleaning up storage file "${storagePath}" due to insertion failure...`);
        await supabaseAdmin.storage.from('resources').remove([storagePath]);
        totalFailed++;
        continue;
      }

      console.log(`   ✅ Successfully processed and registered "${name}"`);
      totalUploaded++;

    } catch (fileErr) {
      console.error(`   ❌ Unexpected error processing "${fileName}":`, fileErr.message);
      totalFailed++;
    }
  }

  console.log(`\n🎉 Bulk upload finished!`);
  console.log(`   - Uploaded: ${totalUploaded}`);
  console.log(`   - Skipped: ${totalSkipped}`);
  console.log(`   - Failed: ${totalFailed}`);
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
