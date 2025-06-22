import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from './theme-provider';
import { 
  Play, 
  Search, 
  Settings, 
  Database, 
  BarChart3, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Bot,
  Rocket,
} from 'lucide-react';
import '../styles/components/floating-chat.css';
import { supabase } from '../lib/supabaseClient';
import Lottie from "lottie-react";
import chatbotBlueAnimation from "../assets/animations/chatbot-blue.json";

const CHAT_API_URL = 'https://godspeed-ops-ai-1ba0.onrender.com';

interface ChatMessageMeta {
  processing_time?: number;
  tokens_used?: number;
  sql_query?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatMessageMeta;
  timestamp?: number;
}

const FloatingChat: React.FC = () => {
  const { isAuthenticated, userType } = useAuth();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [sessionId] = useState(() => `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [userTypeState] = useState(() => userType);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Apply theme to document for chat component
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Get token on mount
    const fetchToken = async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token || null);
    };
    fetchToken();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    // Add welcome message when first opened
    if (open && messages.length === 0) {
      const welcomeContent = `# 🤖 Welcome to Godspeed Ops AI!

I'm your **intelligent database assistant** for querying the Godspeed database. I can help you find information about:

**👥 Clients** - Company information and contacts  
**💼 Job Positions** - Available roles and requirements  
**🧑‍💼 Jobseekers** - Candidate profiles and skills  
**⏰ Timesheets** - Work hours and billing records  
**📄 Invoices** - Financial records and payments  
**📊 Reports** - Analytics and insights  

---

### ⚡ **Real-time Processing**
Watch as I process your queries through multiple AI agents:
1. **🔍 Query Analysis** - Understanding your request
2. **⚙️ SQL Generation** - Creating optimized queries  
3. **🔧 Execution** - Running queries safely
4. **📝 Response Formatting** - Presenting results clearly

*Try one of the example queries below to get started!*`;
      
      setMessages([{ 
        role: 'assistant', 
        content: welcomeContent,
        timestamp: Date.now()
      }]);
    }
  }, [open, messages.length]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  // Only show for admin or recruiter
  if (!isAuthenticated || (userType !== 'admin' && userType !== 'recruiter')) return null;

  const getStageIcon = (stage: string) => {
    const iconProps = { size: 16, className: "inline-block mr-2" };
    
    switch (stage) {
      case 'starting':
        return <Play {...iconProps} />;
      case 'analyzing':
        return <Search {...iconProps} />;
      case 'generating':
        return <Settings {...iconProps} />;
      case 'executing':
        return <Database {...iconProps} />;
      case 'processing':
        return <BarChart3 {...iconProps} />;
      case 'formatting':
        return <FileText {...iconProps} />;
      case 'final':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      default:
        return <Settings {...iconProps} />;
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !token) return;

    const userMessage: ChatMessage = { 
      role: 'user', 
      content: input,
      timestamp: Date.now()
    };
    setMessages((msgs) => [...msgs, userMessage]);
    setInput('');
    setProcessing(true);
    setStatus('Starting to process your query...');
    setCurrentStage('starting');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      // Stream response from backend
      const response = await fetch(`${CHAT_API_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          user_type: userTypeState,
          user_question: input,
          message_history: messages.slice(-10),
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = '';
      let finalMeta: ChatMessageMeta | null = null;
      let doneReading = false;

      while (!doneReading) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            if (eventData === '[DONE]') {
              setStatus(null);
              setCurrentStage('');
              doneReading = true;
              break;
            }

            try {
              const event = JSON.parse(eventData);
              if (event.stage && event.stage !== 'final') {
                const stageMessages: Record<string, string> = {
                  starting: 'Starting to process your query...',
                  analyzing: 'Analyzing query and identifying database tables...',
                  generating: 'Generating optimized SQL query...',
                  executing: 'Executing database query...',
                  processing: 'Processing query results...',
                  formatting: 'Formatting response...',
                  final: 'Response ready!',
                };
                const statusMessage = event.message || stageMessages[event.stage] || `Processing: ${event.stage}`;
                setStatus(statusMessage);
                setCurrentStage(event.stage);
              }
              if (event.stage === 'final') {
                assistantMsg = event.message;
                finalMeta = event.metadata;
                setStatus('Response ready!');
                setCurrentStage('final');
              }
            } catch (err) {
              // ignore parse errors for non-JSON lines
            }
          }
        }
      }

      if (assistantMsg) {
        setMessages((msgs) => [...msgs, { 
          role: 'assistant', 
          content: assistantMsg, 
          metadata: finalMeta || undefined,
          timestamp: Date.now()
        }]);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setStatus('Error: ' + errorMsg);
      setCurrentStage('error');
    } finally {
      setProcessing(false);
      setTimeout(() => {
        setStatus(null);
        setCurrentStage('');
      }, 2000);
    }
  };

  // Enhanced markdown rendering
  const renderMarkdown = (text: string) => {
    const html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks and inline code
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Lists
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Horizontal rule
      .replace(/^---$/gim, '<hr>')
      // Line breaks
      .replace(/\n/g, '<br>');
    
    return { __html: html };
  };

  const exampleQueries = [
    { text: 'Show me all clients', icon: '👥' },
    { text: 'Find jobseekers with driver licenses', icon: '🚗' },
    { text: 'What are the recent timesheets?', icon: '⏰' },
    { text: 'Count of active positions', icon: '💼' },
    { text: 'Show me timesheets with jobseeker details', icon: '📊' }
  ];

  const setQuery = (query: string) => {
    setInput(query);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  };

  // Handle enter key for sending
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`floating-chat-container${open ? ' open' : ''}`}>  
      {!open && (
        <button 
          className="floating-chat-toggle" 
          onClick={() => setOpen(true)} 
          aria-label="Open AI Chat Assistant"
        >
          <div className="chat-toggle-animation-outer">
            <div className="chat-toggle-animation-wrapper">
              <Lottie
                animationData={chatbotBlueAnimation}
                style={{ width: 70, height: 70 }}
                loop={true}
                autoplay={true}
              />
            </div>
          </div>
          {/* <div className="chat-toggle-pill-outer">
            <span className="chat-toggle-pill">AI Assistant</span>
          </div> */}
        </button>
      )}
      
      {open && (
        <div className="floating-chat-window">
          <div className="floating-chat-header">
            <div className="header-content">
              <h1><Bot size={20} className="inline-block mr-2" />Godspeed Ops AI</h1>
              <p>Real-time database query assistant</p>
            </div>
            <div className="header-controls">
              <button 
                className="floating-chat-close" 
                onClick={() => setOpen(false)} 
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="floating-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}> 
                <div 
                  className="message-content" 
                  dangerouslySetInnerHTML={renderMarkdown(msg.content)} 
                />
                {msg.role === 'assistant' && msg.metadata && (
                  <div className="metadata-info">
                    <strong>⚡ Processing Info:</strong><br />
                    ⏱️ Time: {msg.metadata.processing_time}s | 
                    🔧 Tokens: {msg.metadata.tokens_used} | 
                    🗃️ SQL: {msg.metadata.sql_query ? msg.metadata.sql_query.substring(0, 50) + '...' : 'N/A'}
                  </div>
                )}
              </div>
            ))}
            
            {status && (
              <div className={`chat-status-indicator show ${currentStage}`}>
                <p>{getStageIcon(currentStage)}{status}</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          <div className="chat-input-container">
            {messages.length <= 1 && (
              <div className="example-queries">
                <h3>💡 Quick Start Examples</h3>
                <div className="example-buttons">
                  {exampleQueries.map((query, i) => (
                    <button 
                      key={i} 
                      className="example-button" 
                      onClick={() => setQuery(query.text)}
                      disabled={processing}
                    >
                      <span>{query.icon} {query.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className="chat-input-form" onSubmit={handleSend}>
              <textarea
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about clients, jobseekers, positions, timesheets..."
                disabled={processing}
                rows={1}
                style={{ height: 'auto', minHeight: '20px', maxHeight: '120px' }}
              />
              <button 
                className="send-button" 
                type="submit" 
                disabled={processing || !input.trim()}
              >
                {processing ? (
                  <>
                    <span className="spinner">⟳</span>
                    Processing...
                  </>
                ) : (
                  <>
                    Send
                    <Rocket size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingChat; 