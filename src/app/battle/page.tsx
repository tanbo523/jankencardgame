'use client';

import React, { useState, useRef, useEffect } from 'react';
import Hand from '@/components/Hand';
import Card from '@/components/Card';
import CardBack from '@/components/CardBack';
import CardSlot from '@/components/CardSlot';
import { CardType, DeckType, JankenHand } from '@/types';
import { getJankenResult, GameResult } from '@/utils/game';
import Link from 'next/link';
import { monstersList } from '@/monstersList';

const getRandomMonsterImage = (hand: JankenHand): string => {
  const list = monstersList[hand];
  const file = list[Math.floor(Math.random() * list.length)];
  return `/monsters/${hand}/${file}`;
};

// 仮のダミーデッキ生成ロジック（AI用）
const createDummyDeck = (): DeckType => {
  const hands: JankenHand[] = ['fire', 'water', 'grass'];
  const moveNames = ['かえんほうしゃ', 'みずでっぽう', 'はっぱカッター'];
  return Array.from({ length: 7 }, (_, i) => ({
    id: `card-${i + 1}`,
    name: `Card ${i + 1}`,
    imageUrl: getRandomMonsterImage(hands[i % 3]),
    hand: hands[i % 3],
    moveName: `${moveNames[i % 3]} ${i + 1}`,
  }));
};

