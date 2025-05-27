'use server';
/**
 * @fileOverview Adapts language (British English with medical terms) and therapeutic techniques based on user input.
 *
 * - adaptLanguageAndTechniques - A function that handles the adaptation of language and techniques.
 * - AdaptLanguageAndTechniquesInput - The input type for the adaptLanguageAndTechniques function.
 * - AdaptLanguageAndTechniquesOutput - The return type for the adaptLanguageAndTechniques function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdaptLanguageAndTechniquesInputSchema = z.object({
  age: z.number().describe('The age of the user.'),
  genderIdentity: z
    .string()
    .describe('The gender identity of the user (Male/Female/Non-Binary).'),
  ethnicity: z.string().describe('The ethnicity of the user.'),
  vulnerableScore: z
    .number()
    .min(0)
    .max(10)
    .describe('The vulnerability score of the user (0-10).'),
  anxietyLevel: z.enum(['Low', 'Medium', 'High']).describe('The anxiety level of the user.'),
  breakupType: z
    .enum(['Mutual', 'Ghosting', 'Cheating', 'Demise', 'Divorce'])
    .describe('The type of breakup the user experienced.'),
  therapeuticNeeds:
    z.array(z.enum(['CBT', 'IPT', 'Grief Counseling'])).describe('The therapeutic needs of the user (CBT, IPT, Grief Counseling).'),
  additionalContext: z.string().optional().describe('Any additional context about the user.'),
});
export type AdaptLanguageAndTechniquesInput = z.infer<typeof AdaptLanguageAndTechniquesInputSchema>;

const AdaptLanguageAndTechniquesOutputSchema = z.object({
  adaptedLanguage: z.string().describe('The adapted language and therapeutic techniques for the user.'),
});
export type AdaptLanguageAndTechniquesOutput = z.infer<typeof AdaptLanguageAndTechniquesOutputSchema>;

export async function adaptLanguageAndTechniques(
  input: AdaptLanguageAndTechniquesInput
): Promise<AdaptLanguageAndTechniquesOutput> {
  return adaptLanguageAndTechniquesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adaptLanguageAndTechniquesPrompt',
  input: {schema: AdaptLanguageAndTechniquesInputSchema},
  output: {schema: AdaptLanguageAndTechniquesOutputSchema},
  prompt: `Based on the user's information, adapt the language and therapeutic techniques to provide relevant and hyper-personalized support. Use British English and medical terms where appropriate.

User Information:
Age: {{{age}}}
Gender Identity: {{{genderIdentity}}}
Ethnicity: {{{ethnicity}}}
Vulnerable Score: {{{vulnerableScore}}}
Anxiety Level: {{{anxietyLevel}}}
Breakup Type: {{{breakupType}}}
Therapeutic Needs: {{#each therapeuticNeeds}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
{{#if additionalContext}}
Additional Context: {{{additionalContext}}}
{{/if}}

Adapted Language and Techniques:`,
});

const adaptLanguageAndTechniquesFlow = ai.defineFlow(
  {
    name: 'adaptLanguageAndTechniquesFlow',
    inputSchema: AdaptLanguageAndTechniquesInputSchema,
    outputSchema: AdaptLanguageAndTechniquesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
