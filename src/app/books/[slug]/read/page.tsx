import { notFound } from 'next/navigation';
import { getBook, type Book } from '@/data/books';
import BookReader from '@/components/books/BookReader';

async function resolveBook(slug: string): Promise<Book | undefined> {
  const local = getBook(slug);
  if (local) return local;

  let findCatalogueBook: ((slug: string) => Promise<{ book: Book; url?: string; encoding?: string } | undefined>) | undefined;
  try {
    // Dynamic import ensures clean interop with the server catalogue worker
    // @ts-ignore
    const catalogue = await import('@/lib/bookCatalogue');
    findCatalogueBook = catalogue.findCatalogueBook;
  } catch (error: unknown) {
    const isModuleMissing =
      (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'MODULE_NOT_FOUND') ||
      (error instanceof Error && error.message.includes('Cannot find module'));
    if (!isModuleMissing) {
      throw error;
    }
  }

  if (!findCatalogueBook) {
    return undefined;
  }

  // Proper error path for upstream failures (don't fake 404):
  // Errors from catalogue lookup propagate directly.
  const result = await findCatalogueBook(slug);
  return result?.book;
}

export default async function BookReaderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await resolveBook(slug);
  if (!book) {
    notFound();
  }
  return <BookReader key={book.slug} book={book} />;
}
