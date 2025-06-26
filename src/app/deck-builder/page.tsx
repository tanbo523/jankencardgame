'use client';

import { useState, useEffect } from 'react';
import Hand from '@/components/Hand';
import { CardType, DeckType, JankenHand } from '@/types';
import imageCompression from 'browser-image-compression';
import { useRouter } from 'next/navigation';

const createDummyDeck = (): DeckType => {
  const hands: JankenHand[] = ['rock', 'scissors', 'paper'];
  const moveNames = ['グーパンチ', 'チョキカッター', 'パーアタック'];
  return Array.from({ length: 7 }, (_, i) => ({
    id: `card-${i + 1}`,
    name: `Card ${i + 1}`,
    imageUrl: `https://placehold.co/100x140/png?text=Card${i + 1}`,
    hand: hands[i % 3],
    moveName: `${moveNames[i % 3]} ${i + 1}`,
  }));
};

export default function DeckBuilderPage() {
  const [myHand, setMyHand] = useState<DeckType>(createDummyDeck());
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('janken_deck');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMyHand(parsed);
            return;
          }
        } catch {}
      }
    }
    setMyHand(createDummyDeck());
  }, []);

  const handleCardClick = (card: CardType) => {
    setEditingCard(JSON.parse(JSON.stringify(card))); // Deep copy for editing
  };

  const handleUpdateCard = () => {
    if (!editingCard) return;
    setMyHand(myHand.map(card => card.id === editingCard.id ? editingCard : card));
    setEditingCard(null);
  };

  const handleCancelEdit = () => {
    setEditingCard(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingCard) return;
    const imageFile = event.target.files?.[0];
    if (!imageFile) return;

    const options = {
      maxSizeMB: 0.5, // (max file size in MB)
      maxWidthOrHeight: 800, // (max width or height in pixels)
      useWebWorker: true,
    };
    try {
      const compressedFile = await imageCompression(imageFile, options);
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = () => {
        const base64data = reader.result;
        if (typeof base64data === 'string') {
          setEditingCard({ ...editingCard, imageUrl: base64data });
        }
      };
    } catch (error) {
      console.error('Image compression failed:', error);
    }
  };

  const handleGoToBattle = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('janken_deck', JSON.stringify(myHand));
    }
    router.push('/battle');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 pt-20">
      <h1 className="text-4xl font-bold mb-8">Deck Builder</h1>
      <div className="mb-8">
        <p className="text-center text-gray-600 mb-4">カードをクリックして編集します</p>
        <Hand hand={myHand} onCardClick={handleCardClick} />
      </div>

      <button
        onClick={handleGoToBattle}
        className="mt-8 bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded text-lg"
      >
        このデッキで対戦へ進む
      </button>

      {editingCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-4">Edit Card</h3>
            <div className="flex flex-col gap-4">
              {/* Card Name */}
              <div>
                <label className="block mb-1 font-bold text-gray-700">カード名</label>
                <input
                  type="text"
                  value={editingCard.name}
                  onChange={(e) => setEditingCard({ ...editingCard, name: e.target.value })}
                  className="w-full border p-2 rounded"
                  placeholder="例：リザードン"
                />
              </div>

              {/* Image Preview */}
              <div className="self-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editingCard.imageUrl} alt="Preview" className="w-32 h-44 object-cover rounded-lg border" />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block mb-1 font-bold text-gray-700">カード画像</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                />
              </div>
              
              {/* Move Name */}
              <div>
                <label className="block mb-1 font-bold text-gray-700">技名</label>
                <input
                  type="text"
                  value={editingCard.moveName}
                  onChange={(e) => setEditingCard({ ...editingCard, moveName: e.target.value })}
                  className="w-full border p-2 rounded"
                  placeholder="例：ストーンエッジ"
                />
              </div>

              {/* Hand Type */}
              <div>
                <label className="block mb-1 font-bold text-gray-700">属性</label>
                <select
                  value={editingCard.hand}
                  onChange={(e) => setEditingCard({ ...editingCard, hand: e.target.value as JankenHand })}
                  className="w-full border p-2 rounded"
                >
                  <option value="rock">✊ グー</option>
                  <option value="scissors">✌️ チョキ</option>
                  <option value="paper">✋ パー</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 mt-4">
                <button onClick={handleCancelEdit} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">
                  Cancel
                </button>
                <button onClick={handleUpdateCard} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 