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
import ElevenLabs from 'elevenlabs';

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voiceGender: z.enum(['male', 'female']).describe('The desired gender of the voice.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe('The generated speech audio as a base64 data URI.'),
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
      throw new Error('ELEVENLABS_API_KEY environment variable is not set.');
    }

    const femaleVoiceId = process.env.ELEVENLABS_FEMALE_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel
    const maleVoiceId = process.env.ELEVENLABS_MALE_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default Adam

    const voiceId = input.voiceGender === 'female' ? femaleVoiceId : maleVoiceId;

    const elevenlabs = new ElevenLabs({ apiKey });

    try {
      const audio = await elevenlabs.generate({
        voice: voiceId,
        text: input.text,
        model_id: 'eleven_multilingual_v2', // Or your preferred model
         voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0, // Adjust as needed, 0.0 means no style emphasis
          use_speaker_boost: true,
        },
      });
      
      // The 'audio' variable is a ReadableStream here. We need to collect it into a Buffer.
      const chunks: Buffer[] = [];
      for await (const chunk of audio) {
        chunks.push(chunk as Buffer); // Type assertion
      }
      const audioBuffer = Buffer.concat(chunks);
      const audioDataUri = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

      return { audioDataUri };

    } catch (error) {
      console.error('Error generating speech with ElevenLabs:', error);
      // Consider how to handle this error more gracefully in the UI
      // For now, re-throwing to let the caller handle it.
      if (error instanceof Error) {
        throw new Error(`ElevenLabs API error: ${error.message}`);
      }
      throw new Error('Unknown error generating speech with ElevenLabs');
    }
  }
);
