import React from 'react';
import { MessageSquare, Briefcase, Users, FileText, Archive, User, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavigationSidebarProps {
  onToggleChatList?: () => void;
  onToggleWork?: () => void;
  onToggleFriends?: () => void;
  onToggleNews?: () => void;
  onToggleArchive?: () => void;
  onToggleProfile?: () => void;
  onToggleSettings?: () => void;
  onToggleAI?: () => void;

  showChatListActive?: boolean;
  showWorkActive?: boolean;
  showFriendsActive?: boolean;
  showNewsActive?: boolean;
  showArchiveActive?: boolean;
  showProfileActive?: boolean;
  showSettingsActive?: boolean;
  showAIActive?: boolean;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  onToggleChatList,
  onToggleWork,
  onToggleFriends,
  onToggleNews,
  onToggleArchive,
  onToggleProfile,
  onToggleSettings,
  onToggleAI,

  showChatListActive,
  showWorkActive,
  showFriendsActive,
  showNewsActive,
  showArchiveActive,
  showProfileActive,
  showSettingsActive,
  showAIActive
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const handleChatsClick = () => {
    if (!currentUser) return;
    if (onToggleChatList) onToggleChatList();
    else navigate('/');
  };

  const handleWorkClick = () => {
    if (!currentUser) return;
    if (onToggleWork) onToggleWork();
  };

  const handleFriendsClick = () => {
    if (!currentUser) return;
    if (onToggleFriends) onToggleFriends();
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
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7678ed, #ff7a55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>A</div>
      </div>
      
      <div className="nav-items">
        <div className={itemClass(!!showChatListActive || (location.pathname === '/' && showChatListActive !== false))} onClick={handleChatsClick}>
          <MessageSquare size={20} />
          <span>All chats</span>
        </div>
        <div className={itemClass(!!showWorkActive)} onClick={handleWorkClick}>
          <Briefcase size={20} />
          <span>Work</span>
        </div>
        <div className={itemClass(!!showFriendsActive)} onClick={handleFriendsClick}>
          <Users size={20} />
          <span>Friends</span>
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
        <div className={itemClass(!!showProfileActive)} onClick={handleProfileClick}>
          <User size={20} />
          <span>Profile</span>
        </div>
        <div className={itemClass(!!showSettingsActive || location.pathname === '/settings')} onClick={handleSettingsClick}>
          <SettingsIcon size={20} />
          <span>Settings</span>
        </div>
      </div>
    </nav>
  );
};

export default NavigationSidebar;
