
import React from 'react';
import { UserCharacter } from '../types';

interface CharacterCardProps {
  character: UserCharacter;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character }) => {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-xl transform hover:scale-105 transition-transform duration-300">
      <img src={character.imageUrl} alt={character.characterName} className="w-full h-56 object-cover" />
      <div className="p-4">
        <h3 className="text-xl font-bold text-purple-400">{character.characterName}</h3>
        <p className="text-gray-400 mt-2 text-sm h-20 overflow-y-auto">{character.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {character.keywords.slice(0, 3).map((keyword) => (
            <span key={keyword} className="bg-gray-700 text-pink-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterCard;