const BattlePage = () => {
  const [playerHand, setPlayerHand] = useState<DeckType>([]);
  const [opponentHand, setOpponentHand] = useState<DeckType>(createDummyDeck());
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [playerCard, setPlayerCard] = useState<CardType | null>(null);
  const [opponentCard, setOpponentCard] = useState<CardType | null>(null);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [isBattleInProgress, setIsBattleInProgress] = useState(false);
  const [battleResult, setBattleResult] = useState<GameResult | null>(null);
  const [isResultShown, setIsResultShown] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const battleTimeout = useRef<NodeJS.Timeout | null>(null);
  const resultTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // デッキ初期化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('janken_deck');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlayerHand(parsed);
            return;
          }
        } catch {}
      }
    }
    setPlayerHand(createDummyDeck());
  }, []);

  // カード選択
  const handleCardClick = (card: CardType) => {
    if (isBattleInProgress || isResultShown || isGameOver) return;
    setSelectedCard(card);
  };

  // バトル開始
  const handleBattleStart = () => {
    if (!selectedCard || isBattleInProgress || isResultShown || isGameOver) return;
    setIsBattleInProgress(true);
    setPlayerCard(selectedCard);
    setPlayerHand(prev => prev.filter(c => c.id !== selectedCard.id));

    // AIカード選択
    const opponentChoice = opponentHand[Math.floor(Math.random() * opponentHand.length)];
    setOpponentCard(opponentChoice);
    setOpponentHand(prev => prev.filter(c => c.id !== opponentChoice.id));

    // 画像プリロード
    setIsImageLoading(true);
    const img = new window.Image();
    img.src = opponentChoice.imageUrl;
    img.onload = () => {
      setTimeout(() => {
        setIsImageLoading(false);
        // 3秒間アニメーション
        battleTimeout.current = setTimeout(() => {
          // 勝敗判定
          const result = getJankenResult(selectedCard.hand, opponentChoice.hand);
          setBattleResult(result);
          setIsResultShown(true);
          if (result === 'win') setPlayerScore(s => s + 1);
          if (result === 'lose') setOpponentScore(s => s + 1);

          // 2秒後に次ラウンド
          resultTimeout.current = setTimeout(() => {
            setPlayerCard(null);
            setOpponentCard(null);
            setBattleResult(null);
            setIsResultShown(false);
            setIsBattleInProgress(false);
            setSelectedCard(null);
            if (playerHand.length === 1) setIsGameOver(true);
          }, 2000);
        }, 3000);
      }, 800); // ここで0.8秒待つ
    };
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (battleTimeout.current) clearTimeout(battleTimeout.current);
      if (resultTimeout.current) clearTimeout(resultTimeout.current);
    };
  }, []);

  const getFinalMessage = () => {
    if (playerScore > opponentScore) return 'あなたの勝ちです！';
    if (playerScore < opponentScore) return 'あなたの負けです...';
    return '引き分けです！';
  };

  const opponentHandRow1 = opponentHand.slice(0, 4);
  const opponentHandRow2 = opponentHand.slice(4, 7);

  // カードのアニメーション・明暗・win表示用クラス
  const getCardClass = (side: 'player' | 'opponent') => {
    if (isBattleInProgress && !isResultShown) {
      return 'animate-battle-fight';
    }
    if (isResultShown && battleResult) {
      if (battleResult === 'draw') return 'brightness-100';
      if (battleResult === 'win') {
        return side === 'player' ? 'brightness-110 ring-4 ring-yellow-400 rounded-lg' : 'brightness-25 grayscale scale-90';
      }
      if (battleResult === 'lose') {
        return side === 'opponent' ? 'brightness-110 ring-4 ring-yellow-400 rounded-lg' : 'brightness-25 grayscale scale-90';
      }
    }
    return '';
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 pt-20">
      {/* Loading表示 */}
      {isImageLoading && (
        <div className="fixed inset-0 bg-black/10 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-full shadow-xl flex flex-col items-center">
            <div className="text-2xl font-bold">バトルスタート！</div>
          </div>
        </div>
      )}
      {/* Opponent Area */}
      <div className="w-full mb-8">
        <h2 className="text-xl font-bold text-center mb-2">Opponent (Score: {opponentScore})</h2>
        
        {/* Mobile layout: 2 rows (4 and 3) */}
        <div className="sm:hidden">
          <div className="flex justify-center -m-1">
            {opponentHandRow1.map(card => (
              <div key={card.id} className="p-1 w-1/4" style={{ minWidth: '40px', maxWidth: '60px' }}>
                <CardBack />
              </div>
            ))}
          </div>
          <div className="flex justify-center -m-1 mt-1">
            {opponentHandRow2.map(card => (
              <div key={card.id} className="p-1 w-1/4" style={{ minWidth: '40px', maxWidth: '60px' }}>
                <CardBack />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop layout: single row */}
        <div className="hidden sm:flex justify-center flex-wrap -m-1 md:-m-2 h-auto">
          {opponentHand.map(card => (
            <div key={card.id} className="p-1 md:p-2 w-1/5 md:w-[14.28%] lg:w-1/8" style={{ minWidth: '40px', maxWidth: '60px' }}>
              <CardBack />
            </div>
          ))}
        </div>
      </div>

      {/* Battle Zone */}
      <div className="flex justify-center items-center gap-8 md:gap-16 my-8 w-full">
        <div className="w-1/3 max-w-[120px] flex flex-col items-center">
          {opponentCard ? (
            <div className={getCardClass('opponent') + ' relative w-full'}>
              {isResultShown && (
                <>
                  {battleResult === 'draw' && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-gray-400 text-2xl font-bold drop-shadow">draw</span>
                  )}
                  {battleResult === 'win' && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-red-400 text-2xl font-bold drop-shadow">lose</span>
                  )}
                  {battleResult === 'lose' && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400 text-2xl font-bold drop-shadow">win</span>
                  )}
                </>
              )}
              <Card card={opponentCard} disableHover />
            </div>
          ) : <CardSlot />}
        </div>
        <div className={`text-xl md:text-2xl font-bold transition-transform duration-500 ${isBattleInProgress && !isResultShown ? 'scale-150 text-red-500' : ''}`}>
          VS
        </div>
        <div className="w-1/3 max-w-[120px] flex flex-col items-center">
          {playerCard ? (
            <div className={getCardClass('player') + ' relative w-full'}>
              {isResultShown && (
                <>
                  {battleResult === 'draw' && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-gray-400 text-2xl font-bold drop-shadow">draw</span>
                  )}
                  {battleResult === 'win' && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-400 text-2xl font-bold drop-shadow">win</span>
                  )}
                  {battleResult === 'lose' && (
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-red-400 text-2xl font-bold drop-shadow">lose</span>
                  )}
                </>
              )}
              <Card card={playerCard} disableHover />
            </div>
          ) : <CardSlot />}
        </div>
      </div>

      {/* Player Area */}
      <div className="w-full">
        <h2 className="text-xl font-bold text-center mb-2">Player (Score: {playerScore})</h2>
        <div className="flex justify-center mt-4 mb-4">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            onClick={handleBattleStart}
            disabled={!selectedCard || isBattleInProgress || isResultShown || isGameOver}
          >
            決定
          </button>
        </div>
        <Hand hand={playerHand} onCardClick={handleCardClick} selectedCardId={selectedCard?.id} />
        
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center">
            <h3 className="text-4xl font-bold mb-4">ゲーム終了！</h3>
            <div className="text-5xl mb-2">
              {playerScore > opponentScore && '🥳'}
              {playerScore < opponentScore && '😭'}
              {playerScore === opponentScore && '😐'}
            </div>
            <p className="text-2xl mb-6">{getFinalMessage()}</p>
            <p className="text-lg mb-6">あなた {playerScore}勝 - {opponentScore}勝 相手</p>
            <Link href="/" className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
              メニューに戻る
            </Link>
          </div>
        </div>
      )}
    </main>
  );
};

export default BattlePage; 