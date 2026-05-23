import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface Room {
  id: string;
  type: string;
  name: string | null;
  other_members: string[] | null;
}

interface ChatListProps {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  loading: boolean;
  onClose?: () => void;
}

const ChatList: React.FC<ChatListProps> = ({ rooms, activeRoomId, onSelectRoom, loading, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms.filter(room => {
    const roomName = room.name || room.other_members?.[0] || 'Unknown User';
    return roomName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="chat-list-panel">
      <div className="chat-list-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--c-text-dark)' }}>Chats</h2>
          {onClose && (
            <button className="close-btn" onClick={onClose} aria-label="Close chats">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="chat-items">
        {loading ? (
          <div style={{ padding: '24px', color: 'var(--c-text-muted)', textAlign: 'center', fontSize: '14px' }}>
            Loading chats...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div style={{ padding: '24px', color: 'var(--c-text-muted)', textAlign: 'center', fontSize: '14px' }}>
            {searchQuery ? 'No chats match search.' : 'No chats yet. Add a friend to start chatting!'}
          </div>
        ) : (
          filteredRooms.map(room => {
            const roomName = room.name || room.other_members?.[0] || 'Unknown User';
            const initials = roomName.substring(0, 2).toUpperCase();
            const isActive = room.id === activeRoomId;
            
            return (
              <div 
                key={room.id} 
                className={`chat-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectRoom(room.id)}
              >
                <div className="chat-avatar">
                  {initials}
                </div>
                <div className="chat-item-content">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{roomName}</span>
                  </div>
                  <div className="chat-item-message" style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                    {room.type === 'direct' ? '1-on-1 Chat' : 'Group Chat'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatList;
