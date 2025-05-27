
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
import * as ElevenLabsPackage from 'elevenlabs';

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
      console.error('ELEVENLABS_API_KEY environment variable is not set.');
      throw new Error('ELEVENLABS_API_KEY environment variable is not set.');
    }

    const femaleVoiceId = process.env.ELEVENLABS_FEMALE_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel
    const maleVoiceId = process.env.ELEVENLABS_MALE_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default Adam

    const voiceId = input.voiceGender === 'female' ? femaleVoiceId : maleVoiceId;

    const ElevenLabsConstructor = ElevenLabsPackage.default;

    if (typeof ElevenLabsConstructor !== 'function') {
      console.error(
        'Failed to import ElevenLabs constructor. ElevenLabsPackage.default is not a function:', 
        ElevenLabsConstructor
      );
      if (ElevenLabsPackage) {
        console.error('Keys of ElevenLabsPackage:', Object.keys(ElevenLabsPackage));
      }
      throw new Error('ElevenLabs constructor is not a function. Check import or library version.');
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
      
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk as Buffer);
      }
      const audioBuffer = Buffer.concat(chunks);
      const audioDataUri = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

      return { audioDataUri };

    } catch (error) {
      console.error('Error generating speech with ElevenLabs:', error);
      if (error instanceof Error) {
        // It's good practice to check if the error has a 'message' property
        const errorMessage = (error as any).message || 'Unknown ElevenLabs API error';
        throw new Error(`ElevenLabs API error: ${errorMessage}`);
      }
      throw new Error('Unknown error generating speech with ElevenLabs');
    }
  }
);
