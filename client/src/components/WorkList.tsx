import React, { useState } from 'react';
import { Search, X, Briefcase, Plus, Users } from 'lucide-react';
import { auth } from '../firebase';

interface Room {
  id: string;
  type: string;
  name: string | null;
  other_members: string[] | null;
}

interface Friend {
  id: string;
  display_name: string;
  lobby_id: string;
}

interface WorkListProps {
  rooms: Room[];
  friends: Friend[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onRefreshRooms: () => Promise<void>;
  onClose?: () => void;
}

const WorkList: React.FC<WorkListProps> = ({ 
  rooms, 
  friends, 
  activeRoomId, 
  onSelectRoom, 
  onRefreshRooms, 
  onClose 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const workRooms = rooms.filter(room => room.type === 'group');

  const filteredRooms = workRooms.filter(room => {
    const roomName = room.name || 'Project Channel';
    return roomName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleToggleMember = (friendId: string) => {
    setSelectedMembers(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId) 
        : [...prev, friendId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError('');

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: newGroupName.trim(),
          member_ids: selectedMembers
        })
      });

      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setNewGroupName('');
        setSelectedMembers([]);
        await onRefreshRooms();
        onSelectRoom(data.roomId);
      } else {
        setError(data.error || 'Failed to create group');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="chat-list-panel work-list-panel">
      <div className="chat-list-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={20} color="var(--c-orange)" />
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--c-text-dark)' }}>Work</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="icon-btn" 
              onClick={() => setShowCreateModal(true)} 
              title="Create Workspace"
              style={{ background: 'var(--c-white-off)', padding: '6px', borderRadius: '50%' }}
            >
              <Plus size={18} />
            </button>
            {onClose && (
              <button className="close-btn" onClick={onClose} aria-label="Close work list">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search workspaces" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="chat-items">
        {filteredRooms.length === 0 ? (
          <div style={{ padding: '32px 24px', color: 'var(--c-text-muted)', textAlign: 'center', fontSize: '14px' }}>
            <div style={{ marginBottom: '12px', fontSize: '24px' }}>📂</div>
            <p style={{ marginBottom: '12px' }}>No active work channels yet.</p>
            <button className="primary-btn" style={{ margin: '0 auto', fontSize: '12px', padding: '8px 12px' }} onClick={() => setShowCreateModal(true)}>
              Create Workspace
            </button>
          </div>
        ) : (
          filteredRooms.map(room => {
            const roomName = room.name || 'Unnamed Channel';
            const initials = roomName.substring(0, 2).toUpperCase();
            const isActive = room.id === activeRoomId;

            return (
              <div 
                key={room.id} 
                className={`chat-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectRoom(room.id)}
              >
                <div className="chat-avatar" style={{ background: 'var(--c-orange)', color: 'white' }}>
                  {initials}
                </div>
                <div className="chat-item-content">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{roomName}</span>
                  </div>
                  <div className="chat-item-message" style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>
                    {room.other_members ? `${room.other_members.length + 1} members` : 'Group Workspace'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '100%',
            maxWidth: '380px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>New Workspace</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            {error && (
              <div style={{ color: 'red', fontSize: '13px', marginBottom: '12px' }}>{error}</div>
            )}

            <form onSubmit={handleCreateGroup}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', color: 'var(--c-text-muted)', display: 'block', marginBottom: '6px' }}>Channel Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Frontend Devs" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--c-border)',
                    outline: 'none'
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', color: 'var(--c-text-muted)', display: 'block', marginBottom: '6px' }}>Select Friends to Invite</label>
                {friends.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--c-text-muted)' }}>No friends available to add.</p>
                ) : (
                  <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '8px' }}>
                    {friends.map(friend => (
                      <label key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedMembers.includes(friend.id)}
                          onChange={() => handleToggleMember(friend.id)}
                        />
                        {friend.display_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="primary-btn" 
                disabled={creating}
                style={{ width: '100%', padding: '12px', borderRadius: '8px' }}
              >
                {creating ? 'Creating...' : 'Create Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkList;
