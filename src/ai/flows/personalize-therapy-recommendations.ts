'use server';

/**
 * @fileOverview AI flow to generate personalized therapy recommendations based on user-provided data.
 *
 * - personalizeTherapyRecommendations - A function that generates therapy recommendations.
 * - PersonalizeTherapyRecommendationsInput - The input type for the personalizeTherapyRecommendations function.
 * - PersonalizeTherapyRecommendationsOutput - The return type for the personalizeTherapyRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizeTherapyRecommendationsInputSchema = z.object({
  age: z.number().describe('The age of the user.'),
  genderIdentity: z.string().describe('The gender identity of the user (Male, Female, Non-Binary).'),
  ethnicity: z.string().describe('The ethnicity of the user.'),
  vulnerableScore: z
    .number()
    .min(0)
    .max(10)
    .describe('A score indicating the user vulnerability (0-10).'),
  anxietyLevel: z.enum(['Low', 'Medium', 'High']).describe('The anxiety level of the user.'),
  breakupType: z
    .enum(['Mutual', 'Ghosting', 'Cheating', 'Demise', 'Divorce'])
    .describe('The type of breakup the user experienced.'),
  background: z.string().describe('Relevant background information about the user.'),
  therapeuticNeeds: z
    .array(z.enum(['CBT', 'IPT', 'Grief Counseling']))
    .describe('Specific therapeutic needs of the user (CBT, IPT, Grief Counseling).'),
});
export type PersonalizeTherapyRecommendationsInput = z.infer<
  typeof PersonalizeTherapyRecommendationsInputSchema
>;

const PersonalizeTherapyRecommendationsOutputSchema = z.object({
  recommendations: z.string().describe('Personalized therapy recommendations based on the user data.'),
});
export type PersonalizeTherapyRecommendationsOutput = z.infer<
  typeof PersonalizeTherapyRecommendationsOutputSchema
>;

export async function personalizeTherapyRecommendations(
  input: PersonalizeTherapyRecommendationsInput
): Promise<PersonalizeTherapyRecommendationsOutput> {
  return personalizeTherapyRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizeTherapyRecommendationsPrompt',
  input: {schema: PersonalizeTherapyRecommendationsInputSchema},
  output: {schema: PersonalizeTherapyRecommendationsOutputSchema},
  prompt: `You are an AI therapist specializing in providing personalized therapy recommendations.

  Based on the following user data, generate tailored therapy recommendations. Consider the user's age, gender identity, anxiety level, type of breakup, background, and therapeutic needs to provide the most relevant advice.

  Age: {{{age}}}
  Gender Identity: {{{genderIdentity}}}
  Ethnicity: {{{ethnicity}}}
  Vulnerable Score: {{{vulnerableScore}}}
  Anxiety Level: {{{anxietyLevel}}}
  Breakup Type: {{{breakupType}}}
  Background: {{{background}}}
  Therapeutic Needs: {{#each therapeuticNeeds}}{{{this}}} {{/each}}

  Provide recommendations that are empathetic and contextually relevant, using British English with medical terms where appropriate.
  Focus on addressing the user's specific needs and circumstances.
  Structure the output as a set of actionable recommendations.
  `,
});

const personalizeTherapyRecommendationsFlow = ai.defineFlow(
  {
    name: 'personalizeTherapyRecommendationsFlow',
    inputSchema: PersonalizeTherapyRecommendationsInputSchema,
    outputSchema: PersonalizeTherapyRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
