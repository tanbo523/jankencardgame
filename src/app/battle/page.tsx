'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Socket } from 'socket.io-client';
import { getSocket } from '../_socket'; 
import Hand from '@/components/Hand';
import Card from '@/components/Card';
import CardBack from '@/components/CardBack';
import CardSlot from '@/components/CardSlot';
import { CardType, DeckType, JankenHand } from '@/types';
import { getJankenResult, GameResult } from '@/utils/game';
import Link from 'next/link';
import { monstersList } from '@/monstersList';
import { useSound } from '@/hooks/useSound';

const getRandomMonsterImage = (hand: JankenHand): string => {
  const list = monstersList[hand];
  const file = list[Math.floor(Math.random() * list.length)];
  return `/monsters/${hand}/${file}`;
};

// 仮のダミーデッキ生成ロジック（AI用）
const createDummyDeck = (): DeckType => {
  const hands: JankenHand[] = ['fire', 'water', 'grass'];
  const moveNames = ['Fire-arrow', 'Water-arrow', 'Grass-arrow'];
  return Array.from({ length: 7 }, (_, i) => ({
    id: `card-${i + 1}`,
    name: `Card ${i + 1}`,
    imageUrl: getRandomMonsterImage(hands[i % 3]),
    hand: hands[i % 3],
    moveName: `${moveNames[i % 3]} ${i + 1}`,
  }));
};

