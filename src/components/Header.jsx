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
          <nav className="w-full max-w-3xl">
            <div className="max-w-7xl mx-auto px-4 w-full">
              <div className="flex overflow-x-auto justify-between w-full py-2">
                <button
                  onClick={() => navigate('/')}
                  className={`whitespace-nowrap transition-colors ${
                    location.pathname === '/' 
                      ? 'link small b-under' 
                      : 'link'
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => navigate('/all-items')}
                  className={`whitespace-nowrap transition-colors ${
                    location.pathname === '/all-items' 
                      ? 'link small b-under' 
                      : 'link'
                  }`}
                >
                  Archive
                </button>
                <button
                  onClick={() => navigate('/people')}
                  className={`whitespace-nowrap transition-colors ${
                    location.pathname === '/people' 
                      ? 'link small b-under' 
                      : 'link'
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => navigate('/events')}
                  className={`whitespace-nowrap transition-colors ${
                    location.pathname === '/events' 
                      ? 'link small b-under' 
                      : 'link'
                  }`}
                >
                  Collections
                </button>
                <button
                  onClick={() => navigate('/sources')}
                  className={`whitespace-nowrap transition-colors ${
                    location.pathname === '/sources' 
                      ? 'link small b-under' 
                      : 'link'
                  }`}
                >
                  Sources
                </button>

                
              </div>
            </div>
          </nav>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <UserProfileHeader />
            {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className={`link small ${
                      location.pathname === '/admin' 
                        ? 'border-b-2 border-teal text-white' 
                        : 'text-blacke-700'
                    }`}
                  >
                    <img className='w-6 h-6' 
                      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFCklEQVR4nO2aW4hWVRTHj5dPo5mmbNKiKTMzLyNhETOaQg8FPRT40E2CAqPe6sFISMyCsItZ42XsqctLEgU9dIEoku5kL00GFlh0H0uCIB0nZ3LUXyz9b9ocz9n7nPOdKaf8wzAf31p7XfY5a+211v6S5CT+BwAeBw5zPEaAlclYAdBPPj5LxgKANuAIMARM8L4/Td8PAxOTEx3AorydB34Qbe6/Y11y1IgLgHuAqRG+22XsCxm010W7KSJjKrACOL8O233BFwO7ZcSvwHUB3ifEd38G7VHRHgqsvxr4WXwWa7PqcmKW58Re/bd3fQMwOcXbAN4Vz/UZsm4R7U0/fkSbpE0w2YZ9njMX1enE+wrYVcBBffc50AnMBJ4CfvOy03E7abHh0ffI8A5gDtDnpejVShofNu0McF7KiRaP1gV8LdqQlBsOAe8BtwXk3gl84u28ZbFBff4WWOjxtqac6ajiiAvaA8CZGXRT8px49gPrgLNLJo8tcsTwvD2FDL522WBYXsWRFuArCXgywLfAlJVW8Pf6Dv8ppAH0yIZd/ltRCsDligcrN65K/mEAV0r3SMjZosIe1I7sznrFRgvAGcCP0r2mDoETge0S+HItVhbT+6J0fpxO1c2mYRdwl9UiNKxviZdEZtYpeI5S6wAwpQD/fGAj8IVS66A+23fzC6yfrtg8UCYTFnHkGe3Q2gjfJKVUczoPRus13oisp8X/cF1OnKJy4WAozcqJbd4huQnoVhq3v4XAZu/c2BZyBpgtPgv48VUMPx24Qiew1VMfSeBbkXX2JAw/AZdEzh3XePVGZO4Q39vAeh3S3VkHp79oXaCzs3LixkhMHNKTyHUi5cyw1nQG+O4KvKK2YY9lLXI99h/ApyoZrEBcasEXMcyC2LAx5oS3xuLEsKFAC3GDtQVKyTu0YYbDWQscSuds4Eut7SqxxmLGsLPi2XYUWUSHcRUEW743tJZYY0WnYaCCvnHO2LodGajgiPUbhn2j5UhbE69Wd4UhRZVXqy3kyIiXoazBedUOQBsUxLozL9g3lzDGpeueCN9cYBnwCPAa8J3XlI1kLVhpIxzvwPJhC28ukH5t7YICTlwK/Fkg/d5NNoZl672xjNDp7cI7BQ9El077Q87ICddCbyp4IL7hvR3zKg34VKLsVYlyVoCv4ZUow3JskbJTq6qFLXoSiLcxaiVKMwWc6q3eSNE4ojqsUVDn2qQuaHfKlvFWp+3UGbNfn3tCMeFgE0avjJ+W1AUZ5sqCaC1Vg77F0mV9zOy6hE7WIM7wbC1Ci+ndKp19sd6lqEB7nw3f2KSxFiuL6W31hoDrmxV2jc6Q5scx1fR3KVbMhmurCpmm+azhvoiy3LRccEC3OEBfLRt+iV1p5AmwuxDD7zmjzCneyGZQ94bnlJA/Q4NvV0m8lJURVVe5W4AVVRyZ7nWMH/iVre4w+r1GzB9i28D71oDcOzKG2K4N6DfZqTgx3a4jrHbxY8Viypl2nQWum9wungt1ELprBTNyRs58zGGP+vBzJcMNAd3dS3vKiabvSHxn3FliAbgm47Km4SlfmiHLaiU3TEivnQA84N29DNV20ZO6Avhegq3EXxLgtd00rMqgWeEXLDs4ljx21X71lsouy4FTI3w2RjJszaC9ItqyiIwWjX7KX+yMQnnRl0GzpsgwLznRwbEB3xFls/Fj9gcDBq9xGrs/4fCmlnk/qslvT08i+e/gLx6eFfRUEBkkAAAAAElFTkSuQmCC" alt="settings--v1">
                    </img> 
                    
                  </button>
                )}
            <button
              onClick={handleSignOut}
              className="link small"
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
