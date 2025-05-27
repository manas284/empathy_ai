
'use server';
/**
 * @fileOverview Generates speech from text using ElevenLabs API.
 *
 * - generateSpeech - A function that handles text-to-speech conversion.
 * - GenerateSpeechInput - The input type for the generateSpeech function.
 * - GenerateSpeechOutput - The return type for the generateSpeech function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import * as ElevenLabsNodeModule from 'elevenlabs-node';

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voiceGender: z.enum(['male', 'female']).describe('The desired gender of the voice.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe('The generated speech audio as a base64 data URI (e.g., data:audio/mpeg;base64,...).'),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;

export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  return generateSpeechFlow(input);
}

const generateSpeechFlow = ai.defineFlow(
  {
    name: 'generateSpeechFlow',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      const errorMsg = 'ELEVENLABS_API_KEY environment variable is not set. Please ensure it is correctly defined in your .env file.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const femaleVoiceId = process.env.ELEVENLABS_FEMALE_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel
    const maleVoiceId = process.env.ELEVENLABS_MALE_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default Adam

    const voiceId = input.voiceGender === 'female' ? femaleVoiceId : maleVoiceId;
    
    // Attempt to get the constructor, trying common CJS export patterns
    const ElevenLabsConstructor = ElevenLabsNodeModule.default || (ElevenLabsNodeModule as any).ElevenLabs || ElevenLabsNodeModule;

    if (typeof ElevenLabsConstructor !== 'function') {
      console.error('ElevenLabs constructor resolution failed. Module keys:', Object.keys(ElevenLabsNodeModule));
      throw new Error('Could not initialize ElevenLabs client: Constructor not found in elevenlabs-node package.');
    }

    const elevenlabs = new ElevenLabsConstructor({ apiKey });

    try {
      const audioStream = await elevenlabs.generate({
        voice: voiceId,
        text: input.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0, 
          use_speaker_boost: true,
        },
        output_format: 'mp3_44100_128' // Ensuring a common output format
      });
      
      const chunks: Uint8Array[] = [];
      for await (const chunk of audioStream) {
        chunks.push(new Uint8Array(chunk));
      }
      const audioBuffer = Buffer.from(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
      const audioDataUri = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

      return { audioDataUri };

    } catch (error) {
      console.error('Error generating speech with ElevenLabs:', error);
      if (error instanceof Error) {
        let errorMessage = (error as any).message || 'Unknown ElevenLabs API error';
        if (errorMessage.includes('Status code: 401')) {
          errorMessage = `ElevenLabs API Authorization (401) Error: ${errorMessage}. Please double-check your ELEVENLABS_API_KEY in the .env file. Ensure it is correct and has the necessary permissions.`;
        } else {
          errorMessage = `ElevenLabs API error: ${errorMessage}`;
        }
        throw new Error(errorMessage);
      }
      throw new Error('Unknown error generating speech with ElevenLabs');
    }
  }
);
