import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'react-native';
import { authAPI } from '../services/api';

export const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useSelector((state) => state.auth);

  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      const response = await authAPI.getUnreadMessageCount();
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      // Only log 429 errors once to avoid spam, handle other errors normally
      if (error?.response?.status === 429) {
        // Rate limited - reduce polling frequency temporarily
        console.log('Rate limited, reducing polling frequency temporarily');
        return;
      }
      console.error('Failed to fetch unread message count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for updates every 30 seconds (less aggressive to avoid rate limiting)
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Add a more aggressive refresh when screen focuses
  useEffect(() => {
    const handleAppStateChange = () => {
      fetchUnreadCount();
    };

    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [isAuthenticated]);

  return { unreadCount, loading, refreshUnreadCount: fetchUnreadCount };
};
