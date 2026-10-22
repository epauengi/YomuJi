import { getBookContent } from '@/lib/bookContent';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const content = await getBookContent(slug);

    if (!content) {
      return Response.json({ error: 'Không tìm thấy sách' }, { status: 404 });
    }

    return Response.json(content, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' } });
  } catch (error: unknown) {
    console.error('Book content fetch error:', error);
    return Response.json(
      { error: 'Không thể tải nội dung sách lúc này. Vui lòng thử lại sau.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
