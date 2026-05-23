import React, { useState, useEffect } from 'react';
import { FileText, X, RefreshCw, ExternalLink } from 'lucide-react';

interface NewsItem {
  title: string;
  source: string;
  link: string;
  og?: string; // image URL
  source_icon?: string;
}

interface NewsFeedResponse {
  [category: string]: NewsItem[];
}

interface NewsPanelProps {
  onClose?: () => void;
}

const FALLBACK_NEWS: NewsFeedResponse = {
  "World": [
    {
      title: "Global Summit Announces New Climate Action Plan Targeting Emissions",
      source: "Reuters",
      link: "https://reuters.com",
      og: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80"
    },
    {
      title: "Deep Sea Expedition Discovers 50 New Marine Species in Mariana Trench",
      source: "National Geographic",
      link: "https://nationalgeographic.com",
      og: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&w=300&q=80"
    }
  ],
  "Technology": [
    {
      title: "Google DeepMind Unveils Next-Gen AI Model Capable of Complex Coding",
      source: "TechCrunch",
      link: "https://techcrunch.com",
      og: "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=300&q=80"
    },
    {
      title: "Quantum Computing Hardware Achieves Landmark Coherence Milestones",
      source: "MIT Technology Review",
      link: "https://technologyreview.com",
      og: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=300&q=80"
    }
  ],
  "Science": [
    {
      title: "James Webb Space Telescope Captures Stunning View of Andromeda Nucleus",
      source: "NASA",
      link: "https://nasa.gov",
      og: "https://images.unsplash.com/photo-1464802686167-b939a6910659?auto=format&fit=crop&w=300&q=80"
    },
    {
      title: "Breakthrough Fusion Energy Reactor Sustains Net Gain for 5 Minutes",
      source: "Nature",
      link: "https://nature.com",
      og: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=300&q=80"
    }
  ]
};

const NewsPanel: React.FC<NewsPanelProps> = ({ onClose }) => {
  const [news, setNews] = useState<NewsFeedResponse>(FALLBACK_NEWS);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('World');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchNews = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://ok.surf/api/v1/cors/news-feed');
      if (!res.ok) throw new Error('Failed to fetch news');
      const data = await res.json();
      
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        setNews(data);
        const keys = Object.keys(data);
        if (!keys.includes(activeCategory) && keys.length > 0) {
          setActiveCategory(keys[0]);
        }
      } else {
        throw new Error('Invalid news data format');
      }
    } catch (err: any) {
      console.warn('Using fallback news due to fetch error:', err.message);
      setNews(FALLBACK_NEWS);
      setActiveCategory('World');
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const categories = Object.keys(news);
  const currentCategoryNews = news[activeCategory] || [];
  const totalItems = currentCategoryNews.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // Slice news items for the current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedNews = currentCategoryNews.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="friends-panel news-panel">
      <div className="settings-header">
        <div className="header-title-container">
          <FileText size={20} className="header-icon" style={{ color: 'var(--c-orange)' }} />
          <h2>World News</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="icon-btn" 
            onClick={fetchNews} 
            disabled={loading}
            title="Refresh Feed"
            style={{ background: 'var(--c-white-off)', padding: '6px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
          </button>
          {onClose && (
            <button className="close-btn" onClick={onClose} aria-label="Close news feed">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="settings-content" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: 'calc(100% - 65px)' }}>
        
        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          overflowX: 'auto',
          padding: '12px 16px',
          borderBottom: '1px solid var(--c-border)',
          gap: '8px',
          scrollbarWidth: 'none'
        }} className="no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: activeCategory === cat ? 'var(--c-orange)' : 'var(--c-white-off)',
                color: activeCategory === cat ? 'white' : 'var(--c-text-muted)',
                fontWeight: 500,
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* News Feed List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="news-list">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: 'var(--c-text-muted)' }}>
              <RefreshCw size={24} className="spin-animation" style={{ marginBottom: '8px' }} />
              <span style={{ fontSize: '13px' }}>Updating feed...</span>
            </div>
          ) : paginatedNews.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
              No stories available in this category.
            </p>
          ) : (
            paginatedNews.map((item, idx) => (
              <a 
                key={idx} 
                href={item.link} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--c-white-off)',
                  marginBottom: '12px',
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid transparent',
                  transition: 'all 0.2s',
                }}
                className="news-card-hover"
              >
                {item.og && (
                  <img 
                    src={item.og} 
                    alt={item.title} 
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      backgroundColor: 'var(--c-border)'
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 600, 
                      color: 'var(--c-orange)', 
                      backgroundColor: 'rgba(255, 122, 85, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      marginBottom: '6px'
                    }}>
                      {item.source}
                    </span>
                    <h3 style={{ 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      lineHeight: '1.4', 
                      color: 'var(--c-text-dark)',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.title}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--c-text-muted)', marginTop: '4px' }}>
                    Read Full Article <ExternalLink size={12} />
                  </div>
                </div>
              </a>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && currentCategoryNews.length > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid var(--c-border)',
            backgroundColor: 'var(--c-white)',
          }}>
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--c-border)',
                backgroundColor: currentPage === 1 ? 'var(--c-white-off)' : 'var(--c-white)',
                color: currentPage === 1 ? 'var(--c-text-muted)' : 'var(--c-text-dark)',
                fontSize: '12px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontWeight: 500
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '12px', color: 'var(--c-text-muted)', fontWeight: 500 }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--c-border)',
                backgroundColor: currentPage === totalPages ? 'var(--c-white-off)' : 'var(--c-white)',
                color: currentPage === totalPages ? 'var(--c-text-muted)' : 'var(--c-text-dark)',
                fontSize: '12px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontWeight: 500
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
      
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .news-card-hover:hover {
          border-color: rgba(255, 122, 85, 0.3) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default NewsPanel;
