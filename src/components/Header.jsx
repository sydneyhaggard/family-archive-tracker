import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import UserProfileHeader from './UserProfileHeader';

function Header({ user, storageUsage, maxStorageGB = 50 }) {
  const navigate = useNavigate();

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
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 
            className="text-2xl font-bold text-primary cursor-pointer font-yrt-school" 
            onClick={() => navigate('/')}
          >
            Family Archive Tracker
          </h1>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <UserProfileHeader />
            <span className="text-sm text-gray-600 px-3 py-1.5 bg-gray-100 rounded-lg">
              Storage: {storageMB} MB / {maxStorageGB} GB
            </span>
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
