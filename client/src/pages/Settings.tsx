import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Copy, UserPlus, CheckCircle, X } from 'lucide-react';

import { auth } from '../firebase'; // Need auth for getting token
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { appUser } = useAuth();
  const [targetLobbyId, setTargetLobbyId] = useState('');
  const [requestStatus, setRequestStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [copied, setCopied] = useState(false);


  const handleCopy = () => {
    if (appUser?.lobby_id) {
      navigator.clipboard.writeText(appUser.lobby_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestStatus(null);
    if (!targetLobbyId.trim()) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, target_lobby_id: targetLobbyId.trim() })
      });
      
      const data = await res.json();
      if (res.ok) {
        setRequestStatus({ type: 'success', message: 'Friend request sent successfully!' });
        setTargetLobbyId('');
      } else {
        setRequestStatus({ type: 'error', message: data.error || 'Failed to send request' });
      }
    } catch (err) {
      setRequestStatus({ type: 'error', message: 'Network error occurred' });
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="header-title-container">
          <User size={20} className="header-icon" />
          <h2>Settings</h2>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close settings">
          <X size={20} />
        </button>
      </div>
      
      <div className="settings-content">
        <div className="settings-card">
          <h3>Your Profile</h3>
          <div className="profile-info">
             <div className="profile-avatar">
               {appUser?.display_name?.substring(0, 2).toUpperCase() || 'U'}
             </div>
             <div className="profile-details">
               <h2>{appUser?.display_name || 'Loading...'}</h2>
               <p className="profile-email">{auth.currentUser?.email}</p>
             </div>
          </div>
          
          <div className="lobby-id-section">
            <p className="section-label">Your unique Lobby ID. Share this to add friends.</p>
            <div className="lobby-id-box">
              <span className="lobby-id-text">{appUser?.lobby_id || 'Generating...'}</span>
              <button className="icon-btn" onClick={handleCopy}>
                {copied ? <CheckCircle size={20} color="#00e676" /> : <Copy size={20} />}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h3>Add a Friend</h3>
          <p className="section-label">Enter your friend's Lobby ID to connect.</p>
          
          {requestStatus && (
            <div className={`status-banner ${requestStatus.type}`}>
              {requestStatus.message}
            </div>
          )}

          <form onSubmit={handleSendRequest} className="add-friend-form">
            <input 
              type="text" 
              placeholder="e.g. RAGHAV-7X9B" 
              value={targetLobbyId}
              onChange={(e) => setTargetLobbyId(e.target.value.toUpperCase())}
            />
            <button type="submit" className="primary-btn">
              <UserPlus size={18} /> Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
