import { JankenHand } from "@/types";

export type GameResult = 'win' | 'lose' | 'draw';

export const getJankenResult = (playerHand: JankenHand, opponentHand: JankenHand): GameResult => {
  // 同じタイプの場合：45%勝利, 10%引き分け, 45%敗北
  if (playerHand === opponentHand) {
    const rand = Math.random();
    if (rand < 0.45) return 'win';
    if (rand < 0.9) return 'lose';
    return 'draw';
  }

  const rand = Math.random();

  // プレイヤーが有利な場合：65%勝利, 5%引き分け, 30%敗北
  if (
    (playerHand === 'water' && opponentHand === 'fire') ||
    (playerHand === 'fire' && opponentHand === 'grass') ||
    (playerHand === 'grass' && opponentHand === 'water')
  ) {
    if (rand < 0.65) return 'win';
    if (rand < 0.7) return 'draw';
    return 'lose';
  }
  // プレイヤーが不利な場合：30%勝利, 5%引き分け, 65%敗北
  else {
    if (rand < 0.3) return 'win';
    if (rand < 0.35) return 'draw';
    return 'lose';
  }
}; 