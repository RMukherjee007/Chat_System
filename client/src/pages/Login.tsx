import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshAppUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name
        });
      }
      
      // wait for appUser to be fetched
      await refreshAppUser();
      
      navigate('/');
    } catch (err: any) {
      setError('user id or password not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout login-layout">
      <div className="login-workspace">
        <div className="login-card">
          <div className="login-header">
            <div className="nav-brand" style={{ 
              margin: '0 auto 20px', 
              width: 48, 
              height: 48, 
              fontSize: 24, 
              background: 'linear-gradient(135deg, #7678ed, #ff7a55)', 
              color: 'white', 
              borderRadius: '14px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(118, 120, 237, 0.4)'
            }}>A</div>
            <h2>{isLogin ? 'Welcome back' : 'Create an account'}</h2>
            <p>{isLogin ? 'Enter your details to access your chats.' : 'Sign up to generate your unique Lobby ID.'}</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="form-group">
                <label>Display Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  placeholder="John Doe"
                />
              </div>
            )}
            
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                placeholder="you@example.com"
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            
            <button disabled={loading} type="submit" className="login-btn">
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="login-footer">
            {isLogin ? (
              <p>Don't have an account? <span onClick={() => setIsLogin(false)}>Sign up</span></p>
            ) : (
              <p>Already have an account? <span onClick={() => setIsLogin(true)}>Sign in</span></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
