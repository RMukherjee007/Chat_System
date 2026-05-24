import React, { useState, useEffect, useRef } from 'react';
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
  
  // Parallax effect state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Doodle physics state
  const doodlePhysics = useRef([
    { x: 100, y: 100, vx: 1.5, vy: 1.2, width: 100, height: 100, type: 1, baseVx: 1.5, baseVy: 1.2 },
    { x: 300, y: 200, vx: -1.8, vy: 1.5, width: 100, height: 100, type: 2, baseVx: -1.8, baseVy: 1.5 },
    { x: 200, y: 400, vx: 1.2, vy: -1.7, width: 100, height: 100, type: 3, baseVx: 1.2, baseVy: -1.7 }
  ]);
  const [, setRenderTrigger] = useState(0);

  const navigate = useNavigate();
  const { refreshAppUser } = useAuth();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20; // max 20px movement
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    let animationFrameId: number;
    let lastTime = performance.now();
    
    const animateDoodles = (time: number) => {
      const dt = (time - lastTime) / 16;
      lastTime = time;
      
      const bounds = heroRef.current?.getBoundingClientRect() || { width: 800, height: 800 };
      
      doodlePhysics.current.forEach(d => {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        
        // Bounce X
        if (d.x <= 0) { d.x = 0; d.vx = Math.abs(d.baseVx); }
        else if (d.x + d.width >= bounds.width) { d.x = bounds.width - d.width; d.vx = -Math.abs(d.baseVx); }
        
        // Bounce Y
        if (d.y <= 0) { d.y = 0; d.vy = Math.abs(d.baseVy); }
        else if (d.y + d.height >= bounds.height) { d.y = bounds.height - d.height; d.vy = -Math.abs(d.baseVy); }
      });
      
      setRenderTrigger(prev => prev + 1);
      animationFrameId = requestAnimationFrame(animateDoodles);
    };
    
    animationFrameId = requestAnimationFrame(animateDoodles);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
      if (err.message && err.message.includes('auth/email-already-in-use')) {
        setError('Account already created');
      } else {
        setError(isLogin ? 'user id or password not found' : 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-login-container">
      {/* Interactive Background Section */}
      <div className="login-hero" ref={heroRef} style={{ position: 'relative', overflow: 'hidden' }}>
        <div 
          className="parallax-bg"
          style={{
            transform: `translate(${mousePos.x}px, ${mousePos.y}px) scale(1.05)`,
            backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`
          }}
        />
        
        {/* Floating Doodles */}
        <div className="doodles-container">
          {doodlePhysics.current.map((d, i) => {
             const px = d.x + (mousePos.x * (i % 2 === 0 ? -1.5 : 0.8));
             const py = d.y + (mousePos.y * (i % 2 === 0 ? -1.5 : 0.8));
             
             if (d.type === 1) return (
              <svg key={i} className="doodle doodle-1" style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${px}px, ${py}px)` }} width="100" height="100" viewBox="0 0 100 100" fill="none">
                <path d="M50 10C72 10 90 28 90 50C90 72 72 90 50 90C28 90 10 72 10 50C10 28 28 10 50 10Z" stroke="rgba(255,255,255,0.2)" strokeWidth="4" strokeDasharray="10 10"/>
              </svg>
             );
             if (d.type === 2) return (
              <svg key={i} className="doodle doodle-2" style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${px}px, ${py}px)` }} width="100" height="100" viewBox="0 0 100 100" fill="none">
                <rect x="20" y="20" width="60" height="60" rx="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" transform="rotate(15 50 50)"/>
              </svg>
             );
             return (
              <svg key={i} className="doodle doodle-3" style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${px}px, ${py}px)` }} width="100" height="100" viewBox="0 0 100 100" fill="none">
                <path d="M10 50L50 10L90 50L50 90Z" stroke="rgba(255,255,255,0.15)" strokeWidth="5"/>
              </svg>
             );
          })}
        </div>

        <div className="hero-content">
          <h1>Welcome to EchoStream</h1>
          <p>The next-generation chat platform for teams and friends to connect seamlessly.</p>
        </div>
      </div>

      {/* Login Form Section */}
      <div className="login-sidebar">
        <div className={`login-card ${error ? 'shake-disapproval' : ''}`}>
          <div className="login-header">
            <h2>{isLogin ? 'Welcome back' : 'Create an account'}</h2>
            <p>{isLogin ? 'We\'re so excited to see you again!' : 'Join our vibrant community today.'}</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <div className="form-group">
                <label>DISPLAY NAME <span style={{color: 'var(--c-danger)'}}>*</span></label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>
            )}
            
            <div className="form-group">
              <label>EMAIL <span style={{color: 'var(--c-danger)'}}>*</span></label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>
            
            <div className="form-group">
              <label>PASSWORD <span style={{color: 'var(--c-danger)'}}>*</span></label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>
            
            <button disabled={loading} type="submit" className="login-btn">
              {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>
          </form>

          <div className="login-footer">
            {isLogin ? (
              <p>Need an account? <span onClick={() => setIsLogin(false)}>Register</span></p>
            ) : (
              <p>Already have an account? <span onClick={() => setIsLogin(true)}>Log in</span></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
