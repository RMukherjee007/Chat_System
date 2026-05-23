import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, ArrowRight, Bot } from 'lucide-react';
import { auth } from '../firebase';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface AIPanelProps {
  onClose?: () => void;
}

const PRESETS = [
  "Explain the current workspace features",
  "How do I add friends using Lobby ID?",
  "Suggest a plan to organize my work channels"
];

const AIPanel: React.FC<AIPanelProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: "👋 Hello! I am your Antigravity AI Assistant. I am integrated across your workspace to help you summarize conversations, write responses, and navigate the platform.\n\nHow can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      // Compile history (excluding the very first welcome message)
      const chatHistory = messages.slice(1).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('http://localhost:3001/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          message: textToSend.trim(),
          history: chatHistory
        })
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        setMessages(prev => [...prev, {
          role: 'ai',
          content: data.reply,
          timestamp: new Date()
        }]);
      } else {
        throw new Error(data.error || 'Failed to generate response');
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `❌ Error: ${err.message || 'Unable to reach the assistant right now.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="friends-panel ai-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="settings-header">
        <div className="header-title-container">
          <Sparkles size={20} className="header-icon" style={{ color: 'var(--c-orange)' }} />
          <h2>AI Assistant</h2>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close AI panel">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Messages list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }} className="ai-messages-list">
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            {msg.role === 'ai' && (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 122, 85, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--c-orange)',
                flexShrink: 0,
                marginTop: '4px'
              }}>
                <Bot size={16} />
              </div>
            )}
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
              backgroundColor: msg.role === 'user' ? 'var(--c-orange)' : 'var(--c-white-off)',
              color: msg.role === 'user' ? 'white' : 'var(--c-text-dark)',
              fontSize: '13px',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 122, 85, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--c-orange)',
              flexShrink: 0
            }}>
              <Bot size={16} />
            </div>
            <div className="typing-indicator" style={{
              padding: '10px 14px',
              borderRadius: '16px 16px 16px 2px',
              backgroundColor: 'var(--c-white-off)',
              display: 'flex',
              gap: '4px'
            }}>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset Suggestions */}
      {messages.length === 1 && !loading && (
        <div style={{ padding: '0 16px 12px 16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
            SUGGESTED TOPICS
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(preset)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--c-border)',
                  backgroundColor: 'white',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                  color: 'var(--c-text-dark)'
                }}
                className="preset-btn-hover"
              >
                <span>{preset}</span>
                <ArrowRight size={14} style={{ color: 'var(--c-orange)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input container */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--c-border)' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '24px',
              border: '1px solid var(--c-border)',
              outline: 'none',
              fontSize: '13px'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'var(--c-orange)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s'
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      <style>{`
        .preset-btn-hover:hover {
          border-color: var(--c-orange) !important;
          background-color: rgba(255, 122, 85, 0.02) !important;
        }
        .typing-indicator .dot {
          width: 6px;
          height: 6px;
          background-color: var(--c-text-muted);
          border-radius: 50%;
          animation: bounce 1.3s linear infinite;
        }
        .typing-indicator .dot:nth-child(2) { animation-delay: 0.15s; }
        .typing-indicator .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

export default AIPanel;
