
import React from 'react';

interface ErrorDisplayProps {
  title: string;
  message: React.ReactNode;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ title, message }) => {
  return (
    <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg relative" role="alert">
      <strong className="font-bold">{title}</strong>
      <div className="block sm:inline mt-2 sm:mt-0 sm:ml-2">{message}</div>
    </div>
  );
};

export default ErrorDisplay;
