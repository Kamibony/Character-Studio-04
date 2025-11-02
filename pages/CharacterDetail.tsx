
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { UserCharacter } from '../types';
import { generateCharacterVisualization } from '../services/firebase';
import Loader from '../components/Loader';
import ErrorDisplay from '../components/ErrorDisplay';
// A simplified way to get a single doc; in a real app this would be a dedicated function.
import { getCharacterLibrary } from '../services/firebase'; 


const CharacterDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [character, setCharacter] = useState<UserCharacter | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCharacter = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCharacterLibrary();
      const allChars = result.data as UserCharacter[];
      const foundChar = allChars.find(c => c.id === id);
      if (foundChar) {
        setCharacter(foundChar);
      } else {
        setError('Character not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch character.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  const handleGenerate = async () => {
    if (!id || !prompt) return;
    setGenerating(true);
    setError(null);
    setGeneratedImage(null);
    try {
      const result = await generateCharacterVisualization({ characterId: id, prompt });
      const imageData = result.data as { imageBase64: string };
      setGeneratedImage(`data:image/jpeg;base64,${imageData.imageBase64}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate image.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="flex justify-center mt-16"><Loader text="Loading Character..." /></div>;
  if (error && !character) return <ErrorDisplay title="Error" message={error} />;
  if (!character) return <div className="text-center mt-16">Character not found.</div>;

  return (
    <div className="container mx-auto max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Character Info */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <img src={character.imageUrl} alt={character.characterName} className="w-full rounded-lg mb-6 shadow-lg" />
          <h1 className="text-4xl font-bold text-purple-400 mb-2">{character.characterName}</h1>
          <p className="text-gray-300 mb-4">{character.description}</p>
          <div className="flex flex-wrap gap-2">
            {character.keywords.map((keyword) => (
              <span key={keyword} className="bg-gray-700 text-pink-400 text-sm font-semibold px-3 py-1 rounded-full">
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* Generator */}
        <div className="bg-gray-800 p-6 rounded-lg sticky top-8">
          <h2 className="text-2xl font-bold mb-4">Generate Visualization</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`e.g., "${character.characterName} standing on a rainy street at night"`}
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            rows={4}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
          
          {error && <div className="mt-4"><ErrorDisplay title="Generation Failed" message={error} /></div>}

          <div className="mt-6 w-full aspect-square bg-gray-900 rounded-lg flex items-center justify-center">
            {generating && <Loader text="Creating image..."/>}
            {!generating && generatedImage && (
              <img src={generatedImage} alt="Generated visualization" className="w-full h-full object-contain rounded-lg"/>
            )}
            {!generating && !generatedImage && (
              <p className="text-gray-500">Your generated image will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterDetail;
