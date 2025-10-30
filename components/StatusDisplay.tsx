
import React from 'react';
import type { ConnectionState } from '../types';
import { WifiIcon, WifiOffIcon, AlertTriangleIcon } from './Icons';

interface StatusDisplayProps {
  state: ConnectionState;
  error: string | null;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ state, error }) => {
  const statusConfig = {
    disconnected: { text: 'Disconnected', color: 'text-gray-400', icon: <WifiOffIcon className="w-4 h-4" /> },
    connecting: { text: 'Connecting...', color: 'text-yellow-400', icon: <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" /> },
    connected: { text: 'Connected', color: 'text-green-400', icon: <WifiIcon className="w-4 h-4" /> },
    disconnecting: { text: 'Disconnecting...', color: 'text-yellow-400', icon: <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" /> },
    error: { text: 'Error', color: 'text-red-400', icon: <AlertTriangleIcon className="w-4 h-4" /> },
  };

  const { text, color, icon } = statusConfig[state];

  return (
    <div className="mb-4 text-center">
        <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-dark-surface text-sm ${color}`}>
            {icon}
            <span>{text}</span>
        </div>
        {state === 'error' && error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
    </div>
  );
};
