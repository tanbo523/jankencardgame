// import Image from 'next/image';
import { CardType, JankenHand } from '@/types';

const handToIcon: Record<JankenHand, string> = {
  rock: '✊',
  scissors: '✌️',
  paper: '✋',
};

type Props = {
  card: CardType;
  onClick?: (card: CardType) => void;
  className?: string;
  disableHover?: boolean;
};

const Card = ({ card, onClick, className = '', disableHover = false }: Props) => {
  return (
    <div
      className={`relative w-full aspect-[5/7] rounded-lg p-2 cursor-pointer border-1 ${!disableHover ? 'hover:scale-105 transition-transform duration-150' : ''} ${className}`}
      onClick={() => onClick?.(card)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.imageUrl}
        alt={card.name}
        className="object-cover w-full h-full rounded-md"
      />
      <div className="absolute bottom-0 left-0 right-0 p-1 bg-black bg-opacity-50 rounded-b-md">
        <p className="text-white text-xs font-bold truncate">{card.name}</p>
      </div>
      <div className="absolute bottom-0 right-1 text-md drop-shadow-md">
        {handToIcon[card.hand]}
      </div>
    </div>
  );
};

export default Card; 