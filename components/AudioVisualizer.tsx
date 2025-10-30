
import React from 'react';

interface AudioVisualizerProps {
  isAnimating: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isAnimating }) => {
  if (!isAnimating) {
    return <div className="h-12 w-12"></div>;
  }

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <div className="absolute w-full h-full bg-blue-500 rounded-full animate-ping opacity-50"></div>
      <div className="absolute w-2/3 h-2/3 bg-blue-500 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.2s' }}></div>
      <div className="relative w-1/2 h-1/2 bg-blue-400 rounded-full"></div>
    </div>
  );
};
