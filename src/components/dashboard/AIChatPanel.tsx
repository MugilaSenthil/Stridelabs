import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, User, Loader2, Sparkles, X, Minimize2, Maximize2, RotateCcw } from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextData?: {
    year: number;
    totalEmissions: number;
    topCountry: string;
    gasType?: string;
    country?: string | null;
    continent?: string | null;
  };
}

export function AIChatPanel({ isOpen, onClose, contextData }: AIChatPanelProps) {
  const { messages, isLoading, error, sendMessage, clearMessages } = useAIChat(contextData || {});
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  if (!isOpen) return null;

  return (
    <Card 
      className={`fixed right-4 bottom-4 z-50 transition-all duration-300 bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl ${
        isMinimized ? 'w-[300px] h-[60px]' : 'w-[420px] h-[600px]'
      }`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span>AI Assistant</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-normal">
            Powered by Cloud
          </span>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={clearMessages}
            title="Clear chat"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex flex-col h-[calc(100%-60px)] p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`p-2 rounded-full shrink-0 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 rounded-xl p-3 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/50 text-foreground'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <div className="p-2 rounded-full bg-secondary text-secondary-foreground">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 rounded-xl p-3 bg-secondary/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing emissions data...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Error display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-border/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about emissions data..."
                className="flex-1 bg-secondary/50 border-border/50"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-muted-foreground">
                Try: "Compare China vs USA emissions" or "What sectors emit the most?"
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
