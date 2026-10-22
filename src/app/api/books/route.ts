import { searchBookCatalogue } from '@/lib/bookCatalogue';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get('q') ?? undefined;
  if (q !== undefined && q.length > 120) {
    return Response.json(
      { error: 'Tham số tìm kiếm q quá dài (tối đa 120 ký tự)' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const author = searchParams.get('author') ?? undefined;
  if (author !== undefined && author.length > 120) {
    return Response.json(
      { error: 'Tham số tác giả quá dài (tối đa 120 ký tự)' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const category = searchParams.get('category') ?? undefined;
  if (category !== undefined && category.length > 80) {
    return Response.json(
      { error: 'Tham số thể loại quá dài (tối đa 80 ký tự)' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const pageStr = searchParams.get('page');
  let page: number | undefined;
  if (pageStr !== null) {
    if (!/^[1-9]\d*$/.test(pageStr)) {
      return Response.json(
        { error: 'Tham số trang không hợp lệ (phải là số nguyên từ 1 đến 10000)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    page = Number(pageStr);
    if (page > 10000) {
      return Response.json(
        { error: 'Tham số trang vượt quá giới hạn 10000' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  const slugsParam = searchParams.get('slugs');
  let slugs: string[] | undefined;
  if (slugsParam !== null) {
    const rawList = slugsParam.split(',').map((s) => s.trim()).filter(Boolean);
    if (rawList.length > 50 || rawList.some((slug) => slug.length > 80 || !/^[a-z0-9-]+$/.test(slug))) {
      return Response.json(
        { error: 'Danh sách truyện không hợp lệ (tối đa 50 mã truyện)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    slugs = rawList;
  }

  try {
    const result = await searchBookCatalogue({
      q,
      author,
      category,
      page,
      slugs,
    });

    return Response.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=3600',
      },
    });
  } catch (error: unknown) {
    console.error('Book catalogue API error:', error);
    return Response.json(
      { error: 'Không thể tải danh mục sách lúc này. Vui lòng thử lại sau.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
