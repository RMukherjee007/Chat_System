import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Paperclip, Mic, Send, Smile, Phone, Video, Info, X, Sparkles, MessageSquare } from 'lucide-react';
import { auth } from '../firebase';

interface Room {
  id: string;
  type: string;
  name: string | null;
  other_members: string[] | null;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface ChatAreaProps {
  activeRoom: Room | null;
  messages: Message[];
  currentUserId: string;
  sendMessage: (text: string) => void;
  onToggleInfo: () => void;
  onBack?: () => void;
  showInfoActive?: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  activeRoom, 
  messages, 
  currentUserId, 
  sendMessage, 
  onToggleInfo,
  onBack,
  showInfoActive
}) => {
  const [inputValue, setInputValue] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleSummarizeRoom = async () => {
    if (messages.length === 0 || aiLoading) return;
    setAiLoading(true);
    setSummary(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const recentText = messages.slice(-5).map(m => `${m.senderName}: ${m.text}`).join('\n');
      const prompt = `Summarize these recent messages in the room in a short, bulleted paragraph:\n${recentText}`;
      
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message: prompt })
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setSummary(data.reply);
      }
    } catch (err) {
      console.error('Failed to summarize room:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleMessageAction = async (msgText: string, actionType: 'reply' | 'summarize') => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const prompt = actionType === 'reply' 
        ? `Suggest a brief, helpful reply to this message: "${msgText}"` 
        : `Summarize this message in one sentence: "${msgText}"`;
      
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, message: prompt })
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        if (actionType === 'reply') {
          const cleanReply = data.reply.replace(/^["']|["']$/g, '');
          setInputValue(cleanReply);
        } else {
          setSummary(data.reply);
        }
      }
    } catch (err) {
      console.error('AI action failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const renderMessageContent = (text: string) => {
    const citationRegex = /\[msg-([a-zA-Z0-9-]+)\]/g;
    const parts = text.split(citationRegex);
    
    if (parts.length === 1) return text;

    const content: React.ReactNode[] = [];
    let i = 0;
    while (i < parts.length) {
      content.push(<span key={`text-${i}`}>{parts[i]}</span>);
      i++;
      if (i < parts.length) {
        const msgId = parts[i];
        content.push(
          <a 
            key={`cite-${i}`} 
            href={`#msg-${msgId}`} 
            className="citation-link" 
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`msg-${msgId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.classList.add('highlight-citation');
                setTimeout(() => el.classList.remove('highlight-citation'), 2000);
              }
            }}
          >
            [citation]
          </a>
        );
        i++;
      }
    }
    return content;
  };

  if (!activeRoom) {
    return (
      <div className="chat-area-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)', fontSize: '15px' }}>
        <div style={{ textAlign: 'center', padding: '32px' }}>
          <Smile size={48} style={{ marginBottom: '16px', color: 'var(--c-orange)', opacity: 0.7 }} />
          <h3>Welcome to the Lobby!</h3>
          <p style={{ marginTop: '8px', fontSize: '13px' }}>Select a friend from the list or add one in Settings to start chatting.</p>
        </div>
      </div>
    );
  }

  const roomName = activeRoom.name || activeRoom.other_members?.[0] || 'Direct Room';

  return (
    <div className="chat-area-panel" style={{ position: 'relative' }}>
      <div className="chat-area-header">
        {onBack && (
          <button className="back-btn mobile-only" onClick={onBack} aria-label="Back to chats">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="header-title">
          <h2>{roomName}</h2>
          <span className="header-subtitle">
            {activeRoom.type === 'direct' ? '1-on-1 Direct Messaging' : 'Group Messaging'}
          </span>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className={`header-action-btn ${aiLoading ? 'pulsing' : ''}`} 
            onClick={handleSummarizeRoom} 
            title="AI Summarize Chat"
            style={{ color: 'var(--c-orange)' }}
          >
            <Sparkles size={18} />
          </button>
          <button className="header-action-btn" aria-label="Phone Call"><Phone size={18} /></button>
          <button className="header-action-btn" aria-label="Video Call"><Video size={18} /></button>
          <button className={`header-action-btn ${showInfoActive ? 'active' : ''}`} onClick={onToggleInfo} aria-label="Room Info">
            <Info size={18} />
          </button>
          {onBack && (
            <button className="header-action-btn close-btn" onClick={onBack} aria-label="Close Chat">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Summary Banner overlay */}
      {summary && (
        <div style={{
          position: 'absolute',
          top: '65px',
          left: '16px',
          right: '16px',
          backgroundColor: 'var(--c-white-off)',
          border: '1px solid var(--c-orange)',
          borderRadius: '8px',
          padding: '12px 16px',
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1, marginRight: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--c-orange)', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              <Sparkles size={14} /> AI Analysis
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--c-text-dark)' }}>{summary}</p>
          </div>
          <button onClick={() => setSummary(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>
      )}
      
      <div className="messages-container">
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === currentUserId;
          const showAvatar = !isOwn && (index === 0 || messages[index - 1].senderId !== msg.senderId);
          
          return (
            <div 
              key={msg.id} 
              id={`msg-${msg.id}`} 
              className={`message-wrapper ${isOwn ? 'sent' : 'received'}`}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
              style={{ position: 'relative' }}
            >
              {!isOwn && (
                <div className="message-avatar" style={{ backgroundColor: 'var(--c-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                  {showAvatar ? msg.senderName.substring(0, 2).toUpperCase() : ''}
                </div>
              )}
              <div className="message-content">
                {!isOwn && showAvatar && (
                  <div className="message-author">
                    <span>{msg.senderName}</span>
                  </div>
                )}
                <div className="bubble">
                  {renderMessageContent(msg.text)}
                </div>
              </div>

              {/* Hover Actions Menu */}
              {hoveredMessageId === msg.id && (
                <div className="message-hover-actions" style={{
                  position: 'absolute',
                  top: '-16px',
                  right: isOwn ? 'auto' : '16px',
                  left: isOwn ? '16px' : 'auto',
                  display: 'flex',
                  gap: '4px',
                  backgroundColor: 'white',
                  border: '1px solid var(--c-border)',
                  borderRadius: '16px',
                  padding: '2px 6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  zIndex: 10
                }}>
                  <button 
                    onClick={() => handleMessageAction(msg.text, 'summarize')} 
                    title="Explain/Summarize with AI"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-orange)', padding: '2px 4px', fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <Sparkles size={12} /> Summarize
                  </button>
                  {!isOwn && (
                    <button 
                      onClick={() => handleMessageAction(msg.text, 'reply')} 
                      title="Suggest Reply with AI"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-purple)', padding: '2px 4px', fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      <MessageSquare size={12} /> Reply
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <Paperclip className="input-icon" size={20} />
          <form onSubmit={handleSend} style={{ flex: 1, display: 'flex' }}>
            <input 
              type="text" 
              placeholder={activeRoom.type === 'direct' ? "Write a message..." : "Write a message... Tag @AI to ask assistant."} 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </form>
          <Smile className="input-icon" size={20} />
          {inputValue ? (
            <button className="send-btn" onClick={handleSend} aria-label="Send message" style={{ backgroundColor: 'var(--c-orange)' }}>
              <Send size={16} />
            </button>
          ) : (
            <Mic className="input-icon" size={20} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .pulsing {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ChatArea;
