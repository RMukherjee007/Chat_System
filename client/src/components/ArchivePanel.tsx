import React from 'react';
import { Archive, X, RotateCcw, AlertCircle } from 'lucide-react';

interface Room {
  id: string;
  type: string;
  name: string | null;
  other_members: string[] | null;
}

interface ArchivePanelProps {
  archivedRoomIds: string[];
  rooms: Room[];
  onUnarchiveRoom: (roomId: string) => void;
  onClose?: () => void;
}

const ArchivePanel: React.FC<ArchivePanelProps> = ({ 
  archivedRoomIds, 
  rooms, 
  onUnarchiveRoom, 
  onClose 
}) => {
  const archivedRooms = rooms.filter(room => archivedRoomIds.includes(room.id));

  return (
    <div className="friends-panel archive-panel">
      <div className="settings-header">
        <div className="header-title-container">
          <Archive size={20} className="header-icon" style={{ color: 'var(--c-orange)' }} />
          <h2>Archive</h2>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close archive">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="settings-content" style={{ padding: '20px' }}>
        <div className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(255, 122, 85, 0.1)', border: '1px solid rgba(255, 122, 85, 0.2)' }}>
            <AlertCircle size={16} color="var(--c-orange)" />
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: '1.4' }}>
              Archived chats are hidden from your main chat sidebar. Restoring them will place them back.
            </span>
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Archived Chats ({archivedRooms.length})</h3>

          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {archivedRooms.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--c-text-muted)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📦</div>
                <p style={{ fontSize: '13px' }}>Your archive is empty.</p>
              </div>
            ) : (
              archivedRooms.map(room => {
                const roomName = room.name || (room.other_members ? room.other_members.join(', ') : 'Direct Chat');
                const initials = roomName.substring(0, 2).toUpperCase();
                
                return (
                  <div key={room.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--c-white-off)',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--c-orange)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '13px'
                      }}>
                        {initials}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text-dark)' }}>{roomName}</h4>
                        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                          {room.type === 'group' ? 'Workspace Channel' : 'Direct Chat'}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => onUnarchiveRoom(room.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--c-orange)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        transition: 'background-color 0.2s'
                      }}
                      title="Restore Chat"
                      className="icon-btn-hover"
                    >
                      <RotateCcw size={14} /> Restore
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

export default ArchivePanel;
