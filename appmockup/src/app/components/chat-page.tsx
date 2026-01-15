import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function PulseIndicator() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative">
        {/* Outer pulse rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-[#A5B574]/20 animate-pulse" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center animation-delay-150">
          <div className="w-32 h-32 rounded-full bg-[#A5B574]/10 animate-pulse" />
        </div>
        
        {/* Center orb */}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#A5B574] to-[#C87137] flex items-center justify-center shadow-lg">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[70%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-card border border-border text-foreground backdrop-blur-xl'
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        <span className="text-xs opacity-60 mt-1 block">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you achieve flow state today?',
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: 2,
      role: 'user',
      content: 'Can you help me organize my tasks for the week?',
      timestamp: new Date(Date.now() - 240000),
    },
    {
      id: 3,
      role: 'assistant',
      content: 'Of course! I\'d be happy to help you organize your tasks. Let\'s start by understanding your priorities. What are your main goals for this week?',
      timestamp: new Date(Date.now() - 180000),
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    // Simulate AI response after a delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: 'I understand. Let me help you with that...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Pulse Indicator at top */}
      <div className="flex-shrink-0">
        <PulseIndicator />
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-4xl mx-auto">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Floating message input */}
      <div className="flex-shrink-0 px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-lg p-4">
            <div className="flex items-end gap-3">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                rows={1}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-32"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-muted disabled:opacity-50 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-md"
              >
                <Send className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
