import React from 'react';

const EchoStreamLogo: React.FC<{ size?: number; className?: string }> = ({ size = 44, className = '' }) => {
  return (
    <div 
      className={`echos-logo ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
      }}
    >
      <svg 
        width={size * 0.6} 
        height={size * 0.6} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M2 12h4l3-9 5 18 3-9h5" />
      </svg>
    </div>
  );
};

export default EchoStreamLogo;
