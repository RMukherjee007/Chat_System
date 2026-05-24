import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { auth } from './firebase';
import './App.css';

const SOCKET_URL = '/';

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
  const { currentUser, appUser, refreshAppUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  
  // Panel orchestration using single activeTab string
  const [activeTab, setActiveTab] = useState<PanelType>(() => {
    const saved = localStorage.getItem('activeTab');
    return saved ? (JSON.parse(saved) as PanelType) : 'chats';
  });
  
  const [showInfo, setShowInfo] = useState(false);

  // Archived room ids state (saved in localStorage)
  const [archivedRoomIds, setArchivedRoomIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('archivedRoomIds');
    return saved ? JSON.parse(saved) : [];
  });
  
  const userId = appUser?.lobby_id || 'unknown';
  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;

  // Change active tab
  const handleSelectTab = (tab: PanelType) => {
    setActiveTab(tab);
    localStorage.setItem('activeTab', JSON.stringify(tab));
  };

  const handleToggleInfo = () => {
    setShowInfo(!showInfo);
  };

  const handleArchiveRoom = (roomId: string) => {
    if (!archivedRoomIds.includes(roomId)) {
      const nextArchived = [...archivedRoomIds, roomId];
      setArchivedRoomIds(nextArchived);
      localStorage.setItem('archivedRoomIds', JSON.stringify(nextArchived));
    }
    if (activeRoomId === roomId) {
      setActiveRoomId(null);
      setShowInfo(false);
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
      const res = await fetch('/api/rooms', {
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
      const res = await fetch('/api/friends', {
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
        const res = await fetch(`/api/rooms/${activeRoomId}/messages`);
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

    newSocket.on('connect', async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        newSocket.emit('join_room', { room_id: activeRoomId, token });
      } catch (e) {
        console.error("Socket connect token error", e);
      }
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
    
    const sendWithToken = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        socket.emit('send_message', {
          room_id: activeRoomId,
          sender_id: userId,
          content: text,
          token
        });
      } catch (e) {
        console.error("Message send auth error", e);
      }
    };
    sendWithToken();
  };

  return (
    <div className={`app-layout ${showInfo ? 'info-open' : ''} ${activeRoomId ? 'has-active-room' : 'no-active-room'}`}>
      <NavigationSidebar 
        onToggleChatList={() => handleSelectTab('chats')}
        onToggleNews={() => handleSelectTab('news')}
        onToggleArchive={() => handleSelectTab('archive')}
        onToggleAI={() => handleSelectTab('ai')}
        onToggleProfile={() => handleSelectTab('profile')}
        onToggleSettings={() => handleSelectTab('settings')}
        showChatListActive={activeTab === 'chats'}
        showNewsActive={activeTab === 'news'}
        showArchiveActive={activeTab === 'archive'}
        showAIActive={activeTab === 'ai'}
        showProfileActive={activeTab === 'profile'}
        showSettingsActive={activeTab === 'settings'}
      />
      <div className="app-workspace">
        {/* Secondary Sidebar (Left) */}
        {activeTab === 'chats' && (
          <div className="animate-panel chat-list-panel">
            <ChatList 
              rooms={rooms.filter(room => !archivedRoomIds.includes(room.id))}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              loading={loadingRooms}
            />
          </div>
        )}

        {activeTab === 'work' && (
          <div className="animate-panel work-list-panel">
            <WorkList 
              rooms={rooms}
              friends={friends}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              onRefreshRooms={fetchRooms}
            />
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="animate-panel friends-panel">
            <FriendsList 
              friends={friends}
              onSelectRoom={handleSelectRoom}
              onRefreshRooms={fetchRooms}
              onRefreshFriends={fetchFriends}
            />
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="animate-panel archive-panel">
            <ArchivePanel 
              archivedRoomIds={archivedRoomIds}
              rooms={rooms}
              onUnarchiveRoom={handleUnarchiveRoom}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-panel profile-panel">
            <ProfilePanel 
              profile={appUser}
              onUpdateProfile={handleUpdateProfile}

            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="animate-panel settings-panel">
            <Settings onClose={() => handleSelectTab('chats')} />
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-panel ai-panel">
            <AIPanel />
          </div>
        )}

        {activeTab === 'news' && (
          <div className="animate-panel news-panel">
            <NewsPanel />
          </div>
        )}

        {/* Center: Main Chat View (only show if we are in a tab that supports chat viewing and a room is selected) */}
        {['chats', 'work', 'friends', 'archive'].includes(activeTab) && activeRoomId && activeRoom ? (
          <div className="animate-panel chat-area-panel">
            <ChatArea 
              activeRoom={activeRoom}
              messages={messages} 
              currentUserId={userId} 
              sendMessage={sendMessage} 
              onToggleInfo={handleToggleInfo}
              onBack={() => setActiveRoomId(null)}
              showInfoActive={showInfo}
            />
          </div>
        ) : (
          ['chats', 'work', 'friends', 'archive'].includes(activeTab) && (
            <div className="workspace-empty-state">
              <Smile size={48} style={{ marginBottom: '16px', color: 'var(--c-purple)', opacity: 0.7 }} />
              <h3>Select a Chat</h3>
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--c-text-muted)' }}>
                Choose a conversation from the list to start messaging.
              </p>
            </div>
          )
        )}

        {/* Right Side: Group Info Panel */}
        {showInfo && activeRoomId && ['chats', 'work', 'friends', 'archive'].includes(activeTab) && (
          <div className="animate-panel group-info-panel">
            <GroupInfo 
              activeRoom={activeRoom}
              onClose={() => setShowInfo(false)}
              onArchiveRoom={handleArchiveRoom}
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
