import { Flashcards } from '@/components/flashcards/Flashcards';
import '../../flashcards.css';

export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Flashcards deckId={slug} />;
}
