
import React, { useState, useRef, useCallback, useEffect } from 'react';
// Fix: The Blob type from '@google/genai' was conflicting with the native Blob type.
// Aliased the imported Blob to GenAIBlob to resolve the type errors.
import { GoogleGenAI, Modality, LiveServerMessage, Blob as GenAIBlob } from '@google/genai';
import { ConversationTurn } from './components/ConversationTurn';
import { StatusDisplay } from './components/StatusDisplay';
import { ControlButton } from './components/ControlButton';
import { AudioVisualizer } from './components/AudioVisualizer';
import { decode, encode, encodeWAV, decodeAudioData } from './utils/audioUtils';
import type { Turn, ConnectionState } from './types';
import { BotIcon, UserIcon } from './components/Icons';

// The LiveSession type is not exported from the SDK, so we define a local interface
// based on the methods we use from the session object returned by ai.live.connect.
interface LiveSession {
  close: () => void;
  sendRealtimeInput: (input: { media: GenAIBlob }) => void;
}

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [transcriptionHistory, setTranscriptionHistory] = useState<Turn[]>([]);
  const [currentUserTranscription, setCurrentUserTranscription] = useState('');
  const [currentModelTranscription, setCurrentModelTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null); // For microphone input
  const outputAudioContextRef = useRef<AudioContext | null>(null); // For speaker output
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const userAudioChunksRef = useRef<Float32Array[]>([]);
  const modelAudioChunksRef = useRef<Float32Array[]>([]);
  const currentUserTranscriptionRef = useRef('');
  const currentModelTranscriptionRef = useRef('');

  const cleanup = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;
    
    audioContextRef.current?.close().catch(console.error);
    audioContextRef.current = null;

    outputAudioContextRef.current?.close().catch(console.error);
    outputAudioContextRef.current = null;

    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    
    sessionRef.current = null;
    setCurrentUserTranscription('');
    setCurrentModelTranscription('');
  }, []);


  const handleToggleConversation = useCallback(async () => {
    if (connectionState === 'connected' || connectionState === 'connecting') {
      setConnectionState('disconnecting');
      
      if (sessionRef.current) {
        try {
            const session = await sessionRef.current;
            session.close();
        } catch (e) {
            console.error("Error closing session:", e);
        }
      }
      cleanup();
      setConnectionState('disconnected');
      return;
    }

    setConnectionState('connecting');
    setError(null);
    // Clear refs for the new session
    userAudioChunksRef.current = [];
    modelAudioChunksRef.current = [];
    currentUserTranscriptionRef.current = '';
    currentModelTranscriptionRef.current = '';
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // FIX: Resolve TypeScript error for vendor-prefixed `webkitAudioContext` by creating a compatible AudioContext constructor.
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;

      const inputAudioContext = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = inputAudioContext;
      
      const outputAudioContext = new AudioCtx({ sampleRate: 24000 });
      outputAudioContextRef.current = outputAudioContext;

      const source = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob: GenAIBlob = {
          data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
          mimeType: 'audio/pcm;rate=16000',
        };
        userAudioChunksRef.current.push(new Float32Array(inputData));

        if (sessionRef.current) {
            sessionRef.current.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        }
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);

      sessionRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentUserTranscriptionRef.current += message.serverContent.inputTranscription.text;
              setCurrentUserTranscription(currentUserTranscriptionRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              currentModelTranscriptionRef.current += message.serverContent.outputTranscription.text;
              setCurrentModelTranscription(currentModelTranscriptionRef.current);
            }

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
                const audioBytes = decode(base64EncodedAudioString);
                modelAudioChunksRef.current.push(new Float32Array(new Int16Array(audioBytes.buffer).map(x => x / 32768.0)));
                const audioBuffer = await decodeAudioData(audioBytes, outputAudioContextRef.current, 24000, 1);
                const sourceNode = outputAudioContextRef.current.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.connect(outputAudioContextRef.current.destination);
                
                sourceNode.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(sourceNode);
                });

                const currentTime = outputAudioContextRef.current.currentTime;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
                sourceNode.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(sourceNode);
            }

            if(message.serverContent?.interrupted) {
                audioSourcesRef.current.forEach(source => source.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.turnComplete) {
                const finalUserTranscription = currentUserTranscriptionRef.current;
                const finalModelTranscription = currentModelTranscriptionRef.current;
                
                // Concatenate and create audio blobs
                const userAudio = userAudioChunksRef.current.length > 0
                  ? encodeWAV(
                      userAudioChunksRef.current.reduce((acc, val) => {
                          const newAcc = new Float32Array(acc.length + val.length);
                          newAcc.set(acc);
                          newAcc.set(val, acc.length);
                          return newAcc;
                      }, new Float32Array(0)), 16000)
                  : null;
                
                const modelAudio = modelAudioChunksRef.current.length > 0
                ? encodeWAV(
                    modelAudioChunksRef.current.reduce((acc, val) => {
                        const newAcc = new Float32Array(acc.length + val.length);
                        newAcc.set(acc);
                        newAcc.set(val, acc.length);
                        return newAcc;
                    }, new Float32Array(0)), 24000)
                : null;
                
                if (finalUserTranscription || finalModelTranscription) {
                    setTranscriptionHistory(prev => [
                        ...prev, 
                        { 
                            user: finalUserTranscription, 
                            model: finalModelTranscription,
                            userAudio: userAudio,
                            modelAudio: modelAudio,
                        }
                    ]);
                }

                // Reset for the next turn
                setCurrentUserTranscription('');
                setCurrentModelTranscription('');
                currentUserTranscriptionRef.current = '';
                currentModelTranscriptionRef.current = '';
                userAudioChunksRef.current = [];
                modelAudioChunksRef.current = [];
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Session error:", e);
            setError(`An error occurred: ${e.message}`);
            setConnectionState('error');
            cleanup();
          },
          onclose: (e: CloseEvent) => {
            console.log("Session closed");
            cleanup();
            setConnectionState('disconnected');
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
      });
    } catch (err) {
      console.error("Failed to start conversation:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to start: ${errorMessage}`);
      setConnectionState('error');
      cleanup();
    }
  }, [connectionState, cleanup]);

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.then(s => s.close()).catch(console.error);
      }
      cleanup();
    };
  }, [cleanup]);

  const CurrentTranscriptionDisplay: React.FC = () => {
    if (connectionState !== 'connected') return null;
    if (!currentUserTranscription && !currentModelTranscription) return null;
  
    return (
      <div className="mt-4 space-y-4">
        {currentUserTranscription && (
          <div className="flex items-start space-x-4 animate-pulse">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-blue-300" />
            </div>
            <div className="flex-grow bg-dark-surface p-4 rounded-lg rounded-tl-none">
              <p className="text-dark-text-secondary italic">{currentUserTranscription}</p>
            </div>
            <div className="w-10"></div>
          </div>
        )}
        {currentModelTranscription && (
          <div className="flex items-start space-x-4 animate-pulse">
             <div className="w-10"></div>
            <div className="flex-grow bg-dark-surface p-4 rounded-lg rounded-tr-none text-right">
              <p className="text-dark-text-secondary italic">{currentModelTranscription}</p>
            </div>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <BotIcon className="w-5 h-5 text-purple-300" />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      <header className="p-4 border-b border-dark-surface sticky top-0 bg-dark-bg/80 backdrop-blur-sm z-10">
        <h1 className="text-xl font-semibold text-center text-dark-text-primary">Gemini Live Audio Conversation</h1>
      </header>
      
      <main className="flex-grow p-4 md:p-6 lg:p-8 flex flex-col max-w-3xl mx-auto w-full">
        <StatusDisplay state={connectionState} error={error} />

        <div id="conversation-log" className="flex-grow space-y-6 overflow-y-auto pr-2">
            {transcriptionHistory.map((turn, index) => (
                <ConversationTurn key={index} turn={turn} />
            ))}
            <CurrentTranscriptionDisplay />
        </div>

        <footer className="pt-4 mt-auto flex flex-col items-center space-y-4 sticky bottom-0 bg-dark-bg/80 backdrop-blur-sm">
            <AudioVisualizer isAnimating={connectionState === 'connected'} />
            <ControlButton state={connectionState} onClick={handleToggleConversation} />
            <p className="text-xs text-dark-text-secondary text-center">
              Start the conversation and speak into your microphone. <br/>
              Audio will be transcribed in real-time.
            </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
