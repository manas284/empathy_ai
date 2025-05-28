
'use client';

import { useState, useEffect, useRef } from 'react';
import { AppShell } from '@/components/AppShell';
import { UserInputForm } from '@/components/therapy/UserInputForm';
import { ChatInterface } from '@/components/therapy/ChatInterface';
import { AudioControls, type VoiceGender } from '@/components/therapy/AudioControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Info, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, PersonalizedTherapyOutput, AdaptedLanguageStyle, ChatMessage } from '@/types';

import { personalizeTherapyRecommendations } from '@/ai/flows/personalize-therapy-recommendations';
import { adaptLanguageAndTechniques } from '@/ai/flows/adapt-language-and-techniques';
import { generateEmpatheticResponse } from '@/ai/flows/generate-empathetic-responses';
import { generateSpeech } from '@/ai/flows/generate-speech-flow';

type TherapyStage = 'initialData' | 'recommendations' | 'chat';
const PLACEHOLDER_RELAXATION_AUDIO_URL = "https://www.soundjay.com/nature/sounds/river-1.mp3"; 

export default function TherapyPage() {
  const [stage, setStage] = useState<TherapyStage>('initialData');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // recommendations state will now hold the full PersonalizedTherapyOutput
  const [personalizedSessionInfo, setPersonalizedSessionInfo] = useState<PersonalizedTherapyOutput | null>(null);
  const [identifiedNeeds, setIdentifiedNeeds] = useState<string[]>([]);
  const [adaptedStyle, setAdaptedStyle] = useState<AdaptedLanguageStyle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [empathyLevel, setEmpathyLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiTurnActive, setIsAiTurnActive] = useState(false); // Combines isLoadingAiResponse and isAiAudioPlaying
  
  // AI Speech Audio
  const [currentVoiceGender, setCurrentVoiceGender] = useState<VoiceGender>('female');
  const [audioDataUri, setAudioDataUri] = useState<string | null>(null);
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
      audioElement.onplay = () => setIsAiTurnActive(true); // AI is active when speaking
      audioElement.onended = () => {
        setAudioDataUri(null); 
        setIsAiTurnActive(false); // AI is no longer active
      };
      audioElement.onpause = () => {
        // Only set AiTurnActive to false if it wasn't paused by a new load or stopAiSpeech
        if (audioDataUri === null && !audioElement.seeking) {
          setIsAiTurnActive(false);
        }
      };
      audioElement.onerror = () => {
        setAudioDataUri(null);
        setIsAiTurnActive(false);
        toast({ variant: "destructive", title: "Audio Playback Error", description: "Could not play the AI's voice." });
      };

      audioElement.volume = currentVolume;
      audioElement.playbackRate = currentPlaybackSpeed;

      if (audioDataUri && audioElement.src !== audioDataUri) {
        audioElement.src = audioDataUri;
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name === 'AbortError') {
              console.log("AI audio playback aborted (expected interruption).");
            } else {
              console.error("Error playing AI audio:", error);
            }
            setIsAiTurnActive(false);
          });
        }
      } else if (!audioDataUri && !audioElement.paused) {
        audioElement.pause();
        if (audioElement.currentSrc && audioElement.currentSrc !== '') {
          audioElement.removeAttribute('src');
          audioElement.load(); 
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
      audioElement.volume = currentVolume; 
    }
  }, [currentVolume]);

  const stopAiSpeech = () => {
    if (aiAudioRef.current && !aiAudioRef.current.paused) {
      aiAudioRef.current.pause();
    }
    setAudioDataUri(null); // This will trigger the useEffect to clean up
    // setIsAiTurnActive(false); // This will be handled by onended/onpause/onerror
  };

  const stopRelaxationExercise = () => {
    if (relaxationAudioRef.current && !relaxationAudioRef.current.paused) {
      relaxationAudioRef.current.pause();
    }
    // isRelaxationExercisePlaying state will be set by the onpause handler
  };

  const playAiSpeech = async (text: string, voice: VoiceGender) => {
    stopRelaxationExercise(); 
    stopAiSpeech(); 

    setIsAiTurnActive(true); // Indicate AI is active while fetching/preparing speech

    await new Promise(resolve => setTimeout(resolve, 100)); // Short delay for audio element cleanup

    try {
      const speechResponse = await generateSpeech({ text, voiceGender: voice });
      setAudioDataUri(speechResponse.audioDataUri); // This will trigger useEffect to play
      // setIsAiTurnActive will be true from onplay, and false from onended/onerror
    } catch (speechError) {
      console.error("Error generating speech:", speechError);
      toast({ variant: "destructive", title: "Speech Generation Error", description: "Could not generate audio for the AI response." });
      setAudioDataUri(null);
      setIsAiTurnActive(false); 
    } 
  };

  const handleProfileSubmit = async (data: UserProfile) => {
    setIsLoading(true);
    setIsAiTurnActive(true); // AI is active during processing
    setUserProfile(data); // UserProfile no longer contains therapeuticNeeds
    
    stopAiSpeech();
    stopRelaxationExercise();

    try {
      // AdaptLanguageAndTechniquesInput now uses 'additionalContext' for background
      const adaptInput = { ...data, additionalContext: data.background };

      const [recoOutput, adaptResponse] = await Promise.all([
        personalizeTherapyRecommendations(data), // data is UserProfile without therapeuticNeeds
        adaptLanguageAndTechniques(adaptInput),
      ]);

      setPersonalizedSessionInfo(recoOutput);
      setIdentifiedNeeds(recoOutput.identifiedTherapeuticNeeds);
      setAdaptedStyle(adaptResponse);
      
      const needsText = recoOutput.identifiedTherapeuticNeeds.length > 0 
        ? `Based on your information, I've identified that focusing on areas such as ${recoOutput.identifiedTherapeuticNeeds.join(', ')} could be beneficial.`
        : "Thank you for sharing. I'm reviewing your information to best support you.";

      const initialAiText = `Thank you for sharing. ${needsText}\n\nHere are some initial thoughts on how we might proceed:\n${recoOutput.recommendations}\n\nOur approach will be as follows: ${adaptResponse.adaptedLanguage}\n\nFeel free to share what's on your mind to begin our conversation.`;
      
      setMessages([{
        id: crypto.randomUUID(),
        sender: 'ai',
        text: initialAiText,
        timestamp: new Date(),
      }]);
      
      await playAiSpeech(initialAiText, currentVoiceGender);
      // setIsAiTurnActive is managed by playAiSpeech and audio element events

      setStage('chat');
      toast({ title: "Profile processed", description: "Personalized therapy session ready." });
    } catch (error) {
      console.error("Error processing profile:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not process your profile. Please try again." });
      stopAiSpeech();
      setIsAiTurnActive(false);
    }
    setIsLoading(false);
    // If playAiSpeech started and audio is playing, isAiTurnActive will remain true until audio ends
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
    setIsAiTurnActive(true); // AI becomes active to process and respond
    stopAiSpeech(); 
    stopRelaxationExercise();

    try {
      let apiAnxietyLevel: 'Low' | 'High' = 'Low';
      if (userProfile.anxietyLevel === 'Medium' || userProfile.anxietyLevel === 'High') {
        apiAnxietyLevel = 'High';
      }
      
      // Pass relevant parts of userProfile, background might be useful
      const empatheticResponseInput = {
        age: userProfile.age,
        genderIdentity: userProfile.genderIdentity,
        ethnicity: userProfile.ethnicity,
        vulnerableScore: userProfile.vulnerableScore,
        anxietyLevel: apiAnxietyLevel,
        breakupType: userProfile.breakupType,
        background: userProfile.background, // Pass background for context
        currentMessage: messageText,
        empathyLevel: empathyLevel,
        chatHistory: messages.slice(-4).map(msg => ({role: msg.sender as 'user' | 'ai', text: msg.text})), // Ensure role matches schema
      };

      const aiResponse = await generateEmpatheticResponse(empatheticResponseInput);

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
      // setIsAiTurnActive is managed by playAiSpeech and audio element events

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
      setIsAiTurnActive(false);
    }
    // If playAiSpeech started and audio is playing, isAiTurnActive will remain true until audio ends
  };
  
  // This effect manages isLoadingAiResponse based on isAiTurnActive and message state
  // useEffect(() => {
  //   if (isAiTurnActive) {
  //     // If AI is active (speaking or processing), isLoadingAiResponse should generally be true
  //     // unless it's only speaking and the text is already there.
  //     // This logic might need refinement based on exact UX for "typing..." indicator.
  //     const lastMessageIsAi = messages.length > 0 && messages[messages.length - 1].sender === 'ai';
  //     const audioIsPlaying = aiAudioRef.current && !aiAudioRef.current.paused;
      
  //     if (!lastMessageIsAi && !audioIsPlaying) { // AI is processing, not yet responded with text
  //        // setIsLoadingAiResponse(true); // This seems to be covered by isAiTurnActive
  //     } else {
  //        // setIsLoadingAiResponse(false);
  //     }
  //   } else {
  //     // setIsLoadingAiResponse(false);
  //   }
  // }, [isAiTurnActive, messages]);


  const handleVoiceGenderChange = (gender: VoiceGender) => {
    setCurrentVoiceGender(gender);
    stopAiSpeech(); // Stop current speech if voice changes
  };

  const handleVolumeChange = (volume: number) => {
    setCurrentVolume(volume);
    // Apply to both audio elements if they exist
    if (aiAudioRef.current) aiAudioRef.current.volume = volume;
    if (relaxationAudioRef.current) relaxationAudioRef.current.volume = volume;
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setCurrentPlaybackSpeed(speed);
    if (aiAudioRef.current) aiAudioRef.current.playbackRate = speed;
  };
  
  const handleToggleRelaxationExercise = () => {
    const audio = relaxationAudioRef.current;
    if (!audio) return;

    if (isRelaxationExercisePlaying) {
      audio.pause(); // onpause will set isRelaxationExercisePlaying to false
    } else {
      stopAiSpeech(); // Ensure AI speech is stopped
      if (audio.src !== PLACEHOLDER_RELAXATION_AUDIO_URL) {
        audio.src = PLACEHOLDER_RELAXATION_AUDIO_URL;
        audio.load(); 
      }
      audio.play().catch(err => {
        console.error("Error playing relaxation exercise:", err);
        toast({variant: "destructive", title: "Playback Error", description: "Could not play relaxation exercise."});
        setIsRelaxationExercisePlaying(false);
      });
      // onplay will set isRelaxationExercisePlaying to true
    }
    // State is managed by audio element events
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
        
        {isLoading && stage !== 'initialData' && ( // This covers initial processing
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
                 isLoadingAiResponse={isAiTurnActive && messages[messages.length-1]?.sender === 'user'} // Show "typing" if AI is active and last msg was user
                 isAiSpeaking={isAiTurnActive} // Used to disable mic button
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
                  {identifiedNeeds.length > 0 && (
                    <p className="flex items-start gap-1">
                      <Sparkles className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                      <strong>AI Identified Focus:</strong> {identifiedNeeds.join(', ')}
                    </p>
                  )}
                  {personalizedSessionInfo && <p><strong>Recommendations:</strong> {personalizedSessionInfo.recommendations.substring(0,70)}...</p>}
                  {adaptedStyle && <p><strong>Style:</strong> {adaptedStyle.adaptedLanguage.substring(0,70)}...</p>}
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
      <audio ref={relaxationAudioRef} hidden loop />
    </AppShell>
  );
}
