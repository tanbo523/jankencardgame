import { DeckType, CardType } from '@/types';
import Card from './Card';

type Props = {
  hand: DeckType;
  onCardClick?: (card: CardType) => void;
  selectedCardId?: string;
};

const Hand = ({ hand, onCardClick, selectedCardId }: Props) => {
  return (
    <div className="flex justify-center flex-wrap -m-2 md:-m-2 lg:-m-3">
      {hand.map((card) => (
        <div key={card.id} className="p-2 md:p-2 lg:p-3 w-1/2 sm:w-1/4 md:w-1/5 lg:w-1/6" style={{ minWidth: '100px', maxWidth: '140px' }}>
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