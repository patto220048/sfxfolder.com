import { NextResponse } from 'next/server';
import { getResources } from '@/app/lib/api';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const categorySlug = searchParams.get('categorySlug');
  const folderId = searchParams.get('folderId');
  const searchTerm = searchParams.get('searchTerm');
  const tags = searchParams.get('tags') ? searchParams.get('tags').split(',') : [];
  const formats = searchParams.get('formats') ? searchParams.get('formats').split(',') : [];
  const limit = parseInt(searchParams.get('limit') || '40');
  const offset = parseInt(searchParams.get('offset') || '0');
  const sortOrder = searchParams.get('sortOrder') || 'newest';

  try {
    const resources = await getResources({
      categorySlug,
      folderId: folderId === 'null' ? null : (folderId === 'undefined' ? undefined : folderId),
      searchTerm,
      selectedTags: tags,
      selectedFormats: formats,
      limit,
      offset,
      sortOrder
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error('API Error in /api/resources:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
}
