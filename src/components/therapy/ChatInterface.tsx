
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, User, Bot, Mic, MicOff } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string) => Promise<void>;
  isLoadingAiResponse: boolean;
  isAiSpeaking: boolean; // New prop
}

export function ChatInterface({ messages, onSendMessage, isLoadingAiResponse, isAiSpeaking }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Audio visualizer refs and state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const visualizerAnimationRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);


  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // Event handlers will set isListening to false via onend
    }
    if (visualizerAnimationRef.current) {
      cancelAnimationFrame(visualizerAnimationRef.current);
      visualizerAnimationRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
    }
    // Don't close audioContext here, can be reused. Could be closed on unmount.
    setIsListening(false); // Explicitly set here as well
  }, []);


  const handleSpeechResult = useCallback((event: SpeechRecognitionEvent) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript.trim()) {
      onSendMessage(finalTranscript.trim());
      setInputValue(''); // Clear input after auto-sending
      // stopListening(); // SpeechRecognition stops itself after a final result usually, onend will fire.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSendMessage]); // Removed stopListening as it's in useCallback's scope

  const setupVisualizer = async () => {
    if (!isListening || !canvasRef.current) return;

    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        sourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
        sourceRef.current.connect(analyserRef.current);
        
        drawVisualizer();

    } catch (err) {
        console.error("Error setting up visualizer or getting media stream:", err);
        toast({ variant: "destructive", title: "Visualizer Error", description: "Could not access microphone for visualizer."});
        stopListening(); // Stop everything if visualizer setup fails
    }
  };

  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current || !audioContextRef.current) {
      return;
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    visualizerAnimationRef.current = requestAnimationFrame(drawVisualizer);
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const barWidth = (WIDTH / dataArrayRef.current.length) * 2.5;
    let x = 0;
    for (let i = 0; i < dataArrayRef.current.length; i++) {
      const barHeight = dataArrayRef.current[i] / 2;
      ctx.fillStyle = 'rgb(100,150,250)'; // Primary color variant
      ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  };


  const startListening = useCallback(() => {
    if (isListening || isAiSpeaking) return;

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: "destructive", title: "Speech Recognition Not Supported", description: "Your browser does not support speech recognition." });
      return;
    }

    if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false; // Stop after first pause
    recognition.interimResults = true; // Show interim results in input if desired (currently not)
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setupVisualizer();
    };

    recognition.onresult = handleSpeechResult;

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error); // Log for debugging
      let errorMessage = "An unknown speech error occurred.";
      if (event.error === 'no-speech') {
        errorMessage = "No speech was detected. Please try again.";
      } else if (event.error === 'audio-capture') {
        errorMessage = "Audio capture failed. Ensure microphone is connected and permission is granted.";
      } else if (event.error === 'not-allowed') {
        errorMessage = "Microphone access denied. Please allow microphone access in browser settings.";
      } else if (event.error === 'network') {
        errorMessage = "Network error during speech recognition. Please check your connection.";
      }
      toast({ variant: "destructive", title: "Speech Error", description: errorMessage });
      // onend will handle state cleanup
    };

    recognition.onend = () => {
      // This is the primary place to clean up and reset listening state
      stopListening(); // Ensures visualizer and stream are also stopped
    };
    
    recognition.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, isAiSpeaking, toast, handleSpeechResult, stopListening]); // Added stopListening and setupVisualizer dependencies


  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoadingAiResponse) {
      await onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopListening();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed stopListening from here, it's stable

  return (
    <div className={cn("flex flex-col border rounded-lg shadow-lg bg-card", isListening ? "h-[650px]" : "h-[600px]")}>
      {isListening && (
        <div className="p-2 border-b">
          <canvas ref={canvasRef} width="300" height="50" className="w-full h-[50px] rounded"></canvas>
        </div>
      )}
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end space-x-2',
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.sender === 'ai' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback><Bot size={18}/></AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-xs lg:max-w-md p-3 rounded-lg shadow',
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-muted text-muted-foreground rounded-bl-none'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                <p className="text-xs text-right mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.sender === 'user' && (
                <Avatar className="h-8 w-8">
                   <AvatarFallback><User size={18}/></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoadingAiResponse && !isAiSpeaking && ( // Show typing indicator only if AI is not already speaking
            <div className="flex items-end space-x-2 justify-start">
              <Avatar className="h-8 w-8">
                <AvatarFallback><Bot size={18}/></AvatarFallback>
              </Avatar>
              <div className="max-w-xs lg:max-w-md p-3 rounded-lg shadow bg-muted text-muted-foreground rounded-bl-none">
                <p className="text-sm italic">EmpathyAI is typing...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="border-t p-4 flex items-center space-x-2 bg-background">
        <Button 
          type="button" 
          size="icon" 
          variant={isListening ? "destructive" : "outline"}
          onClick={handleMicClick}
          disabled={isAiSpeaking || isLoadingAiResponse} // Disable if AI is speaking/loading OR if already listening and AI starts speaking
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Input
          type="text"
          placeholder={isListening ? "Listening..." : "Type your message or use mic..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-grow"
          disabled={isLoadingAiResponse || isListening || isAiSpeaking}
          aria-label="Chat message input"
        />
        <Button type="submit" size="icon" disabled={isLoadingAiResponse || !inputValue.trim() || isAiSpeaking} aria-label="Send message">
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
