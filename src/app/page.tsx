'use client';

import Link from 'next/link';
import { useSound } from '@/hooks/useSound';

export default function Home() {
  const { playButtonClick } = useSound();

  const handleLinkClick = () => {
    playButtonClick();
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Janken Card Game</h1>

      <div className="flex flex-col gap-4 mb-8">
        <Link 
          href="/deck-builder" 
          onClick={handleLinkClick}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-center"
        >
          AIと対戦
        </Link>
        <Link 
          href="/deck-builder?mode=online" 
          onClick={handleLinkClick}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-center"
        >
          オンラインで対戦
        </Link>
      </div>
    </main>
  );
}
