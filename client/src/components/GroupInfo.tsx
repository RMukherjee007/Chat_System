import React from 'react';
import { X, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Room {
  id: string;
  type: string;
  name: string | null;
  other_members: string[] | null;
}

interface GroupInfoProps {
  activeRoom: Room | null;
  onClose: () => void;
  onArchiveRoom?: (roomId: string) => void;
}

const GroupInfo: React.FC<GroupInfoProps> = ({ activeRoom, onClose, onArchiveRoom }) => {
  const { appUser } = useAuth();
  
  if (!activeRoom) return null;

  const roomName = activeRoom.name || activeRoom.other_members?.[0] || 'Direct Room';

  return (
    <div className="group-info-panel">
      <div className="info-header">
        <span className="info-title">Room info</span>
        <X className="info-close" size={20} onClick={onClose} />
      </div>
      
      <div className="info-section">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div className="member-avatar" style={{ 
            width: '64px', 
            height: '64px', 
            fontSize: '20px', 
            fontWeight: '600', 
            margin: '0 auto 12px',
            backgroundColor: 'var(--c-purple)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {roomName.substring(0, 2).toUpperCase()}
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--c-text-dark)' }}>{roomName}</h3>
          <p style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '4px' }}>
            {activeRoom.type === 'direct' ? '1-on-1 Direct Chat' : 'Group Chat'}
          </p>
        </div>
      </div>

      <div className="info-section">
        <div className="info-header" style={{ marginBottom: '12px' }}>
          <span className="info-title" style={{ fontSize: '14px' }}>Members</span>
          <Search size={16} style={{ color: 'var(--c-text-muted)', cursor: 'pointer' }} />
        </div>
        <div className="members-list">
          {/* Gemini AI Bot */}
          <div className="member-item">
            <div className="member-avatar" style={{ background: 'linear-gradient(135deg, #7678ed, #ff7a55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
              AI
            </div>
            <div className="member-info">
              <span className="member-name">Gemini AI</span>
              <span className="member-role">Bot Agent</span>
            </div>
          </div>

          {/* Current User */}
          <div className="member-item">
            <div className="member-avatar" style={{ backgroundColor: 'var(--c-purple)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
              {(appUser?.display_name || 'U').substring(0, 2).toUpperCase()}
            </div>
            <div className="member-info">
              <span className="member-name">{appUser?.display_name || 'You'}</span>
              <span className="member-role">Admin</span>
            </div>
          </div>

          {/* Other User (if direct chat) */}
          {activeRoom.type === 'direct' && activeRoom.other_members?.[0] && (
            <div className="member-item">
              <div className="member-avatar" style={{ backgroundColor: '#e5e4e7', color: 'var(--c-text-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                {activeRoom.other_members[0].substring(0, 2).toUpperCase()}
              </div>
              <div className="member-info">
                <span className="member-name">{activeRoom.other_members[0]}</span>
                <span className="member-role">Member</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {onArchiveRoom && (
        <div className="info-section" style={{ borderTop: '1px solid var(--c-border)', paddingTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={() => onArchiveRoom(activeRoom.id)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 122, 85, 0.1)',
              color: 'var(--c-orange)',
              border: '1px solid rgba(255, 122, 85, 0.2)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--c-orange)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 122, 85, 0.1)';
              e.currentTarget.style.color = 'var(--c-orange)';
            }}
          >
            Archive Chat
          </button>
        </div>
      )}
    </div>
  );
};

export default GroupInfo;
