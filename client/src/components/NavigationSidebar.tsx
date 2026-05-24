import React, { useState, useEffect } from 'react';
import { MessageSquare, FileText, Archive, User, Settings as SettingsIcon, Sparkles, Sun, Moon, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import EchoStreamLogo from './EchoStreamLogo';

interface NavigationSidebarProps {
  onToggleChatList?: () => void;
  onToggleNews?: () => void;
  onToggleArchive?: () => void;
  onToggleProfile?: () => void;
  onToggleSettings?: () => void;
  onToggleAI?: () => void;

  showChatListActive?: boolean;
  showNewsActive?: boolean;
  showArchiveActive?: boolean;
  showProfileActive?: boolean;
  showSettingsActive?: boolean;
  showAIActive?: boolean;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  onToggleChatList,
  onToggleNews,
  onToggleArchive,
  onToggleProfile,
  onToggleSettings,
  onToggleAI,

  showChatListActive,
  showNewsActive,
  showArchiveActive,
  showProfileActive,
  showSettingsActive,
  showAIActive
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleChatsClick = () => {
    if (!currentUser) return;
    if (onToggleChatList) onToggleChatList();
    else navigate('/');
  };

  const handleNewsClick = () => {
    if (!currentUser) return;
    if (onToggleNews) onToggleNews();
  };

  const handleArchiveClick = () => {
    if (!currentUser) return;
    if (onToggleArchive) onToggleArchive();
  };

  const handleProfileClick = () => {
    if (!currentUser) return;
    if (onToggleProfile) onToggleProfile();
  };

  const handleSettingsClick = () => {
    if (!currentUser) return;
    if (onToggleSettings) onToggleSettings();
    else navigate('/settings');
  };

  const handleAIClick = () => {
    if (!currentUser) return;
    if (onToggleAI) onToggleAI();
  };

  const itemClass = (isActive: boolean, isAIBtn: boolean = false) => {
    return `nav-item ${isActive ? 'active' : ''} ${!currentUser ? 'disabled' : ''} ${isAIBtn ? 'ai-nav-item' : ''}`;
  };

  return (
    <nav className="nav-sidebar">
      <div className="nav-brand">
        <EchoStreamLogo size={44} />
      </div>
      
      <div className="nav-items">
        <div className={itemClass(!!showChatListActive || (location.pathname === '/' && showChatListActive !== false))} onClick={handleChatsClick}>
          <MessageSquare size={20} />
          <span>All chats</span>
        </div>
        <div className={itemClass(!!showNewsActive)} onClick={handleNewsClick}>
          <FileText size={20} />
          <span>News</span>
        </div>
        <div className={itemClass(!!showArchiveActive)} onClick={handleArchiveClick}>
          <Archive size={20} />
          <span>Archive</span>
        </div>
        <div className={itemClass(!!showAIActive, true)} onClick={handleAIClick}>
          <Sparkles size={20} />
          <span>AI Assistant</span>
        </div>
      </div>
      
      <div className="nav-bottom">
        <div className="nav-item" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </div>
        <div className={itemClass(!!showProfileActive)} onClick={handleProfileClick}>
          <User size={20} />
          <span>Profile</span>
        </div>
        <div className={itemClass(!!showSettingsActive || location.pathname === '/settings')} onClick={handleSettingsClick}>
          <SettingsIcon size={20} />
          <span>Settings</span>
        </div>
        <div className="nav-item" onClick={async () => { await logout(); navigate('/login'); }}>
          <LogOut size={20} />
          <span>Log Out</span>
        </div>
      </div>
    </nav>
  );
};

export default NavigationSidebar;
