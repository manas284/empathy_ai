
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

export default function TherapyPage() {
  const [stage, setStage] = useState<TherapyStage>('initialData');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<TherapyRecommendation | null>(null);
  const [adaptedStyle, setAdaptedStyle] = useState<AdaptedLanguageStyle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [empathyLevel, setEmpathyLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false);
  const [currentVoiceGender, setCurrentVoiceGender] = useState<VoiceGender>('female');
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
  const [isAiAudioPlaying, setIsAiAudioPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      audioElement.onplay = () => setIsAiAudioPlaying(true);
      audioElement.onended = () => {
        setIsAiAudioPlaying(false);
        setAudioDataUri(null); // Clear URI after playing
      };
      audioElement.onpause = () => setIsAiAudioPlaying(false); // Could be paused by user or system
      audioElement.onerror = () => {
        setIsAiAudioPlaying(false);
        setAudioDataUri(null);
        toast({ variant: "destructive", title: "Audio Playback Error", description: "Could not play the AI's voice." });
      };


      if (audioDataUri) {
        audioElement.src = audioDataUri;
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name === 'AbortError') {
              console.log("Audio playback aborted (expected interruption).");
            } else {
              console.error("Error playing audio:", error);
              // Toast is handled by onerror now
            }
            setIsAiAudioPlaying(false);
          });
        }
      } else {
        audioElement.pause();
        if (audioElement.currentSrc && audioElement.currentSrc !== '') {
          audioElement.removeAttribute('src');
          audioElement.load();
        }
        setIsAiAudioPlaying(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDataUri]); // Removed toast from dependencies as it's stable

  const playAiSpeech = async (text: string, voice: VoiceGender) => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    setAudioDataUri(null); // Explicitly clear old audio URI to trigger cleanup and stop current playback

    // A small delay to ensure the audio element has time to process the pause/reset
    // This can sometimes help with race conditions in audio playback.
    await new Promise(resolve => setTimeout(resolve, 50));


    try {
      setIsLoadingAiResponse(true); // Indicate AI is "active"
      const speechResponse = await generateSpeech({ text, voiceGender: voice });
      setAudioDataUri(speechResponse.audioDataUri); // This will trigger useEffect to play
    } catch (speechError) {
      console.error("Error generating speech:", speechError);
      toast({ variant: "destructive", title: "Speech Generation Error", description: "Could not generate audio for the AI response." });
      setAudioDataUri(null);
      setIsAiAudioPlaying(false); // Ensure this is reset
    } finally {
       // setIsLoadingAiResponse(false); // Loading AI response is done once TTS is fetched/playing starts or fails
       // isAiAudioPlaying will handle the "speaking" state
    }
  };

  const handleProfileSubmit = async (data: UserProfile) => {
    setIsLoading(true);
    setUserProfile(data);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioDataUri(null);

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
      // setIsLoadingAiResponse will be set to false by playAiSpeech or its effects

      setStage('chat');
      toast({ title: "Profile processed", description: "Personalized therapy session ready." });
    } catch (error) {
      console.error("Error processing profile:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not process your profile. Please try again." });
      if (audioRef.current) {
          audioRef.current.pause();
      }
      setAudioDataUri(null);
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
    setAudioDataUri(null); // Stop any current AI speech

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
      if (audioRef.current) {
          audioRef.current.pause();
      }
      setAudioDataUri(null);
      setIsAiAudioPlaying(false);
    }
    // setIsLoadingAiResponse(false); // Set to false when speech starts playing or generation fails in playAiSpeech
  };
  
  // This effect now ensures setIsLoadingAiResponse is false when AI is not actively fetching/playing.
  useEffect(() => {
    if (!isAiAudioPlaying && audioDataUri === null) {
        // If audio is not playing and there's no audio URI pending,
        // and an AI response was previously loading (for speech gen), set it to false.
        // This ensures loading spinner stops if speech gen fails or after it plays.
        if(isLoadingAiResponse && !isAiAudioPlaying && audioDataUri === null){
             // Check if the last message was from AI, if so, we are likely done.
            if(messages.length > 0 && messages[messages.length - 1].sender === 'ai'){
                setIsLoadingAiResponse(false);
            }
            // If user just sent a message, keep it true until AI responds.
            else if (messages.length > 0 && messages[messages.length - 1].sender === 'user') {
                // Keep it true, waiting for AI text and speech
            } else {
                // Default case, no messages or initial state.
                setIsLoadingAiResponse(false);
            }
        }
    }
  }, [isAiAudioPlaying, audioDataUri, messages, isLoadingAiResponse]);


  const handleVoiceGenderChange = (gender: VoiceGender) => {
    setCurrentVoiceGender(gender);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioDataUri(null);
    setIsAiAudioPlaying(false);
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
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      <audio ref={audioRef} hidden />
    </AppShell>
  );
}
