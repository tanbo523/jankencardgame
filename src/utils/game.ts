import { JankenHand } from "@/types";

export type GameResult = 'win' | 'lose' | 'draw';

export const getJankenResult = (playerHand: JankenHand, opponentHand: JankenHand): GameResult => {
  if (playerHand === opponentHand) {
    return 'draw';
  }
  if (
    (playerHand === 'rock' && opponentHand === 'scissors') ||
    (playerHand === 'scissors' && opponentHand === 'paper') ||
    (playerHand === 'paper' && opponentHand === 'rock')
  ) {
    return 'win';
  }
  return 'lose';
}; 