const BattlePage = () => {
  const searchParams = useSearchParams();

  // Online mode state
  const socketRef = useRef<Socket | null>(null);
  const isOnline = searchParams.get('online') === 'true';
  const roomId = searchParams.get('room');

  // 効果音
  const { 
    playCardSelect, 
    playButtonClick, 
    playBattleFight,
    playBattleWin,
    playBattleLose,
    playBattleDraw,
    playFinalWin,
    playFinalLose,
    playFinalDraw
  } = useSound();

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
  const [isWaiting, setIsWaiting] = useState(false);
  

  useEffect(() => {
    if (!isOnline || !roomId) return;
    const socket = getSocket();
    const handleReconnect = () => {
      if (playerHand.length > 0) {
        socket.emit('join-battle-room', { roomId, deck: playerHand });
      }
    };
    socket.on('reconnect', handleReconnect);
    return () => {
      socket.off('reconnect', handleReconnect);
    };
  }, [isOnline, roomId, playerHand]);

  // Deck initialization & Online connection
  useEffect(() => {
    // 1. Deck initialization from localStorage
    let initialPlayerHand: DeckType = [];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('janken_deck');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialPlayerHand = parsed;
            setPlayerHand(initialPlayerHand);
          }
        } catch {}
      }
    }
    if (initialPlayerHand.length === 0) {
      initialPlayerHand = createDummyDeck();
      setPlayerHand(initialPlayerHand);
    }

    // 2. Online mode connection
    if (isOnline && roomId) {
      const newSocket = getSocket();
      socketRef.current = newSocket;

      const handleConnect = () => {
        console.log('Connected to battle server!');
        newSocket.emit('join-battle-room', { roomId, deck: initialPlayerHand });
      };
      const handleBattleStart = ({ opponentDeck }: { opponentDeck: DeckType }) => {
        console.log('Battle is starting! Opponent deck received.');
        setOpponentHand(opponentDeck);
      };

      newSocket.on('connect', handleConnect);
      newSocket.on('battle-start', handleBattleStart);

      // クリーンアップで解除
      return () => {
        newSocket.off('connect', handleConnect);
        newSocket.off('battle-start', handleBattleStart);
      };
    }
  }, [isOnline, roomId]);

  // カード選択
  const handleCardClick = (card: CardType) => {
    if (isBattleInProgress || isResultShown || isGameOver) return;
    setSelectedCard(card);
    playCardSelect(); // カード選択音を再生
  };

  // バトル開始
  const handleBattleStart = () => {
    if (!selectedCard || isBattleInProgress || isResultShown || isGameOver) return;
    playButtonClick(); // 決定ボタン音を再生
    if (isOnline && socketRef.current && roomId) {
      setIsWaiting(true); // 待機中フラグ
      setPlayerHand(prev => prev.filter(c => c.id !== selectedCard.id));
      socketRef.current.emit('play-card', { roomId, card: selectedCard });
      return;
    }
    // オフライン（AI）モード
    setIsBattleInProgress(true);
    setPlayerCard(selectedCard);
    setPlayerHand(prev => prev.filter(c => c.id !== selectedCard.id));

    // AIのカードをランダムに選ぶ
    const aiIndex = Math.floor(Math.random() * opponentHand.length);
    const aiCard = opponentHand[aiIndex];
    setOpponentCard(aiCard);

    // AIの手札から使ったカードを除外
    setOpponentHand(prev => prev.filter((_, i) => i !== aiIndex));

    // 画像プリロード
    setIsImageLoading(true);
    const img = new window.Image();
    img.src = selectedCard.imageUrl;
    img.onload = () => {
      setTimeout(() => {
        setIsImageLoading(false);
        playBattleFight(); // ここで戦闘音を再生
        // 4秒間アニメーション
        battleTimeout.current = setTimeout(() => {
          // 勝敗判定
          const result = getJankenResult(selectedCard.hand, aiCard.hand);
          setBattleResult(result);
          setIsResultShown(true);
          
          // バトル結果音を再生
          if (result === 'win') {
            setPlayerScore(s => s + 1);
            playBattleWin();
          } else if (result === 'lose') {
            setOpponentScore(s => s + 1);
            playBattleLose();
          } else {
            playBattleDraw();
          }

          // 1.5秒後に次ラウンド
          resultTimeout.current = setTimeout(() => {
            setPlayerCard(null);
            setOpponentCard(null);
            setBattleResult(null);
            setIsResultShown(false);
            setIsBattleInProgress(false);
            setSelectedCard(null);
            // 最新のplayerHandを参照して終了判定
            setPlayerHand(prev => {
              if (prev.length === 0) {
                setIsGameOver(true);
                // 最終結果音を再生
                if (playerScore + (result === 'win' ? 1 : 0) > opponentScore + (result === 'lose' ? 1 : 0)) {
                  playFinalWin();
                } else if (playerScore + (result === 'win' ? 1 : 0) < opponentScore + (result === 'lose' ? 1 : 0)) {
                  playFinalLose();
                } else {
                  playFinalDraw();
                }
              }
              return prev;
            });
          }, 1500);
        }, 4500);
      }, 500); // ここで0.5秒待つ
    };
  };

  // オンライン対戦: battle-resultイベント受信
  useEffect(() => {
    if (!isOnline || !socketRef.current) return;
    const onBattleResult = ({ myCard, opponentCard, result }: { myCard: CardType, opponentCard: CardType, result: GameResult }) => {
      playBattleFight(); // ここで戦闘音を再生
      setIsWaiting(false);
      setIsBattleInProgress(true);
      setPlayerCard(myCard);
      setOpponentCard(opponentCard);
      setOpponentHand(prev => prev.filter(c => c.id !== opponentCard.id));
      setIsImageLoading(false);
   
      // 4秒間アニメーション
      battleTimeout.current = setTimeout(() => {
        setBattleResult(result);
        setIsResultShown(true);
        
        // バトル結果音を再生
        if (result === 'win') {
          setPlayerScore(s => s + 1);
          playBattleWin();
        } else if (result === 'lose') {
          setOpponentScore(s => s + 1);
          playBattleLose();
        } else {
          playBattleDraw();
        }

        // 1.5秒後に次ラウンド
        resultTimeout.current = setTimeout(() => {
          setPlayerCard(null);
          setOpponentCard(null);
          setBattleResult(null);
          setIsResultShown(false);
          setIsBattleInProgress(false);
          setSelectedCard(null);
          if (playerHand.length === 0) {
            setIsGameOver(true);
            // 最終結果音を再生
            if (playerScore + (result === 'win' ? 1 : 0) > opponentScore + (result === 'lose' ? 1 : 0)) {
              playFinalWin();
            } else if (playerScore + (result === 'win' ? 1 : 0) < opponentScore + (result === 'lose' ? 1 : 0)) {
              playFinalLose();
            } else {
              playFinalDraw();
            }
          }
        }, 1500);
      }, 4500);
    };
    socketRef.current.on('battle-result', onBattleResult);
    return () => {
      socketRef.current?.off('battle-result', onBattleResult);
    };
  }, [isOnline, playerHand.length]);

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
            <div className="text-2xl font-bold">FIGHT!</div>
          </div>
        </div>
      )}
      {/* 待機中表示 */}
      {isWaiting && (
        <div className="fixed inset-0 bg-black/20 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-xl font-bold">相手の選択を待っています…</div>
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
            <Link 
              href="/" 
              onClick={playButtonClick}
              className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              メニューに戻る
            </Link>
          </div>
        </div>
      )}
    </main>
  );
};

export default function BattlePageWithSuspense() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-xl">Loading...</div>}>
      <BattlePage />
    </Suspense>
  );
} 