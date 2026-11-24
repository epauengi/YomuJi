import { Flashcards } from '@/components/flashcards/Flashcards';
import { demoDecks } from '@/data/mockData';
import '../../flashcards.css';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: demoDecks.find((deck) => deck.id === slug)?.name ?? 'Chi tiết bộ thẻ' };
}

export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Flashcards deckId={slug} />;
}
