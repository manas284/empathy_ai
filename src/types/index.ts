
export interface UserProfile {
  age: number;
  genderIdentity: 'Male' | 'Female' | 'Non-Binary';
  ethnicity: string;
  vulnerableScore: number; // 0-10
  anxietyLevel: 'Low' | 'Medium' | 'High';
  breakupType: 'Mutual' | 'Ghosting' | 'Cheating' | 'Demise' | 'Divorce';
  background: string;
  // therapeuticNeeds is removed as AI will identify them
}

export interface PersonalizedTherapyOutput {
  recommendations: string;
  identifiedTherapeuticNeeds: string[];
}

export interface AdaptedLanguageStyle {
  adaptedLanguage: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  detectedSentiment?: string; // Added for sentiment display
}
