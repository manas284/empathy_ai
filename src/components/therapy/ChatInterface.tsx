'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string) => Promise<void>; // Make it async
  isLoadingAiResponse: boolean;
}

export function ChatInterface({ messages, onSendMessage, isLoadingAiResponse }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoadingAiResponse) {
      await onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px] border rounded-lg shadow-lg bg-card">
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end space-x-2',
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.sender === 'ai' && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback><Bot size={18}/></AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-xs lg:max-w-md p-3 rounded-lg shadow',
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-muted text-muted-foreground rounded-bl-none'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                <p className="text-xs text-right mt-1 opacity-70">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.sender === 'user' && (
                <Avatar className="h-8 w-8">
                   <AvatarFallback><User size={18}/></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoadingAiResponse && (
            <div className="flex items-end space-x-2 justify-start">
              <Avatar className="h-8 w-8">
                <AvatarFallback><Bot size={18}/></AvatarFallback>
              </Avatar>
              <div className="max-w-xs lg:max-w-md p-3 rounded-lg shadow bg-muted text-muted-foreground rounded-bl-none">
                <p className="text-sm italic">EmpathyAI is typing...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="border-t p-4 flex items-center space-x-2 bg-background">
        <Input
          type="text"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-grow"
          disabled={isLoadingAiResponse}
          aria-label="Chat message input"
        />
        <Button type="submit" size="icon" disabled={isLoadingAiResponse || !inputValue.trim()} aria-label="Send message">
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
