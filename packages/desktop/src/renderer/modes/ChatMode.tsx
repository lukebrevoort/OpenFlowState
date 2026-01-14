import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useOpenCode } from '../hooks/useOpenCode';

/**
 * ChatMode - Primary chat interface for natural language interaction with OpenCode
 */
function ChatMode() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get state from store
  const { messages, isLoading, status, error } = useChatStore();
  
  // Get actions from hook
  const { sendMessage, checkStatus } = useOpenCode();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    checkStatus();
  };

  // Format message content with basic markdown-like styling
  const formatContent = (content: string) => {
    // Split by code blocks first
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        // Code block
        const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        return (
          <pre key={index} className="bg-flowstate-accent/10 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono">
            <code>{code}</code>
          </pre>
        );
      }
      
      // Regular text - handle bold and bullet points
      return (
        <span key={index}>
          {part.split('\n').map((line, lineIndex) => {
            // Handle bullet points
            if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
              return (
                <div key={lineIndex} className="flex gap-2 my-1">
                  <span className="text-flowstate-primary">•</span>
                  <span dangerouslySetInnerHTML={{ 
                    __html: line.replace(/^[•-]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }} />
                </div>
              );
            }
            
            // Regular line with bold support
            return (
              <span key={lineIndex}>
                <span dangerouslySetInnerHTML={{ 
                  __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }} />
                {lineIndex < part.split('\n').length - 1 && <br />}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Error Banner */}
      {error && (
        <div className="bg-flowstate-error/10 border border-flowstate-error/20 rounded-lg p-3 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-flowstate-error flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-flowstate-error font-medium">Connection Error</p>
            <p className="text-xs text-flowstate-text-muted">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="p-2 hover:bg-flowstate-error/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-flowstate-error" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-flowstate-primary text-white'
                  : 'bg-flowstate-surface'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-flowstate-border">
                  <Sparkles className="w-4 h-4 text-flowstate-primary" />
                  <span className="text-sm font-medium text-flowstate-primary">FlowState</span>
                </div>
              )}
              <div className="text-sm">
                {message.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                ) : (
                  formatContent(message.content)
                )}
              </div>
              <div
                className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-white/70' : 'text-flowstate-text-muted'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-flowstate-surface rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div
                    className="w-2 h-2 bg-flowstate-primary rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-flowstate-primary rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-flowstate-primary rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-sm text-flowstate-text-muted">
                  {status === 'thinking' ? 'Thinking...' : 'Processing...'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-flowstate-border pt-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={isLoading}
              className="fs-input resize-none pr-12 min-h-[44px] max-h-32 disabled:opacity-50"
              style={{ height: 'auto' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="fs-button-primary h-11 w-11 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-flowstate-text-muted mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default ChatMode;
