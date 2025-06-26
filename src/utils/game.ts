import { JankenHand } from "@/types";

export type GameResult = 'win' | 'lose' | 'draw';

export const getJankenResult = (playerHand: JankenHand, opponentHand: JankenHand): GameResult => {
  if (playerHand === opponentHand) {
    return 'draw';
  }
  if (
    (playerHand === 'water' && opponentHand === 'fire') ||
    (playerHand === 'fire' && opponentHand === 'grass') ||
    (playerHand === 'grass' && opponentHand === 'water')
  ) {
    return 'win';
  }
  return 'lose';
}; 