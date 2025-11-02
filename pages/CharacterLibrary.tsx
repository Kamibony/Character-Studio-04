import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserCharacter } from '../types';
import { getCharacterLibrary } from '../services/firebase';
import CharacterCard from '../components/CharacterCard';
import Loader from '../components/Loader';
import ErrorDisplay from '../components/ErrorDisplay';

const CharacterLibrary: React.FC = () => {
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCharacterLibrary();
      // Client-side sorting
      const sortedCharacters = (result.data as UserCharacter[]).sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt as any)._seconds : 0;
        const dateB = b.createdAt ? (b.createdAt as any)._seconds : 0;
        return dateB - dateA;
      });
      setCharacters(sortedCharacters);
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.toLowerCase().includes('internal')) {
        setError("Failed to load library due to a server error. This might be caused by a missing database index. Please check your Firebase function logs for a link to create the required index.");
      } else {
        setError(err.message || 'Failed to fetch character library.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold">Character Library</h1>
        <Link
          to="/create"
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105"
        >
          + Create New Pair
        </Link>
      </div>

      {loading && <div className="flex justify-center mt-16"><Loader text="Loading Library..." /></div>}
      {error && <ErrorDisplay title="Error" message={error} />}
      
      {!loading && !error && characters.length === 0 && (
        <div className="text-center py-16 px-6 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-300">Your library is empty.</h2>
          <p className="mt-2 text-gray-400">Click "Create New Pair" to start building your cast!</p>
        </div>
      )}

      {!loading && !error && characters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {characters.map((char) => (
            <Link to={`/character/${char.id}`} key={char.id}>
              <CharacterCard character={char} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CharacterLibrary;