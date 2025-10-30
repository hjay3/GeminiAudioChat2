
import React from 'react';
import type { Turn } from '../types';
import { DownloadIcon, UserIcon, BotIcon } from './Icons';

interface ConversationTurnProps {
  turn: Turn;
}

const AudioDownloadButton: React.FC<{ audioBlob: Blob | null, fileName: string }> = ({ audioBlob, fileName }) => {
  if (!audioBlob) return null;

  const handleDownload = () => {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="p-1.5 text-dark-text-secondary hover:text-dark-text-primary hover:bg-dark-surface rounded-full transition-colors duration-200 opacity-50 hover:opacity-100"
      aria-label={`Download ${fileName}`}
    >
      <DownloadIcon className="w-5 h-5" />
    </button>
  );
};

export const ConversationTurn: React.FC<ConversationTurnProps> = ({ turn }) => {
  return (
    <div className="space-y-4">
      {turn.user && (
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-blue-300" />
          </div>
          <div className="flex-grow bg-dark-surface p-4 rounded-lg rounded-tl-none">
            <p className="text-dark-text-primary">{turn.user}</p>
          </div>
           <div className="w-10 flex-shrink-0 flex items-center justify-center">
                <AudioDownloadButton audioBlob={turn.userAudio} fileName="user_query.mp3" />
           </div>
        </div>
      )}
      {turn.model && (
        <div className="flex items-start space-x-4">
           <div className="w-10 flex-shrink-0 flex items-center justify-center">
                <AudioDownloadButton audioBlob={turn.modelAudio} fileName="ai_response.mp3" />
           </div>
          <div className="flex-grow bg-dark-surface p-4 rounded-lg rounded-tr-none text-right">
            <p className="text-dark-text-primary">{turn.model}</p>
          </div>
           <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
             <BotIcon className="w-5 h-5 text-purple-300" />
          </div>
        </div>
      )}
    </div>
  );
};
