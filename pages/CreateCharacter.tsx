
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import { createCharacterPair } from '../services/firebase';
import Loader from '../components/Loader';
import ErrorDisplay from '../components/ErrorDisplay';

interface FileData {
  file: File | null;
  base64: string | null;
  mimeType: string | null;
}

const CreateCharacter: React.FC = () => {
  const [charA, setCharA] = useState<FileData>({ file: null, base64: null, mimeType: null });
  const [charB, setCharB] = useState<FileData>({ file: null, base64: null, mimeType: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFileSelectA = (file: File | null, base64: string | null) => {
    setCharA({ file, base64, mimeType: file?.type || null });
  };

  const handleFileSelectB = (file: File | null, base64: string | null) => {
    setCharB({ file, base64, mimeType: file?.type || null });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!charA.base64 || !charB.base64 || !charA.mimeType || !charB.mimeType) {
      setError("Please upload an image for both Character A and Character B.");
      return;
    }
    
    setError(null);
    setLoading(true);

    // remove data:image/jpeg;base64, prefix
    const cleanBase64A = charA.base64.split(',')[1];
    const cleanBase64B = charB.base64.split(',')[1];

    try {
      await createCharacterPair({ 
        charABase64: cleanBase64A,
        charAMimeType: charA.mimeType,
        charBBase64: cleanBase64B,
        charBMimeType: charB.mimeType
      });
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create character pair.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader text="Analyzing characters... This may take a moment." />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">Create a New Character Pair</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <FileUpload label="Upload Image for Character A" onFileSelect={handleFileSelectA} />
          <FileUpload label="Upload Image for Character B" onFileSelect={handleFileSelectB} />
        </div>

        {error && <div className="mb-6"><ErrorDisplay title="Creation Error" message={error} /></div>}

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={!charA.file || !charB.file || loading}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-12 rounded-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            Create Pair
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCharacter;
