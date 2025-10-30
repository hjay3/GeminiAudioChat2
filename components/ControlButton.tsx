
import React from 'react';
import type { ConnectionState } from '../types';
import { MicIcon, StopIcon, LoaderIcon } from './Icons';

interface ControlButtonProps {
  state: ConnectionState;
  onClick: () => void;
}

export const ControlButton: React.FC<ControlButtonProps> = ({ state, onClick }) => {
  const isLoading = state === 'connecting' || state === 'disconnecting';

  const buttonConfig = {
    disconnected: { text: 'Start Conversation', icon: <MicIcon className="w-6 h-6" />, color: 'bg-blue-600 hover:bg-blue-700' },
    error: { text: 'Try Again', icon: <MicIcon className="w-6 h-6" />, color: 'bg-blue-600 hover:bg-blue-700' },
    connected: { text: 'Stop Conversation', icon: <StopIcon className="w-6 h-6" />, color: 'bg-red-600 hover:bg-red-700' },
    connecting: { text: 'Connecting...', icon: <LoaderIcon className="w-6 h-6 animate-spin" />, color: 'bg-gray-500' },
    disconnecting: { text: 'Stopping...', icon: <LoaderIcon className="w-6 h-6 animate-spin" />, color: 'bg-gray-500' },
  };

  const { text, icon, color } = buttonConfig[state];

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center justify-center space-x-3 px-8 py-4 rounded-full text-white font-semibold transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${color} ${isLoading ? 'cursor-not-allowed' : ''} ${state === 'connected' ? 'focus:ring-red-400' : 'focus:ring-blue-400'}`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
};
