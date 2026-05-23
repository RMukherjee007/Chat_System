import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Smile } from 'lucide-react';
import NavigationSidebar from './components/NavigationSidebar';
import ChatList from './components/ChatList';
import ChatArea from './components/ChatArea';
import GroupInfo from './components/GroupInfo';
import WorkList from './components/WorkList';
import FriendsList from './components/FriendsList';
import NewsPanel from './components/NewsPanel';
import ArchivePanel from './components/ArchivePanel';
import AIPanel from './components/AIPanel';
import ProfilePanel from './components/ProfilePanel';
import Login from './pages/Login';
import Settings from './pages/Settings';
import { useAuth } from './contexts/AuthContext';
import './App.css';

const SOCKET_URL = 'http://localhost:3001';

interface SocketMessage {
  message_id: string;
  room_id: string;
  sender_id: string;
  content: string;
  timestamp: string;
}

interface UIMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface Friend {
  id: string;
  display_name: string;
  lobby_id: string;
}

interface Room {
  id: string;
  type: string;
  name: string | null;
  other_members: string[] | null;
}

type PanelType = 'chats' | 'work' | 'friends' | 'news' | 'archive' | 'ai' | 'profile' | 'settings' | 'info';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

// Main Chat Layout Component
const ChatLayout = () => {
  const { currentUser, appUser, refreshAppUser, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  
  // Panel orchestration using activePanels array (saved in localStorage)
  const [activePanels, setActivePanels] = useState<PanelType[]>(() => {
    const saved = localStorage.getItem('activePanels');
    return saved ? JSON.parse(saved) : ['chats'];
  });

  // Archived room ids state (saved in localStorage)
  const [archivedRoomIds, setArchivedRoomIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('archivedRoomIds');
    return saved ? JSON.parse(saved) : [];
  });
  
  const userId = appUser?.lobby_id || 'unknown';
  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;

  // Toggle panel in workspace
  const handleTogglePanel = (panel: PanelType) => {
    setActivePanels(prev => {
      let next;
      if (prev.includes(panel)) {
        next = prev.filter(p => p !== panel);
      } else {
        next = [...prev, panel];
      }
      localStorage.setItem('activePanels', JSON.stringify(next));
      return next;
    });
  };

  // Close panel in workspace
  const handleClosePanel = (panel: PanelType) => {
    setActivePanels(prev => {
      const next = prev.filter(p => p !== panel);
      localStorage.setItem('activePanels', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleInfo = () => {
    handleTogglePanel('info');
  };

  const handleArchiveRoom = (roomId: string) => {
    if (!archivedRoomIds.includes(roomId)) {
      const nextArchived = [...archivedRoomIds, roomId];
      setArchivedRoomIds(nextArchived);
      localStorage.setItem('archivedRoomIds', JSON.stringify(nextArchived));
    }
    if (activeRoomId === roomId) {
      setActiveRoomId(null);
      handleClosePanel('info');
    }
  };

  const handleUnarchiveRoom = (roomId: string) => {
    const nextArchived = archivedRoomIds.filter(id => id !== roomId);
    setArchivedRoomIds(nextArchived);
    localStorage.setItem('archivedRoomIds', JSON.stringify(nextArchived));
    setActiveRoomId(roomId);
  };

  const handleUpdateProfile = async () => {
    await refreshAppUser();
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Failed to log out', err);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    if (archivedRoomIds.includes(roomId)) {
      handleUnarchiveRoom(roomId);
    }
  };

  // 1. Fetch rooms on mount/sync
  const fetchRooms = async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('http://localhost:3001/api/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        if (data.rooms && data.rooms.length > 0 && !activeRoomId) {
          setActiveRoomId(data.rooms[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // 2. Fetch friends on mount/sync
  const fetchFriends = async () => {
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('http://localhost:3001/api/friends', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error('Failed to fetch friends', err);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchFriends();
  }, [currentUser]);

  // 3. Fetch messages on room change
  useEffect(() => {
    if (!activeRoomId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/rooms/${activeRoomId}/messages`);
        if (res.ok) {
          const data = await res.json();
          const uiMsgs = data.messages.map((msg: any) => {
            const senderName = msg.sender_id === userId
              ? (appUser?.display_name || 'You')
              : msg.sender_id === 'AI_Bot'
                ? 'Gemini AI'
                : (activeRoom?.other_members?.[0] || msg.sender_id);

            return {
              id: msg.message_id || msg._id,
              senderId: msg.sender_id,
              senderName,
              text: msg.content,
              timestamp: msg.timestamp || new Date().toISOString()
            };
          });
          setMessages(uiMsgs);
        }
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    };

    fetchMessages();
  }, [activeRoomId, appUser, activeRoom]);

  // 4. Socket connection & room joining
  useEffect(() => {
    if (!appUser || !activeRoomId) return;
    
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { room_id: activeRoomId });
    });

    newSocket.on('receive_message', (msg: SocketMessage) => {
      if (msg.room_id !== activeRoomId) return;

      const senderName = msg.sender_id === userId
        ? (appUser?.display_name || 'You')
        : msg.sender_id === 'AI_Bot'
          ? 'Gemini AI'
          : (activeRoom?.other_members?.[0] || msg.sender_id);

      const uiMsg: UIMessage = {
        id: msg.message_id || Math.random().toString(),
        senderId: msg.sender_id,
        senderName,
        text: msg.content,
        timestamp: msg.timestamp || new Date().toISOString()
      };
      
      // Prevent duplicate messages if added optimistically
      setMessages((prev) => {
        if (prev.some(m => m.id === uiMsg.id)) return prev;
        return [...prev, uiMsg];
      });
    });

    return () => {
      newSocket.close();
    };
  }, [activeRoomId, appUser, activeRoom, userId]);

  const sendMessage = (text: string) => {
    if (!socket || !appUser || !activeRoomId) return;
    
    const tempId = 'temp-' + Date.now();
    const localMsg: UIMessage = {
      id: tempId,
      senderId: userId,
      senderName: appUser.display_name,
      text: text,
      timestamp: new Date().toISOString()
    };
    
    setMessages((prev) => [...prev, localMsg]);
    
    socket.emit('send_message', {
      room_id: activeRoomId,
      sender_id: userId,
      content: text
    });
  };

  return (
    <div className={`app-layout ${activePanels.includes('info') ? 'info-open' : ''} ${activeRoomId ? 'has-active-room' : 'no-active-room'}`}>
      <NavigationSidebar 
        onToggleChatList={() => handleTogglePanel('chats')}
        onToggleWork={() => handleTogglePanel('work')}
        onToggleFriends={() => handleTogglePanel('friends')}
        onToggleNews={() => handleTogglePanel('news')}
        onToggleArchive={() => handleTogglePanel('archive')}
        onToggleAI={() => handleTogglePanel('ai')}
        onToggleProfile={() => handleTogglePanel('profile')}
        onToggleSettings={() => handleTogglePanel('settings')}
        showChatListActive={activePanels.includes('chats')}
        showWorkActive={activePanels.includes('work')}
        showFriendsActive={activePanels.includes('friends')}
        showNewsActive={activePanels.includes('news')}
        showArchiveActive={activePanels.includes('archive')}
        showAIActive={activePanels.includes('ai')}
        showProfileActive={activePanels.includes('profile')}
        showSettingsActive={activePanels.includes('settings')}
      />
      <div className="app-workspace">
        {/* Left Side: Navigation / List Panels */}
        {activePanels.includes('chats') && (
          <div className="animate-panel chat-list-panel">
            <ChatList 
              rooms={rooms.filter(room => !archivedRoomIds.includes(room.id))}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              loading={loadingRooms}
              onClose={() => handleClosePanel('chats')}
            />
          </div>
        )}

        {activePanels.includes('work') && (
          <div className="animate-panel work-list-panel">
            <WorkList 
              rooms={rooms}
              friends={friends}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              onRefreshRooms={fetchRooms}
              onClose={() => handleClosePanel('work')}
            />
          </div>
        )}

        {activePanels.includes('friends') && (
          <div className="animate-panel friends-panel">
            <FriendsList 
              friends={friends}
              onSelectRoom={handleSelectRoom}
              onRefreshRooms={fetchRooms}
              onRefreshFriends={fetchFriends}
              onClose={() => handleClosePanel('friends')}
            />
          </div>
        )}

        {activePanels.includes('archive') && (
          <div className="animate-panel archive-panel">
            <ArchivePanel 
              archivedRoomIds={archivedRoomIds}
              rooms={rooms}
              onUnarchiveRoom={handleUnarchiveRoom}
              onClose={() => handleClosePanel('archive')}
            />
          </div>
        )}

        {activePanels.includes('profile') && (
          <div className="animate-panel profile-panel">
            <ProfilePanel 
              profile={appUser}
              onUpdateProfile={handleUpdateProfile}
              onLogout={handleLogout}
              onClose={() => handleClosePanel('profile')}
            />
          </div>
        )}

        {/* Center: Main Chat View */}
        {activeRoomId && activeRoom ? (
          <div className="animate-panel chat-area-panel">
            <ChatArea 
              activeRoom={activeRoom}
              messages={messages} 
              currentUserId={userId} 
              sendMessage={sendMessage} 
              onToggleInfo={handleToggleInfo}
              onBack={() => setActiveRoomId(null)}
              showInfoActive={activePanels.includes('info')}
            />
          </div>
        ) : (
          // If no chat selected and no other panels open, show empty state
          activePanels.length === 0 && (
            <div className="workspace-empty-state">
              <Smile size={48} style={{ marginBottom: '16px', color: 'var(--c-purple)', opacity: 0.7 }} />
              <h3>Your Workspace is Empty</h3>
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--c-text-muted)' }}>
                Select options from the sidebar to open workspace panels.
              </p>
            </div>
          )
        )}

        {/* Right Side: Tooling / Details Panels */}
        {activePanels.includes('info') && activeRoomId && (
          <div className="animate-panel group-info-panel">
            <GroupInfo 
              activeRoom={activeRoom}
              onClose={() => handleClosePanel('info')}
              onArchiveRoom={handleArchiveRoom}
            />
          </div>
        )}

        {activePanels.includes('settings') && (
          <div className="animate-panel settings-panel">
            <Settings 
              onClose={() => handleClosePanel('settings')}
            />
          </div>
        )}

        {activePanels.includes('ai') && (
          <div className="animate-panel ai-panel">
            <AIPanel 
              onClose={() => handleClosePanel('ai')}
            />
          </div>
        )}

        {activePanels.includes('news') && (
          <div className="animate-panel news-panel">
            <NewsPanel 
              onClose={() => handleClosePanel('news')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <Navigate to="/" replace />
        } 
      />
    </Routes>
  );
}

export default App;
