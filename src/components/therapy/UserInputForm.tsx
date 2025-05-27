
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { UserProfile } from '@/types';
import { Slider } from '@/components/ui/slider';
import { useState } from 'react';

const therapeuticNeedsItems = [
  { id: 'CBT', label: 'CBT: Manage anxiety and guilt' },
  { id: 'IPT', label: 'IPT: Navigate family dynamics' },
  { id: 'Grief Counseling', label: 'Grief Counseling: Process emotional chaos' },
] as const;

const userProfileSchema = z.object({
  age: z.coerce.number().min(13, "Must be at least 13").max(100, "Max age is 100"),
  genderIdentity: z.enum(['Male', 'Female', 'Non-Binary']),
  ethnicity: z.string().min(1, "Ethnicity is required"),
  vulnerableScore: z.coerce.number().min(0).max(10),
  anxietyLevel: z.enum(['Low', 'Medium', 'High']),
  breakupType: z.enum(['Mutual', 'Ghosting', 'Cheating', 'Demise', 'Divorce']),
  background: z.string().min(10, "Please provide some background information (min 10 characters).").max(5000),
  therapeuticNeeds: z.array(z.enum(['CBT', 'IPT', 'Grief Counseling'])).min(1, "Select at least one therapeutic need."),
});

interface UserInputFormProps {
  onSubmit: (data: UserProfile) => void;
  isLoading: boolean;
}

export function UserInputForm({ onSubmit, isLoading }: UserInputFormProps) {
  const [vulnerability, setVulnerability] = useState(5);

  const form = useForm<z.infer<typeof userProfileSchema>>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      age: 18,
      genderIdentity: 'Female',
      ethnicity: '',
      vulnerableScore: 5,
      anxietyLevel: 'Medium',
      breakupType: 'Mutual',
      background: '',
      therapeuticNeeds: [],
    },
  });

  function handleSubmit(values: z.infer<typeof userProfileSchema>) {
    onSubmit(values);
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle>Tell Us About Yourself</CardTitle>
        <CardDescription>This information helps us personalize your therapy experience. All data is kept confidential.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Your age" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="genderIdentity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender Identity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your gender identity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Non-Binary">Non-Binary</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ethnicity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ethnicity</FormLabel>
                  <FormControl>
                    <Input placeholder="Your ethnicity" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="vulnerableScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vulnerability Score (0-10)</FormLabel>
                   <FormControl>
                    <div>
                      <Slider
                        min={0} max={10} step={1}
                        defaultValue={[field.value]}
                        onValueChange={(value) => {
                          field.onChange(value[0]);
                          setVulnerability(value[0]);
                        }}
                        className="my-2"
                      />
                      <p className="text-sm text-muted-foreground text-center">Current Score: {vulnerability}</p>
                    </div>
                  </FormControl>
                  <FormDescription>How vulnerable do you feel currently?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="anxietyLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anxiety Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your anxiety level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="breakupType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breakup Type (if applicable)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select breakup type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Mutual">Mutual</SelectItem>
                        <SelectItem value="Ghosting">Ghosting</SelectItem>
                        <SelectItem value="Cheating">Cheating</SelectItem>
                        <SelectItem value="Demise">Demise (Natural Passing)</SelectItem>
                        <SelectItem value="Divorce">Divorce</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="background"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Background</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Briefly describe your current situation or what you'd like to discuss."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>This helps the AI understand your context better.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="therapeuticNeeds"
              render={({ field }) => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Therapeutic Needs</FormLabel>
                    <FormDescription>
                      Select areas where you feel you need support.
                    </FormDescription>
                  </div>
                  {therapeuticNeedsItems.map((item) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name="therapeuticNeeds"
                      render={({ field: itemField }) => {
                        return (
                          <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={itemField.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? itemField.onChange([...(itemField.value || []), item.id])
                                    : itemField.onChange(
                                        (itemField.value || []).filter(
                                          (value) => value !== item.id
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {item.label}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Start Personalized Session'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
