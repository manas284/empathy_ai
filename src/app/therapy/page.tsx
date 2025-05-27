
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
      if (audioDataUri) {
        audioElement.src = audioDataUri;
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error playing audio:", error);
            // "AbortError" is common when play is interrupted by another action.
            // Avoid spamming toasts for this specific, often expected, interruption.
            if (error.name === 'AbortError') {
              console.log("Audio playback aborted, likely by a new user action or AI response.");
            } else {
              toast({ variant: "destructive", title: "Audio Playback Error", description: "Could not play the AI's voice." });
            }
          });
        }
      } else {
        // If audioDataUri is null, ensure audio is stopped and reset
        audioElement.pause();
        if (audioElement.src) { // Only act if src was previously set
          audioElement.removeAttribute('src'); // Clear the source
          audioElement.load(); // Reset the media element state
        }
      }
    }
  }, [audioDataUri, toast]);

  const playAiSpeech = async (text: string, voice: VoiceGender) => {
    if (audioRef.current) {
      audioRef.current.pause(); // Explicitly pause current playback
    }
    setAudioDataUri(null); // Trigger useEffect to clean up and reset the audio element

    // Allow the useEffect to process the null audioDataUri state update
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const speechResponse = await generateSpeech({ text, voiceGender: voice });
      setAudioDataUri(speechResponse.audioDataUri); // Trigger useEffect to set new src and play
    } catch (speechError) {
      console.error("Error generating speech:", speechError);
      toast({ variant: "destructive", title: "Speech Generation Error", description: "Could not generate audio for the AI response." });
      // Ensure audioDataUri remains null if speech generation fails (already set above)
    }
  };

  const handleProfileSubmit = async (data: UserProfile) => {
    setIsLoading(true);
    setUserProfile(data);
    // playAiSpeech will handle stopping/clearing previous audio

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
      // Ensure audio is cleared if profile processing fails before playAiSpeech is called or if it fails
      if (audioRef.current) {
          audioRef.current.pause();
      }
      setAudioDataUri(null);
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (messageText: string) => {
    if (!userProfile) return;
    // playAiSpeech will handle stopping/clearing previous audio

    const newUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoadingAiResponse(true);

    try {
      let apiAnxietyLevel: 'Low' | 'High' = 'Low';
      if (userProfile.anxietyLevel === 'Medium') apiAnxietyLevel = 'High'; // Treat Medium as High for API
      else if (userProfile.anxietyLevel === 'High') apiAnxietyLevel = 'High';

      const aiResponse = await generateEmpatheticResponse({
        ...userProfile,
        anxietyLevel: apiAnxietyLevel,
        currentMessage: messageText,
        empathyLevel: empathyLevel,
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
      // Ensure audio is cleared if AI response generation fails
      if (audioRef.current) {
          audioRef.current.pause();
      }
      setAudioDataUri(null);
    }
    setIsLoadingAiResponse(false);
  };
  
  const handleVoiceGenderChange = (gender: VoiceGender) => {
    setCurrentVoiceGender(gender);
    // Stop any currently playing audio and clear it.
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setAudioDataUri(null); // This will trigger the useEffect to reset the audio element
    // If the last AI message should be re-spoken with the new voice,
    // you could add logic here to call playAiSpeech with messages[messages.length-1].text,
    // but for now, just stopping the current audio is fine.
  };

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
               <ChatInterface messages={messages} onSendMessage={handleSendMessage} isLoadingAiResponse={isLoadingAiResponse} />
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
