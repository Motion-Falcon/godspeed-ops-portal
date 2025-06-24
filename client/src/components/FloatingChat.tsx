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

// Extend window interface for TypeScript
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    marked?: any;
    Prism?: {
      languages: Record<string, unknown>;
      highlight: (code: string, grammar: unknown, language: string) => string;
    };
  }
}

const CHAT_API_URL = 'https://godspeed-ops-ai-1ba0.onrender.com';

// Load marked and Prism.js libraries dynamically
const loadMarkdownLibraries = async () => {
  if (typeof window !== 'undefined' && !window.marked) {
    // Load marked library
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Load Prism.js core
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Load Prism.js autoloader
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    // Load Prism.js CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(link);

    // Configure marked for consistent rendering
    if (window.marked) {
      const marked = window.marked;
      marked.setOptions({
        breaks: true,
        gfm: true,
        tables: true,
        sanitize: false,
        highlight: function(code: string, lang: string) {
          if (lang && window.Prism?.languages?.[lang]) {
            return window.Prism.highlight(code, window.Prism.languages[lang], lang);
          }
          return code;
        }
      });
    }
  }
};

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
  const [markdownReady, setMarkdownReady] = useState(false);

  useEffect(() => {
    // Apply theme to document for chat component
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Load markdown libraries when component mounts
    loadMarkdownLibraries().then(() => {
      setMarkdownReady(true);
    }).catch(error => {
      console.error('Failed to load markdown libraries:', error);
      setMarkdownReady(true); // Set to true anyway to allow fallback rendering
    });
  }, []);

  useEffect(() => {
    // Get token on mount and whenever auth state changes
    const fetchToken = async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token || null);
    };
    fetchToken();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    // Add welcome message when first opened
    if (open && messages.length === 0 && markdownReady) {
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
  }, [open, messages.length, markdownReady]);

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

  // Enhanced markdown rendering using the same approach as chat_ui.html
  const renderMarkdown = (text: string) => {
    // If markdown libraries are not loaded yet, use fallback
    if (!markdownReady || !window.marked) {
      return { __html: text.replace(/\n/g, '<br>') };
    }

    try {
      // Configure marked exactly like in chat_ui.html
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marked = window.marked as any;
      marked.setOptions({
        breaks: true,
        gfm: true,
        tables: true,
        sanitize: false,
        highlight: function(code: string, lang: string) {
          if (lang && window.Prism?.languages?.[lang]) {
            return window.Prism.highlight(code, window.Prism.languages[lang], lang);
          }
          return code;
        }
      });

      return { __html: marked.parse(text) };
    } catch (e) {
      console.error('Markdown parsing error:', e);
      // Fallback to plain text with line breaks if markdown parsing fails
      return { __html: text.replace(/\n/g, '<br>') };
    }
  };

  // Apply syntax highlighting to code blocks after rendering
  const applySyntaxHighlighting = (element: HTMLElement) => {
    if (!window.Prism) return;

    const codeBlocks = element.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
      // Try to detect language from class name
      const langClass = (block as HTMLElement).className.match(/language-(\w+)/);
      const lang = langClass ? langClass[1] : null;
      
      if (lang && window.Prism?.languages?.[lang]) {
        (block as HTMLElement).innerHTML = window.Prism.highlight(
          block.textContent || '', 
          window.Prism.languages[lang], 
          lang
        );
        (block as HTMLElement).className = `language-${lang}`;
      }
    });
  };

  const exampleQueries = [
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
                  dangerouslySetInnerHTML={msg.role === 'assistant' ? renderMarkdown(msg.content) : { __html: msg.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') }}
                  ref={(el) => {
                    if (el && msg.role === 'assistant' && window.Prism) {
                      // Apply syntax highlighting after the element is rendered
                      setTimeout(() => applySyntaxHighlighting(el), 0);
                    }
                  }}
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