
'use client';

import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/AppShell';
import { UserInputForm } from '@/components/therapy/UserInputForm';
import { ChatInterface } from '@/components/therapy/ChatInterface';
import { AudioControls, type VoiceGender } from '@/components/therapy/AudioControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, TherapyRecommendation, AdaptedLanguageStyle, ChatMessage } from '@/types';

import { personalizeTherapyRecommendations } from '@/ai/flows/personalize-therapy-recommendations';
import { adaptLanguageAndTechniques } from '@/ai/flows/adapt-language-and-techniques';
import { generateEmpatheticResponse } from '@/ai/flows/generate-empathetic-responses';
import { generateSpeech } from '@/ai/flows/generate-speech-flow';

type TherapyStage = 'initialData' | 'recommendations' | 'chat';
const PLACEHOLDER_RELAXATION_AUDIO_URL = "https://www.soundjay.com/nature/sounds/river-1.mp3"; // Replace with your desired audio

export default function TherapyPage() {
  const [stage, setStage] = useState<TherapyStage>('initialData');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<TherapyRecommendation | null>(null);
  const [adaptedStyle, setAdaptedStyle] = useState<AdaptedLanguageStyle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [empathyLevel, setEmpathyLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false);
  
  // AI Speech Audio
  const [currentVoiceGender, setCurrentVoiceGender] = useState<VoiceGender>('female');
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [isAiAudioPlaying, setIsAiAudioPlaying] = useState(false);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const [currentVolume, setCurrentVolume] = useState(0.5); // Default volume 50%
  const [currentPlaybackSpeed, setCurrentPlaybackSpeed] = useState(1); // Default speed 1x

  // Relaxation Exercise Audio
  const relaxationAudioRef = useRef<HTMLAudioElement>(null);
  const [isRelaxationExercisePlaying, setIsRelaxationExercisePlaying] = useState(false);


  const { toast } = useToast();

  // Effect for AI speech audio element
  useEffect(() => {
    const audioElement = aiAudioRef.current;
    if (audioElement) {
      audioElement.onplay = () => setIsAiAudioPlaying(true);
      audioElement.onended = () => {
        setIsAiAudioPlaying(false);
        setAudioDataUri(null); 
      };
      audioElement.onpause = () => setIsAiAudioPlaying(false); 
      audioElement.onerror = () => {
        setIsAiAudioPlaying(false);
        setAudioDataUri(null);
        toast({ variant: "destructive", title: "Audio Playback Error", description: "Could not play the AI's voice." });
      };

      audioElement.volume = currentVolume;
      audioElement.playbackRate = currentPlaybackSpeed;

      if (audioDataUri) {
        if (audioElement.src !== audioDataUri) {
          audioElement.src = audioDataUri;
        }
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name === 'AbortError') {
              console.log("AI audio playback aborted (expected interruption).");
            } else {
              console.error("Error playing AI audio:", error);
            }
            setIsAiAudioPlaying(false);
          });
        }
      } else {
        if (!audioElement.paused) {
          audioElement.pause();
        }
        if (audioElement.currentSrc && audioElement.currentSrc !== '') {
          audioElement.removeAttribute('src');
          // audioElement.load(); // Not always necessary and can cause issues
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDataUri, currentVolume, currentPlaybackSpeed]);


  // Effect for Relaxation Exercise audio element
  useEffect(() => {
    const audioElement = relaxationAudioRef.current;
    if (audioElement) {
      audioElement.onplay = () => setIsRelaxationExercisePlaying(true);
      audioElement.onended = () => setIsRelaxationExercisePlaying(false);
      audioElement.onpause = () => setIsRelaxationExercisePlaying(false);
      audioElement.onerror = () => {
        setIsRelaxationExercisePlaying(false);
        toast({ variant: "destructive", title: "Audio Playback Error", description: "Could not play the relaxation exercise." });
      };
      audioElement.volume = currentVolume; // Relaxation exercise also uses main volume
    }
  }, [currentVolume]);


  const stopAiSpeech = () => {
    if (aiAudioRef.current && !aiAudioRef.current.paused) {
      aiAudioRef.current.pause();
    }
    setAudioDataUri(null);
    setIsAiAudioPlaying(false);
  };

  const stopRelaxationExercise = () => {
    if (relaxationAudioRef.current && !relaxationAudioRef.current.paused) {
      relaxationAudioRef.current.pause();
    }
    setIsRelaxationExercisePlaying(false);
  };

  const playAiSpeech = async (text: string, voice: VoiceGender) => {
    stopRelaxationExercise(); // Ensure relaxation exercise is stopped
    stopAiSpeech(); // Stop any current AI speech

    await new Promise(resolve => setTimeout(resolve, 50)); // Short delay for cleanup

    try {
      setIsLoadingAiResponse(true);
      const speechResponse = await generateSpeech({ text, voiceGender: voice });
      setAudioDataUri(speechResponse.audioDataUri); // This will trigger useEffect to play
    } catch (speechError) {
      console.error("Error generating speech:", speechError);
      toast({ variant: "destructive", title: "Speech Generation Error", description: "Could not generate audio for the AI response." });
      setAudioDataUri(null);
      setIsAiAudioPlaying(false); 
    } 
    // setIsLoadingAiResponse is handled by the isAiTurnActive logic / useEffect
  };

  const handleProfileSubmit = async (data: UserProfile) => {
    setIsLoading(true);
    setUserProfile(data);
    
    stopAiSpeech();
    stopRelaxationExercise();

    try {
      const [recoResponse, adaptResponse] = await Promise.all([
        personalizeTherapyRecommendations(data),
        adaptLanguageAndTechniques(data),
      ]);
      setRecommendations(recoResponse);
      setAdaptedStyle(adaptResponse);
      
      const initialAiText = `Thank you for sharing. Based on your information, here are some initial thoughts and how we might proceed:\n\n**Recommendations:**\n${recoResponse.recommendations}\n\n**Our Approach:**\n${adaptResponse.adaptedLanguage}\n\nFeel free to share what's on your mind to begin our conversation.`;
      setMessages([{
        id: crypto.randomUUID(),
        sender: 'ai',
        text: initialAiText,
        timestamp: new Date(),
      }]);
      
      await playAiSpeech(initialAiText, currentVoiceGender);

      setStage('chat');
      toast({ title: "Profile processed", description: "Personalized therapy session ready." });
    } catch (error) {
      console.error("Error processing profile:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not process your profile. Please try again." });
      stopAiSpeech();
      setIsAiAudioPlaying(false);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (messageText: string) => {
    if (!userProfile || !messageText.trim()) return;

    const newUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoadingAiResponse(true);
    stopAiSpeech(); 
    stopRelaxationExercise();

    try {
      let apiAnxietyLevel: 'Low' | 'High' = 'Low';
      if (userProfile.anxietyLevel === 'Medium') apiAnxietyLevel = 'High';
      else if (userProfile.anxietyLevel === 'High') apiAnxietyLevel = 'High';

      const lastMessages = messages.slice(-4).map(msg => ({role: msg.sender, text: msg.text}));

      const aiResponse = await generateEmpatheticResponse({
        ...userProfile,
        anxietyLevel: apiAnxietyLevel,
        currentMessage: messageText,
        empathyLevel: empathyLevel,
        chatHistory: lastMessages,
      });

      const newAiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: aiResponse.response,
        detectedSentiment: aiResponse.detectedSentiment,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newAiMessage]);
      setEmpathyLevel(aiResponse.updatedEmpathyLevel);

      await playAiSpeech(aiResponse.response, currentVoiceGender);

    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorAiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: "I'm having a little trouble connecting right now. Please try sending your message again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorAiMessage]);
      toast({ variant: "destructive", title: "Error", description: "Could not get AI response." });
      stopAiSpeech();
      setIsAiAudioPlaying(false);
    }
  };
  
  useEffect(() => {
    if (!isAiAudioPlaying && audioDataUri === null) {
        if(isLoadingAiResponse){
            if(messages.length > 0 && messages[messages.length - 1].sender === 'ai'){
                setIsLoadingAiResponse(false);
            }
            else if (messages.length > 0 && messages[messages.length - 1].sender === 'user') {
                // Keep it true, waiting for AI text and speech
            } else {
                setIsLoadingAiResponse(false);
            }
        }
    }
  }, [isAiAudioPlaying, audioDataUri, messages, isLoadingAiResponse]);


  const handleVoiceGenderChange = (gender: VoiceGender) => {
    setCurrentVoiceGender(gender);
    stopAiSpeech();
  };

  const handleVolumeChange = (volume: number) => {
    setCurrentVolume(volume);
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setCurrentPlaybackSpeed(speed);
  };
  
  const handleToggleRelaxationExercise = () => {
    const audio = relaxationAudioRef.current;
    if (!audio) return;

    if (isRelaxationExercisePlaying) {
      audio.pause();
    } else {
      stopAiSpeech(); // Ensure AI speech is stopped
      if (audio.src !== PLACEHOLDER_RELAXATION_AUDIO_URL) {
        audio.src = PLACEHOLDER_RELAXATION_AUDIO_URL;
        audio.load(); // Ensure the new source is loaded
      }
      audio.play().catch(err => {
        console.error("Error playing relaxation exercise:", err);
        toast({variant: "destructive", title: "Playback Error", description: "Could not play relaxation exercise."});
        setIsRelaxationExercisePlaying(false);
      });
    }
    setIsRelaxationExercisePlaying(!isRelaxationExercisePlaying);
  };
  
  const isAiTurnActive = isLoadingAiResponse || isAiAudioPlaying;

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-primary">AI Therapy Session</h1>
          <p className="text-muted-foreground mt-2">A safe space for you to explore your thoughts and feelings.</p>
        </header>

        {stage === 'initialData' && (
          <UserInputForm onSubmit={handleProfileSubmit} isLoading={isLoading} />
        )}
        
        {isLoading && stage !== 'initialData' && (
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Personalizing your session...</p>
          </div>
        )}

        {stage === 'chat' && userProfile && (
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
               <ChatInterface 
                 messages={messages} 
                 onSendMessage={handleSendMessage} 
                 isLoadingAiResponse={isLoadingAiResponse}
                 isAiSpeaking={isAiTurnActive}
                />
            </div>
            <div className="space-y-6 lg:sticky lg:top-24">
              <AudioControls 
                initialVoice={currentVoiceGender}
                onVoiceChange={handleVoiceGenderChange}
                onVolumeChange={handleVolumeChange}
                onPlaybackSpeedChange={handlePlaybackSpeedChange}
                onToggleRelaxationExercise={handleToggleRelaxationExercise}
                isRelaxationExercisePlaying={isRelaxationExercisePlaying}
                initialVolume={currentVolume * 100}
                initialPlaybackSpeed={currentPlaybackSpeed}
              />
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary"/> Session Context</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p><strong>Your Profile:</strong> Age {userProfile.age}, {userProfile.genderIdentity}, Anxiety: {userProfile.anxietyLevel}.</p>
                  {recommendations && <p><strong>Focus:</strong> {recommendations.recommendations.substring(0,100)}...</p>}
                  {adaptedStyle && <p><strong>Style:</strong> {adaptedStyle.adaptedLanguage.substring(0,100)}...</p>}
                  <p>AI Empathy Level: {empathyLevel}/5</p>
                  {messages.slice(-1)[0]?.sender === 'ai' && messages.slice(-1)[0].detectedSentiment && (
                    <p><strong>AI Detected Sentiment:</strong> {messages.slice(-1)[0].detectedSentiment}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      <audio ref={aiAudioRef} hidden />
      <audio ref={relaxationAudioRef} hidden loop /> {/* Loop relaxation audio if desired */}
    </AppShell>
  );
}
