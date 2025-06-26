export type JankenHand = 'fire' | 'water' | 'grass';

export type CardType = {
  id: string;
  name: string;
  imageUrl: string;
  hand: JankenHand;
  moveName: string;
};

export type DeckType = CardType[]; 