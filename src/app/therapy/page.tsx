
'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { UserInputForm } from '@/components/therapy/UserInputForm';
import { ChatInterface } from '@/components/therapy/ChatInterface';
import { AudioControls } from '@/components/therapy/AudioControls';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Info, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, TherapyRecommendation, AdaptedLanguageStyle, ChatMessage } from '@/types';

import { personalizeTherapyRecommendations } from '@/ai/flows/personalize-therapy-recommendations';
import { adaptLanguageAndTechniques } from '@/ai/flows/adapt-language-and-techniques';
import { generateEmpatheticResponse } from '@/ai/flows/generate-empathetic-responses';

type TherapyStage = 'initialData' | 'recommendations' | 'chat';

export default function TherapyPage() {
  const [stage, setStage] = useState<TherapyStage>('initialData');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<TherapyRecommendation | null>(null);
  const [adaptedStyle, setAdaptedStyle] = useState<AdaptedLanguageStyle | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [empathyLevel, setEmpathyLevel] = useState(0); // Initial empathy level for AI
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false);

  const { toast } = useToast();

  // Effect to scroll to bottom of chat, can be part of ChatInterface
  // Or managed here if more complex logic is needed for other elements

  const handleProfileSubmit = async (data: UserProfile) => {
    setIsLoading(true);
    setUserProfile(data);
    try {
      const [recoResponse, adaptResponse] = await Promise.all([
        personalizeTherapyRecommendations(data),
        adaptLanguageAndTechniques(data),
      ]);
      setRecommendations(recoResponse);
      setAdaptedStyle(adaptResponse);
      
      setMessages([{
        id: crypto.randomUUID(),
        sender: 'ai',
        text: `Thank you for sharing. Based on your information, here are some initial thoughts and how we might proceed:\n\n**Recommendations:**\n${recoResponse.recommendations}\n\n**Our Approach:**\n${adaptResponse.adaptedLanguage}\n\nFeel free to share what's on your mind to begin our conversation.`,
        timestamp: new Date(),
      }]);
      setStage('chat'); // Directly to chat after showing recommendations in first message
      toast({ title: "Profile processed", description: "Personalized therapy session ready." });
    } catch (error) {
      console.error("Error processing profile:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not process your profile. Please try again." });
    }
    setIsLoading(false);
  };

  const handleSendMessage = async (messageText: string) => {
    if (!userProfile) return;

    const newUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoadingAiResponse(true);

    try {
      // Map UI 'Medium' anxiety to 'High' for this specific AI flow if needed
      // The schema for generateEmpatheticResponse uses 'Low' | 'High'
      let apiAnxietyLevel: 'Low' | 'High' = 'Low';
      if (userProfile.anxietyLevel === 'Medium') apiAnxietyLevel = 'High';
      else if (userProfile.anxietyLevel === 'High') apiAnxietyLevel = 'High';


      const aiResponse = await generateEmpatheticResponse({
        ...userProfile,
        anxietyLevel: apiAnxietyLevel, // Use mapped value
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
    }
    setIsLoadingAiResponse(false);
  };

  const startChatting = () => {
    setStage('chat');
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
              <AudioControls onVoiceChange={(voice) => console.log("Voice changed to:", voice)} />
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
    </AppShell>
  );
}
