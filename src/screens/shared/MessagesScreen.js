import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { authAPI } from '../../services/api';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

export default function MessagesScreen({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const { refreshUnreadCount } = useUnreadMessages();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // For admin-doctor messaging
  const [doctorConversations, setDoctorConversations] = useState([]);
  const [sendMessageModalVisible, setSendMessageModalVisible] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      if (user?.role === 'admin') {
        // Fetch admin-doctor conversations
        const response = await authAPI.getDoctorMessages();
        setDoctorConversations(response.conversations || []);
      } else {
        // Fetch regular messages (for patients and doctors)
        const response = await authAPI.getMessages();
        setMessages(response.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

  const handleMarkAsRead = async (messageId, message) => {
    // Debug logging
    console.log('Attempting to mark message as read:', {
      messageId,
      messageType: message?.messageType,
      senderId: message?.sender?._id,
      recipientId: message?.recipient?._id,
      currentUserId: user?._id,
      isOwnMessage: message?.sender?._id === user?._id
    });
    
    // Don't try to mark messages as read if the current user sent them
    if (message && message.sender && message.sender._id === user?._id) {
      console.log('Skipping - Cannot mark own sent message as read');
      return;
    }
    
    // Skip if this is a doctor_to_admin message and current user is a doctor (they sent it)
    if (user?.role === 'doctor' && message?.messageType === 'doctor_to_admin' && message?.sender?._id === user?._id) {
      console.log('Skipping - Doctor cannot mark their own doctor_to_admin message as read');
      return;
    }
    
    // Only allow marking messages TO the current user as read
    if (message && message.recipient && message.recipient._id !== user?._id) {
      console.log('Skipping - Message not addressed to current user');
      return;
    }
    
    try {
      await authAPI.markMessageAsRead(messageId);
      
      // Update local state immediately to show read status
      setMessages(prevMessages => 
        prevMessages.map(msg => 
          msg._id === messageId ? { ...msg, isRead: true } : msg
        )
      );
      
      refreshUnreadCount(); // Refresh unread count immediately
      
      // Additional delayed refresh to ensure backend sync
      setTimeout(() => {
        refreshUnreadCount();
      }, 300);
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  // Doctor sends message to all admins
  const handleSendMessageToAdmins = async () => {
    if (!newMessage.trim()) {
      Alert.alert('Error', 'Please enter a message');
      return;
    }

    try {
      await authAPI.sendMessageToAdmins(newMessage.trim());
      Alert.alert('Success', 'Message sent to all administrators');
      setNewMessage('');
      setSendMessageModalVisible(false);
      fetchMessages(); // Refresh to show sent message
      refreshUnreadCount(); // Refresh unread count to clear any false indicators
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  // Mark all unread messages in a conversation as read
  const markConversationAsRead = async (conversation) => {
    if (!conversation || !conversation.messages) return;
    
    try {
      // Find unread messages from doctor to admin
      const unreadMessages = conversation.messages.filter(msg => 
        msg.messageType === 'doctor_to_admin' && !msg.isRead
      );
      
      // Mark each unread message as read
      for (const message of unreadMessages) {
        await authAPI.markMessageAsRead(message._id);
      }
      
      if (unreadMessages.length > 0) {
        // Refresh data to show updated status
        fetchMessages();
        refreshUnreadCount();
      }
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  };

  // Admin replies to specific doctor
  const handleReplyToDoctor = async () => {
    if (!replyMessage.trim() || !selectedDoctor) {
      Alert.alert('Error', 'Please enter a reply message');
      return;
    }

    try {
      await authAPI.replyToDoctor(selectedDoctor.doctorId, replyMessage.trim());
      
      // Mark all messages in this conversation as read before closing
      await markConversationAsRead(selectedDoctor);
      
      Alert.alert('Success', 'Reply sent successfully');
      setReplyMessage('');
      setReplyModalVisible(false);
      setSelectedDoctor(null);
      fetchMessages(); // Refresh conversations
      
      // Additional refresh after a short delay to ensure backend is synced
      setTimeout(() => {
        refreshUnreadCount();
      }, 500);
    } catch (error) {
      Alert.alert('Error', 'Failed to send reply');
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  // Render content based on user role
  const renderContent = () => {
    if (user?.role === 'admin') {
      return renderAdminView();
    } else if (user?.role === 'doctor') {
      return renderDoctorView();
    } else {
      return renderPatientView();
    }
  };

  const renderPatientView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {messages.filter(m => !m.isRead).length} unread messages
        </Text>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Messages from doctors will appear here
          </Text>
        </View>
      ) : (
        <View style={styles.messagesContainer}>
          {messages.map((message) => (
            <TouchableOpacity
              key={message._id}
              style={[
                styles.messageCard,
                !message.isRead && styles.unreadMessage
              ]}
              onPress={() => handleMarkAsRead(message._id, message)}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.senderName}>
                  Dr. {message.sender?.firstName || message.sender?.name?.split(' ')[0] || 'Unknown'} {message.sender?.lastName || message.sender?.name?.split(' ')[1] || ''}
                </Text>
                <Text style={styles.messageDate}>
                  {new Date(message.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.messageText}>{message.content || message.message}</Text>
              <View style={styles.messageFooter}>
                <Text style={styles.messageTime}>
                  {new Date(message.createdAt).toLocaleString()}
                </Text>
                {message.isRead && (
                  <View style={styles.readStatus}>
                    <Ionicons name="checkmark-done" size={16} color="#4CAF50" />
                    <Text style={styles.readText}>Seen</Text>
                  </View>
                )}
              </View>
              {!message.isRead && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>NEW</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  const renderDoctorView = () => {
    // Filter out messages that the doctor sent themselves from unread count
    const actualUnreadMessages = messages.filter(m => 
      !m.isRead && 
      !(m.messageType === 'doctor_to_admin' && m.sender?._id === user?._id)
    );
    
    return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {actualUnreadMessages.length > 0 
            ? `${actualUnreadMessages.length} unread message${actualUnreadMessages.length > 1 ? 's' : ''}`
            : 'Patient messages & Admin communications'
          }
        </Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setSendMessageModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.headerButtonText}>Message Admins</Text>
        </TouchableOpacity>
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Patient messages and admin communications will appear here
          </Text>
        </View>
      ) : (
        <View style={styles.messagesContainer}>
          {messages.map((message) => {
            // Check if this is the doctor's own sent message
            const isOwnSentMessage = message.messageType === 'doctor_to_admin' && message.sender?._id === user?._id;
            
            return (
            <TouchableOpacity
              key={message._id}
              style={[
                styles.messageCard,
                !message.isRead && !isOwnSentMessage && styles.unreadMessage
              ]}
              onPress={() => handleMarkAsRead(message._id, message)}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.senderName}>
                  {message.messageType === 'admin_to_doctor' 
                    ? `Admin: ${message.sender?.firstName} ${message.sender?.lastName}`
                    : message.messageType === 'doctor_to_admin'
                    ? `You → All Admins`
                    : `Patient: ${message.sender?.firstName} ${message.sender?.lastName}`
                  }
                </Text>
                <Text style={styles.messageDate}>
                  {new Date(message.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.messageText}>{message.content || message.message}</Text>
              <View style={styles.messageFooter}>
                <Text style={styles.messageType}>
                  {message.messageType === 'admin_to_doctor' 
                    ? '💼 Admin Reply'
                    : message.messageType === 'doctor_to_admin'
                    ? '📤 Sent to Admins'
                    : '👤 Patient Message'
                  }
                </Text>
              </View>
              {!message.isRead && !isOwnSentMessage && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>NEW</Text>
                </View>
              )}
            </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
    );
  };

  const renderAdminView = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Doctor Communications</Text>
        <Text style={styles.headerSubtitle}>
          Messages from doctors requiring attention
        </Text>
      </View>

      {doctorConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="medical-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No doctor messages</Text>
          <Text style={styles.emptySubtext}>
            Messages from doctors will appear here
          </Text>
        </View>
      ) : (
        <View style={styles.messagesContainer}>
          {doctorConversations.map((conversation) => (
            <TouchableOpacity
              key={conversation.doctorId}
              style={[
                styles.messageCard,
                conversation.unreadCount > 0 && styles.unreadMessage
              ]}
              onPress={() => {
                setSelectedDoctor(conversation);
                setReplyModalVisible(true);
                // Mark unread messages in this conversation as read
                markConversationAsRead(conversation);
              }}
            >
              <View style={styles.messageHeader}>
                <Text style={styles.senderName}>
                  Dr. {conversation.doctorName}
                </Text>
                <Text style={styles.messageDate}>
                  {new Date(conversation.latestMessage.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.messageText}>
                {conversation.latestMessage.message}
              </Text>
              <Text style={styles.messageCount}>
                {conversation.messages.length} message(s)
              </Text>
              {conversation.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderContent()}
      </ScrollView>

      {/* Send Message to Admins Modal (Doctor only) */}
      <Modal
        visible={sendMessageModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Message All Admins</Text>
              <TouchableOpacity onPress={() => setSendMessageModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.messageInput}
              placeholder="Enter your message to administrators..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setSendMessageModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendMessageToAdmins}
              >
                <Text style={styles.sendButtonText}>Send Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reply to Doctor Modal (Admin only) */}
      <Modal
        visible={replyModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Reply to Dr. {selectedDoctor?.doctorName}
              </Text>
              <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedDoctor && selectedDoctor.messages && (
              <ScrollView style={styles.conversationPreview} showsVerticalScrollIndicator={false}>
                <Text style={styles.conversationTitle}>Conversation Thread:</Text>
                {selectedDoctor.messages
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) // Sort oldest first
                  .map((msg, index) => (
                    <View key={index} style={[
                      styles.conversationMessage,
                      msg.messageType === 'admin_to_doctor' ? styles.adminMessage : styles.doctorMessage
                    ]}>
                      <Text style={styles.messageRole}>
                        {msg.messageType === 'admin_to_doctor' ? '👤 You:' : '🩺 Doctor:'}
                      </Text>
                      <Text style={styles.conversationMessageText}>
                        {msg.message}
                      </Text>
                      <Text style={styles.messageTime}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  ))
                }
              </ScrollView>
            )}
            
            <TextInput
              style={styles.messageInput}
              placeholder="Enter your reply..."
              value={replyMessage}
              onChangeText={setReplyMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setReplyModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleReplyToDoctor}
              >
                <Text style={styles.sendButtonText}>Send Reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2E86AB',
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  messagesContainer: {
    padding: 15,
  },
  messageCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadMessage: {
    borderLeftWidth: 4,
    borderLeftColor: '#2E86AB',
    backgroundColor: '#f8f9ff',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  messageDate: {
    fontSize: 12,
    color: '#666',
  },
  messageText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  unreadBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  headerButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  messageCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 120,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  sendButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#2E86AB',
    marginLeft: 10,
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  conversationPreview: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    maxHeight: 250, // Limit height and make scrollable
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  conversationMessage: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  doctorMessage: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196f3',
  },
  adminMessage: {
    backgroundColor: '#fff3e0',
    borderLeftColor: '#ff9800',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  conversationMessageText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  messageTime: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  originalMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  messageFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  readStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readText: {
    fontSize: 11,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  messageType: {
    fontSize: 11,
    color: '#666',
    fontWeight: 'bold',
  },
});
