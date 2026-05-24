import React, { useState } from 'react';
import { User, X, Copy, Check, Edit2, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';

interface UserProfile {
  display_name: string;
  lobby_id: string;
  email?: string;
}

interface ProfilePanelProps {
  profile: UserProfile | null;
  onUpdateProfile: (updatedProfile: UserProfile) => void;
  onClose?: () => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ 
  profile, 
  onUpdateProfile, 
  onClose 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCopyLobbyId = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.lobby_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    setError('');

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, display_name: displayName.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        onUpdateProfile({
          ...profile!,
          display_name: displayName.trim()
        });
        setIsEditing(false);
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNewCode = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/user/generate-lobby-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (res.ok && data.lobby_id) {
        onUpdateProfile({
          ...profile!,
          lobby_id: data.lobby_id
        });
      } else {
        setError(data.error || 'Failed to generate code');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const initials = profile?.display_name ? profile.display_name.substring(0, 2).toUpperCase() : 'ME';

  return (
    <div className="friends-panel profile-panel">
      <div className="settings-header">
        <div className="header-title-container">
          <User size={20} className="header-icon" style={{ color: 'var(--c-orange)' }} />
          <h2>My Profile</h2>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose} aria-label="Close profile">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="settings-content" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--c-orange)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '32px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(255, 122, 85, 0.2)'
          }}>
            {initials}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="text" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--c-border)',
                  textAlign: 'center',
                  fontSize: '15px',
                  fontWeight: 500
                }}
                autoFocus
              />
              {error && <span style={{ color: 'red', fontSize: '11px', textAlign: 'center' }}>{error}</span>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button type="submit" className="primary-btn" disabled={loading} style={{ padding: '6px 16px', fontSize: '12px' }}>
                  Save
                </button>
                <button type="button" onClick={() => setIsEditing(false)} style={{
                  padding: '6px 16px',
                  fontSize: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--c-border)',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{profile?.display_name}</h3>
              <button 
                onClick={() => {
                  setDisplayName(profile?.display_name || '');
                  setIsEditing(true);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', padding: '4px' }}
                title="Edit name"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}
          <span style={{ fontSize: '13px', color: 'var(--c-text-muted)', marginTop: '4px' }}>
            {profile?.email || auth.currentUser?.email}
          </span>
        </div>

        <div className="settings-card" style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Your Unique Lobby ID
          </h4>
          <p style={{ fontSize: '11px', color: 'var(--c-text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
            Share this ID with other users so they can add you as a friend and chat with you.
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            backgroundColor: 'var(--c-white-off)',
            borderRadius: '8px',
            border: '1px solid var(--c-border)'
          }}>
            <code style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '1px', color: 'var(--c-text-dark)' }}>
              {profile?.lobby_id}
            </code>
            <button 
              onClick={handleCopyLobbyId}
              style={{
                background: 'white',
                border: '1px solid var(--c-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 500,
                color: 'var(--c-text-dark)'
              }}
            >
              {copied ? (
                <>
                  <Check size={14} color="#00c853" />
                  <span style={{ color: '#00c853' }}>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <button 
            onClick={handleGenerateNewCode}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: '12px',
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: 'white',
              border: '1px dashed var(--c-purple)',
              color: 'var(--c-purple)',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '12px',
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            className="generate-btn-hover"
          >
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            Generate New Random Code
          </button>
        </div>
      </div>

      <style>{`
        .logout-btn-hover:hover {
          background-color: #fff2f0 !important;
          box-shadow: 0 2px 8px rgba(255, 77, 79, 0.1);
        }
        .generate-btn-hover:hover:not(:disabled) {
          background-color: rgba(75, 107, 251, 0.05) !important;
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProfilePanel;
