
import React, { useState, useRef } from 'react';
import Loader from './Loader';

interface FileUploadProps {
  label: string;
  onFileSelect: (file: File | null, base64: string | null) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const MAX_DIMENSION = 1024;
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!e.target?.result) {
            return reject(new Error("Failed to read file."));
        }
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
            resolve(e.target?.result as string);
            return;
          }

          if (width > height) {
            if (width > MAX_DIMENSION) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Could not get canvas context'));
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      onFileSelect(null, null);
      return;
    }

    setIsProcessing(true);

    try {
      const resizedBase64 = await resizeImage(file);
      setPreview(resizedBase64);
      onFileSelect(file, resizedBase64);
    } catch (error) {
      console.error("Image processing failed:", error);
      setPreview(null);
      onFileSelect(null, null);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClick = () => {
    if (!isProcessing) {
        fileInputRef.current?.click();
    }
  };

  return (
    <div 
        onClick={handleClick}
        className={`w-full p-4 border-2 border-dashed border-gray-600 rounded-lg text-center ${isProcessing ? 'cursor-wait bg-gray-800' : 'cursor-pointer hover:border-purple-500 hover:bg-gray-800'} transition-colors duration-300 flex flex-col justify-center items-center h-64`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        disabled={isProcessing}
      />
      {isProcessing ? (
        <Loader text="Processing Image..."/>
      ) : preview ? (
        <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain rounded-md" />
      ) : (
        <div className="text-gray-400">
          <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mt-2">{label}</p>
          <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
