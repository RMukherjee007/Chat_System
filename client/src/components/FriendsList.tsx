import React, { useState } from 'react';
import { Search, X, Users, UserPlus, MessageSquare } from 'lucide-react';
import { auth } from '../firebase';

interface Friend {
  id: string;
  display_name: string;
  lobby_id: string;
}

interface FriendsListProps {
  friends: Friend[];
  onSelectRoom: (roomId: string) => void;
  onRefreshRooms: () => Promise<void>;
  onRefreshFriends: () => Promise<void>;
  onClose?: () => void;
}

const FriendsList: React.FC<FriendsListProps> = ({ 
  friends, 
  onSelectRoom, 
  onRefreshRooms, 
  onRefreshFriends, 
  onClose 
}) => {
  const [targetLobbyId, setTargetLobbyId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredFriends = friends.filter(friend => 
    friend.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.lobby_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLobbyId.trim()) return;
    setStatus(null);
    setLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, target_lobby_id: targetLobbyId.trim().toUpperCase() })
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: 'Friend added successfully!' });
        setTargetLobbyId('');
        await onRefreshFriends();
        await onRefreshRooms();
        if (data.roomId) {
          onSelectRoom(data.roomId);
        }
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to add friend' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (lobbyId: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, target_lobby_id: lobbyId })
      });
      const data = await res.json();
      if (res.ok && data.roomId) {
        await onRefreshRooms();
        onSelectRoom(data.roomId);
      }
    } catch (err) {
      console.error('Failed to open friend chat:', err);
    }
  };

  return (
    <div className="friends-panel">
      <div className="settings-header">
        <div className="header-title-container">
          <Users size={20} className="header-icon" style={{ color: 'var(--c-purple)' }} />
          <h2>Friends</h2>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close friends list">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="settings-content" style={{ padding: '20px' }}>
        <div className="settings-card" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Add a Friend</h3>
          <p className="section-label" style={{ fontSize: '12px', color: 'var(--c-text-muted)', marginBottom: '12px' }}>
            Enter your friend's unique Lobby ID to start chatting instantly.
          </p>

          {status && (
            <div className={`status-banner ${status.type}`} style={{
              padding: '10px',
              borderRadius: '6px',
              fontSize: '12px',
              marginBottom: '12px',
              backgroundColor: status.type === 'success' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 74, 74, 0.1)',
              color: status.type === 'success' ? '#00c853' : '#d50000',
              border: `1px solid ${status.type === 'success' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 74, 74, 0.2)'}`
            }}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleAddFriend} className="add-friend-form" style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="e.g. USER-9X8B" 
              value={targetLobbyId}
              onChange={(e) => setTargetLobbyId(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--c-border)',
                outline: 'none',
                fontSize: '13px'
              }}
            />
            <button type="submit" disabled={loading} className="primary-btn" style={{
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <UserPlus size={16} /> {loading ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>

        <div className="settings-card">
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Your Friends ({friends.length})</h3>
          
          <div className="search-box" style={{ marginBottom: '12px' }}>
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search friends" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '13px' }}
            />
          </div>

          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {filteredFriends.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', textAlign: 'center', padding: '20px 0' }}>
                {searchQuery ? 'No friends match search.' : 'You haven\'t added any friends yet.'}
              </p>
            ) : (
              filteredFriends.map(friend => {
                const initials = friend.display_name.substring(0, 2).toUpperCase();
                return (
                  <div key={friend.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--c-white-off)',
                    marginBottom: '8px',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--c-purple)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '14px'
                      }}>
                        {initials}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-dark)' }}>{friend.display_name}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>ID: {friend.lobby_id}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleStartChat(friend.lobby_id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--c-purple)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '50%',
                        transition: 'background-color 0.2s'
                      }}
                      title="Chat"
                      className="icon-btn-hover"
                    >
                      <MessageSquare size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsList;
