import { NextResponse } from 'next/server';
import { getResources } from '@/app/lib/api';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const categorySlug = searchParams.get('categorySlug');
  const folderIdParam = searchParams.get('folderId');
  const searchTerm = searchParams.get('search'); // Matches api.js
  const tags = searchParams.get('tags') ? searchParams.get('tags').split(',') : [];
  const formats = searchParams.get('formats') ? searchParams.get('formats').split(',') : [];
  const limit = parseInt(searchParams.get('limit') || '40');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sortOrder = searchParams.get('sort') || 'newest'; // Matches api.js
  const favoriteIdsParam = searchParams.get('favoriteIds');
  const favoriteIds = favoriteIdsParam ? favoriteIdsParam.split(',') : [];

  // Handle folderId parsing (can be single UUID, array string, or 'null')
  let folderId = undefined;
  if (folderIdParam === 'null') {
    folderId = null;
  } else if (folderIdParam && folderIdParam !== 'undefined') {
    folderId = folderIdParam.includes(',') ? folderIdParam.split(',') : folderIdParam;
  }

  try {
    const resources = await getResources({
      categorySlug,
      folderId,
      searchTerm,
      selectedTags: tags,
      selectedFormats: formats,
      limit,
      offset,
      sortOrder,
      favoriteIds
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error('API Error in /api/resources:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
}
