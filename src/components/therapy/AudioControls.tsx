'use client';

import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Volume2, Play, Pause, FastForward, User, Speaker } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type VoiceGender = 'male' | 'female';

interface AudioControlsProps {
  onVoiceChange: (voice: VoiceGender) => void; // Changed to be non-optional
  initialVoice?: VoiceGender;
}

export function AudioControls({ onVoiceChange, initialVoice = 'female' }: AudioControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([50]);
  const [playbackSpeed, setPlaybackSpeed] = useState([1]);
  const [selectedVoice, setSelectedVoice] = useState<VoiceGender>(initialVoice);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect to inform parent about initial or changed voice preference, only on client
  useEffect(() => {
    if (isClient) {
      onVoiceChange(selectedVoice);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice, isClient]); // Rerun if selectedVoice or isClient changes

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    console.log("Play/Pause Relaxation Exercise (visual only)");
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
  };

  const handlePlaybackSpeedChange = (value: number[]) => {
    setPlaybackSpeed(value);
  };

  const handleVoiceChangeInternal = (value: VoiceGender) => {
    setSelectedVoice(value); // This will trigger the useEffect above to call onVoiceChange
  };
  
  if (!isClient) {
    return (
      <Card className="w-full shadow-md animate-pulse bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Speaker className="h-6 w-6 text-primary" />
            Audio & Voice Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded w-full"></div>
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-8 bg-muted rounded w-full"></div>
          <div className="h-10 bg-muted rounded w-1/2 mx-auto"></div>
          <div className="h-8 bg-muted rounded w-full"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Speaker className="h-6 w-6 text-primary" />
          Audio & Voice Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="volume-slider" className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" /> Volume: {volume[0]}% (Visual Only)
          </Label>
          <Slider
            id="volume-slider"
            defaultValue={[50]}
            max={100}
            step={1}
            value={volume}
            onValueChange={handleVolumeChange}
            aria-label="Volume"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="speed-slider" className="flex items-center gap-2">
            <FastForward className="h-5 w-5" /> Playback Speed: {playbackSpeed[0]}x (Visual Only)
          </Label>
          <Slider
            id="speed-slider"
            defaultValue={[1]}
            min={0.5}
            max={2}
            step={0.25}
            value={playbackSpeed}
            onValueChange={handlePlaybackSpeedChange}
            aria-label="Playback Speed"
          />
        </div>
        
        <div className="flex items-center justify-center space-x-4">
            <Button onClick={handlePlayPause} variant="outline" size="lg" aria-label={isPlaying ? 'Pause Exercise' : 'Play Relaxation Exercise'}>
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              <span className="ml-2">{isPlaying ? 'Pause Exercise' : 'Relaxation Exercise'} (Visual Only)</span>
            </Button>
        </div>

        <div>
          <Label className="mb-2 block font-medium flex items-center gap-2">
             AI Voice Preference
          </Label>
          <RadioGroup
            value={selectedVoice}
            onValueChange={(value: string) => handleVoiceChangeInternal(value as VoiceGender)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="male" id="male-voice" />
              <Label htmlFor="male-voice" className="flex items-center gap-1 cursor-pointer">
                <User className="h-5 w-5" /> Male
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="female" id="female-voice" />
              <Label htmlFor="female-voice" className="flex items-center gap-1 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-woman"><path d="M14.5 9.5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2z"/><path d="M17.5 10.5c1.7 0 3 1.3 3 3v0c0 1.7-1.3 3-3 3h-11c-1.7 0-3-1.3-3-3v0c0-1.7 1.3-3 3-3"/><path d="M6 16.5v5.5"/><path d="M18 16.5l-2.5 5.5"/><path d="M12 16.5v5.5"/></svg>
                 Female
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
