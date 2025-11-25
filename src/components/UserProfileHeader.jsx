import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function UserProfileHeader() {
  const navigate = useNavigate();
  const { user, userProfile, getDisplayName } = useAuth();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 group hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
        title="View Profile"
      >
        {userProfile?.photoURL ? (
          <img 
            src={userProfile.photoURL} 
            alt={getDisplayName(userProfile)} 
            className="w-8 h-8 rounded-full object-cover border-2 border-primary"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
            {(getDisplayName(userProfile) || user?.email || '?')[0].toUpperCase()}
          </div>
        )}
        <span className="text-white group-hover:text-primary font-medium hidden md:inline">
          {getDisplayName(userProfile)}
        </span>
      </button>
    </div>
  );
}

export default UserProfileHeader;
