import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { authAPI } from '../../services/api';

// Helper function to get available chat partners
const getAvailableChatPartners = async (userRole) => {
  try {
    if (userRole === 'admin') {
      // Admin can chat with doctors
      const response = await authAPI.getUsers({ role: 'doctor' });
      return response.users || [];
    } else if (userRole === 'doctor') {
      // Doctor can chat with admins
      const response = await authAPI.getUsers({ role: 'admin' });
      return response.users || [];
    }
    return [];
  } catch (error) {
    console.error('Error fetching chat partners:', error);
    return [];
  }
};

export default function MessagesListScreen({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      fetchUnreadCounts();
    }, [])
  );

  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      // Get messages based on user role
      let response;
      if (user.role === 'admin') {
        response = await authAPI.getDoctorMessages({ limit: 50 });
      } else if (user.role === 'doctor') {
        response = await authAPI.getAdminMessages({ limit: 50 });
      } else {
        // For patients, get general messages
        response = await authAPI.getMessages({ limit: 50 });
      }

      // Group messages by conversation partner
      const conversationsMap = new Map();
      
      response.messages?.forEach(message => {
        const isMyMessage = message.sender._id === user.id;
        const partner = isMyMessage ? message.recipient : message.sender;
        const partnerId = partner._id;
        
        if (!conversationsMap.has(partnerId)) {
          conversationsMap.set(partnerId, {
            partnerId,
            partnerName: `${partner.firstName} ${partner.lastName}`.trim(),
            partnerRole: partner.role,
            lastMessage: message.content,
            lastMessageTime: message.createdAt,
            unreadCount: 0,
            isMyLastMessage: isMyMessage
          });
        } else {
          const existing = conversationsMap.get(partnerId);
          // Keep the most recent message
          if (new Date(message.createdAt) > new Date(existing.lastMessageTime)) {
            existing.lastMessage = message.content;
            existing.lastMessageTime = message.createdAt;
            existing.isMyLastMessage = isMyMessage;
          }
        }
        
        // Count unread messages (messages sent to me that are unread)
        if (!isMyMessage && !message.isRead) {
          const existing = conversationsMap.get(partnerId);
          existing.unreadCount++;
        }
      });

      const conversationsList = Array.from(conversationsMap.values())
        .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

      setConversations(conversationsList);

    } catch (error) {
      console.error('Fetch conversations error:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      let response;
      if (user.role === 'admin') {
        response = await authAPI.getUnreadMessagesCount();
      } else if (user.role === 'doctor') {
        response = await authAPI.getDoctorUnreadMessagesCount();
      }
      
      if (response?.unreadCount) {
        // This could be enhanced to get per-conversation counts
        // For now, we calculate it in fetchConversations
      }
    } catch (error) {
      console.log('Fetch unread counts error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    await fetchUnreadCounts();
    setRefreshing(false);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h`;
    } else if (diffInHours < 168) { // Less than a week
      return `${Math.floor(diffInHours / 24)}d`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const openChat = (conversation) => {
    navigation.navigate('Chat', {
      recipientId: conversation.partnerId,
      recipientName: conversation.partnerName,
      recipientRole: conversation.partnerRole
    });
  };

  const startNewChat = async () => {
    try {
      const availablePartners = await getAvailableChatPartners(user.role);
      
      if (availablePartners.length === 0) {
        Alert.alert('No Available Users', `No ${user.role === 'admin' ? 'doctors' : 'admins'} available to chat with.`);
        return;
      }

      // If only one partner available, go directly to chat
      if (availablePartners.length === 1) {
        const partner = availablePartners[0];
        navigation.navigate('Chat', {
          recipientId: partner._id,
          recipientName: `${partner.firstName} ${partner.lastName}`,
          recipientRole: partner.role
        });
        return;
      }

      // Show selection dialog for multiple partners
      const partnerNames = availablePartners.map((partner, index) => ({
        text: `${partner.firstName} ${partner.lastName}`,
        onPress: () => navigation.navigate('Chat', {
          recipientId: partner._id,
          recipientName: `${partner.firstName} ${partner.lastName}`,
          recipientRole: partner.role
        })
      }));

      Alert.alert(
        'Start New Chat',
        `Select a ${user.role === 'admin' ? 'doctor' : 'admin'} to chat with:`,
        [
          ...partnerNames,
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to load available users');
    }
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => openChat(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <View style={[
          styles.avatar,
          { backgroundColor: item.partnerRole === 'admin' ? '#e74c3c' : '#2E86AB' }
        ]}>
          <Ionicons 
            name={item.partnerRole === 'admin' ? 'shield' : 'medical'} 
            size={24} 
            color="white" 
          />
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.partnerName}>{item.partnerName}</Text>
          <Text style={styles.lastMessageTime}>{formatTime(item.lastMessageTime)}</Text>
        </View>
        
        <View style={styles.lastMessageContainer}>
          <Text 
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.unreadMessage
            ]}
            numberOfLines={1}
          >
            {item.isMyLastMessage ? 'You: ' : ''}{item.lastMessage}
          </Text>
          {item.isMyLastMessage && (
            <Ionicons 
              name="checkmark-done" 
              size={16} 
              color="#4CAF50" 
              style={styles.readStatus}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        {user.role === 'admin' 
          ? 'Messages with doctors will appear here'
          : user.role === 'doctor'
          ? 'Messages with admins will appear here'
          : 'Your messages will appear here'
        }
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.partnerId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Floating Action Button to Start New Chat */}
      <TouchableOpacity
        style={styles.fab}
        onPress={startNewChat}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: 7,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#999',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  unreadMessage: {
    fontWeight: '600',
    color: '#333',
  },
  readStatus: {
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2E86AB',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
