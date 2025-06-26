import { DeckType, CardType } from '@/types';
import Card from './Card';

type Props = {
  hand: DeckType;
  onCardClick?: (card: CardType) => void;
  selectedCardId?: string;
};

const Hand = ({ hand, onCardClick, selectedCardId }: Props) => {
  return (
    <div className="flex justify-center flex-wrap -m-1 md:-m-2">
      {hand.map((card) => (
        <div key={card.id} className="p-1 md:p-2 w-1/4 sm:w-1/5 md:w-[14.28%] lg:w-1/8" style={{ minWidth: '60px', maxWidth: '100px' }}>
          <Card
            card={card}
            onClick={onCardClick}
            className={selectedCardId === card.id ? 'ring-4 ring-blue-400' : ''}
          />
        </div>
      ))}
    </div>
  );
};

export default Hand; 