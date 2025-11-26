import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import UserProfileHeader from './UserProfileHeader';

function Header({ user, storageUsage, maxStorageGB = 50 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Error signing out');
    }
  };

  const storageMB = (storageUsage / (1024 * 1024)).toFixed(2);

  return (
    <header className="sticky top-0 z-50">
      <div id="header" className="relative py-4">
        <div className="glass-effect w-full h-full absolute -translate-y-4 z-0" data-scroll-animation="fade-down" data-scroll-progress="2" data-scroll-once="false"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4 max-w-7xl mx-auto px-4">
          <div>
            <img src="/src/assets/logo_white.png" alt="The Family Archive" className="w-14 h-14"
            onClick={() => navigate('/')} />
          </div>
          <nav className="">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex space-x-1 overflow-x-auto py-2">
                <button
                  onClick={() => navigate('/')}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    location.pathname === '/' 
                      ? 'bg-primary text-white' 
                      : 'text-white hover:bg-white hover:text-primary'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => navigate('/all-items')}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    location.pathname === '/all-items' 
                      ? 'bg-primary text-white' 
                      : 'text-white hover:bg-white hover:text-primary'
                  }`}
                >
                  View All (Cards)
                </button>
                <button
                  onClick={() => navigate('/people')}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    location.pathname === '/people' 
                      ? 'bg-primary text-white' 
                      : 'text-white hover:bg-white hover:text-primary'
                  }`}
                >
                  Related People
                </button>
                <button
                  onClick={() => navigate('/events')}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    location.pathname === '/events' 
                      ? 'bg-primary text-white' 
                      : 'text-white hover:bg-white hover:text-primary'
                  }`}
                >
                  Collections
                </button>
                <button
                  onClick={() => navigate('/sources')}
                  className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    location.pathname === '/sources' 
                      ? 'bg-primary text-white' 
                      : 'text-white hover:bg-white hover:text-primary'
                  }`}
                >
                  Sources
                </button>

                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                      location.pathname === '/admin' 
                        ? 'bg-purple-600 text-white' 
                        : 'text-purple-700 bg-purple-100 hover:bg-purple-200'
                    }`}
                  >
                    🛡️ Admin
                  </button>
                )}
              </div>
            </div>
          </nav>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <UserProfileHeader />
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-primary text-xs flex items-center gap-1 text-white uppercase rounded-lg font-semibold hover:bg-primary hover:text-white transition duration-300"
            >
              <img src="/src/assets/logout.svg" alt="Sign Out" className="w-5 h-5" /><span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      
    </header>
  );
}

export default Header;
