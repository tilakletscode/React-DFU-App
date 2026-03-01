import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { logoutUser, fetchUserProfile } from '../../store/slices/authSlice';
import { apiUtils } from '../../services/api';

// Helper function to get account type label based on user role
const getAccountTypeLabel = (role) => {
  switch (role) {
    case 'doctor':
      return 'Doctor Account';
    case 'admin':
      return 'System Admin Account';
    case 'patient':
    default:
      return 'Patient Account';
  }
};

export default function ProfileScreen({ navigation }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);
  const { history } = useSelector((state) => state.prediction);

  useEffect(() => {
    // Fetch user profile when component mounts
    if (!user?.medicalInfo) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, user?.medicalInfo]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await dispatch(fetchUserProfile()).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh profile');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await dispatch(logoutUser());
          },
        },
      ]
    );
  };

  const navigateToMedicalInfo = () => {
    navigation.navigate('UserInfo');
  };

  const navigateToChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  // Server status check removed

  const showAbout = () => {
    Alert.alert(
      'About ML Ulcer Classification',
      'ML Ulcer Classification v1.0.0\n\nA medical image analysis application for ulcer classification using advanced machine learning.\n\nDeveloped for educational and screening purposes.',
      [{ text: 'OK' }]
    );
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.username?.[0]?.toUpperCase() || 'U';
  };

  const getAccountAge = () => {
    if (user?.createdAt) {
      const created = new Date(user.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now - created);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 30) {
        return `${diffDays} days`;
      } else if (diffDays < 365) {
        return `${Math.floor(diffDays / 30)} months`;
      } else {
        return `${Math.floor(diffDays / 365)} years`;
      }
    }
    return 'Unknown';
  };

  const getBMICategory = (bmi) => {
    if (!bmi) return '';
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Normal weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const getBMIColor = (bmi) => {
    if (!bmi) return '#666';
    if (bmi < 18.5) return '#FF9800'; // Orange
    if (bmi < 25) return '#4CAF50'; // Green
    if (bmi < 30) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const formatDuration = (duration) => {
    if (!duration) return 'Not specified';
    return duration === 1 ? '1 year' : `${duration} years`;
  };

  const formatAnswer = (value) => {
    if (value === null || value === undefined) return 'Not specified';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === 'yes') return 'Yes';
    if (value === 'no') return 'No';
    if (value === 'not_sure') return 'Not Sure';
    return value;
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getUserInitials()}</Text>
          </View>
          <View style={styles.patientBadgeIcon}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userUsername}>@{user?.username}</Text>
          <View style={styles.userDetails}>
            <Text style={styles.userDetail}>Age: {user?.age || 'Not specified'}</Text>
            <Text style={styles.userDetail}>Gender: {user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not specified'}</Text>
            <Text style={styles.userDetail}>Phone: {user?.phone || 'Not specified'}</Text>
          </View>
          <Text style={styles.patientBadge}>{getAccountTypeLabel(user?.role)}</Text>
        </View>
      </View>

      {/* Basic Statistics */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>📊 Statistics</Text>
        <View style={styles.statsGrid}>
          {/* Only show Member Since for Admin/Doctor, all stats for Patient */}
          {(user?.role === 'admin' || user?.role === 'doctor') ? (
            <View style={[styles.statItem, styles.singleStatItem]}>
              <Ionicons name="time" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{getAccountAge()}</Text>
              <Text style={styles.statLabel}>Member Since</Text>
            </View>
          ) : (
            <>
              <View style={styles.statItem}>
                <Ionicons name="analytics" size={24} color="#2E86AB" />
                <Text style={styles.statNumber}>{history.length}</Text>
                <Text style={styles.statLabel}>Total Scans</Text>
              </View>
              
              <View style={styles.statItem}>
                <Ionicons name="time" size={24} color="#4CAF50" />
                <Text style={styles.statNumber}>{getAccountAge()}</Text>
                <Text style={styles.statLabel}>Member Since</Text>
              </View>
              
              <View style={styles.statItem}>
                <Ionicons name="medical" size={24} color="#FF6B9D" />
                <Text style={styles.statNumber}>{user?.medicalInfoCompleted ? 'DONE' : 'PENDING'}</Text>
                <Text style={styles.statLabel}>Medical Info</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Physical Information - Only for patients */}
      {user?.role === 'patient' && (
        <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📏 Physical Information</Text>
          <TouchableOpacity onPress={navigateToMedicalInfo}>
            <Ionicons name="create-outline" size={20} color="#2E86AB" />
          </TouchableOpacity>
        </View>

        {user?.medicalInfo ? (
          <View style={styles.medicalInfoGrid}>
            <View style={styles.medicalInfoItem}>
              <Text style={styles.medicalInfoLabel}>Height</Text>
              <Text style={styles.medicalInfoValue}>
                {user.medicalInfo.height ? `${user.medicalInfo.height} cm` : 'Not specified'}
              </Text>
            </View>
            
            <View style={styles.medicalInfoItem}>
              <Text style={styles.medicalInfoLabel}>Weight</Text>
              <Text style={styles.medicalInfoValue}>
                {user.medicalInfo.weight ? `${user.medicalInfo.weight} kg` : 'Not specified'}
              </Text>
            </View>
            
            {user.medicalInfo.bmi && (
              <View style={[styles.medicalInfoItem, styles.bmiItem]}>
                <Text style={styles.medicalInfoLabel}>BMI</Text>
                <View style={styles.bmiContainer}>
                  <Text style={[styles.bmiValue, { color: getBMIColor(user.medicalInfo.bmi) }]}>
                    {user.medicalInfo.bmi}
                  </Text>
                  <Text style={[styles.bmiCategory, { color: getBMIColor(user.medicalInfo.bmi) }]}>
                    {getBMICategory(user.medicalInfo.bmi)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="information-circle-outline" size={40} color="#ccc" />
            <Text style={styles.emptyStateText}>No physical information available</Text>
            <TouchableOpacity style={styles.addInfoButton} onPress={navigateToMedicalInfo}>
              <Text style={styles.addInfoButtonText}>Add Information</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
      )}

      {/* Medical History - Only for patients */}
      {user?.role === 'patient' && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🩺 Medical History</Text>

        {user?.medicalInfo ? (
          <View style={styles.medicalHistoryList}>
            <View style={styles.medicalHistoryItem}>
              <Ionicons name="water-outline" size={20} color="#2196F3" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>Blood Sugar Level</Text>
                <Text style={styles.medicalHistoryValue}>
                  {user.medicalInfo.bloodSugarLevel ? `${user.medicalInfo.bloodSugarLevel} mg/dL` : 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.medicalHistoryItem}>
              <Ionicons name="analytics-outline" size={20} color="#9C27B0" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>HbA1C</Text>
                <Text style={styles.medicalHistoryValue}>
                  {user.medicalInfo.hba1c ? `${user.medicalInfo.hba1c}%` : 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.medicalHistoryItem}>
              <Ionicons name="time-outline" size={20} color="#FF9800" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>Duration of Diabetes</Text>
                <Text style={styles.medicalHistoryValue}>
                  {formatDuration(user.medicalInfo.diabetesDuration)}
                </Text>
              </View>
            </View>

            <View style={styles.medicalHistoryItem}>
              <Ionicons name="pulse-outline" size={20} color="#F44336" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>Duration of Hypertension</Text>
                <Text style={styles.medicalHistoryValue}>
                  {formatDuration(user.medicalInfo.hypertensionDuration)}
                </Text>
              </View>
            </View>

            <View style={styles.medicalHistoryItem}>
              <Ionicons name="warning-outline" size={20} color="#795548" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>Smoker</Text>
                <Text style={[
                  styles.medicalHistoryValue, 
                  user.medicalInfo.isSmoker === true && styles.riskText
                ]}>
                  {formatAnswer(user.medicalInfo.isSmoker)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No medical history available</Text>
          </View>
        )}
      </View>
      )}

      {/* Diabetic Foot History - Only for patients */}
      {user?.role === 'patient' && (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🦶 Diabetic Foot History</Text>
          <TouchableOpacity onPress={() => navigation.navigate('DiabeticFootHistory')}>
            <Ionicons name="create-outline" size={20} color="#2E86AB" />
          </TouchableOpacity>
        </View>

        {user?.diabeticFootHistory?.completed ? (
          <View style={styles.medicalHistoryList}>
            <TouchableOpacity 
              style={styles.footHistoryCard}
              onPress={() => navigation.navigate('DiabeticFootHistoryView')}
            >
              <View style={styles.footHistoryHeader}>
                <Ionicons name="medical" size={24} color="#2E86AB" />
                <Text style={styles.footHistoryTitle}>Assessment Completed</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>
              <Text style={styles.footHistorySubtitle}>
                Last updated: {new Date(user.diabeticFootHistory.lastUpdated).toLocaleDateString()}
              </Text>
              <Text style={styles.footHistoryAction}>Tap to view details</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="information-circle-outline" size={40} color="#ccc" />
            <Text style={styles.emptyStateText}>Diabetic foot assessment not completed</Text>
            <TouchableOpacity 
              style={styles.addInfoButton} 
              onPress={() => navigation.navigate('DiabeticFootHistory')}
            >
              <Text style={styles.addInfoButtonText}>Complete Assessment</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      )}

      {/* Health Conditions - Only for patients */}
      {user?.role === 'patient' && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>❤️ Health Conditions</Text>

        {user?.medicalInfo ? (
          <View style={styles.medicalHistoryList}>
            <View style={styles.medicalHistoryItem}>
              <Ionicons name="heart-outline" size={20} color="#E91E63" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>Cardiovascular Disease (CVD)</Text>
                <Text style={[
                  styles.medicalHistoryValue,
                  user.medicalInfo.hasCardiovascularDisease === 'yes' && styles.riskText
                ]}>
                  {formatAnswer(user.medicalInfo.hasCardiovascularDisease)}
                </Text>
              </View>
            </View>

            <View style={styles.medicalHistoryItem}>
              <Ionicons name="medical-outline" size={20} color="#3F51B5" />
              <View style={styles.medicalHistoryContent}>
                <Text style={styles.medicalHistoryLabel}>Chronic Kidney Disease (CKD)</Text>
                <Text style={[
                  styles.medicalHistoryValue,
                  user.medicalInfo.hasChronicKidneyDisease === 'yes' && styles.riskText
                ]}>
                  {formatAnswer(user.medicalInfo.hasChronicKidneyDisease)}
                </Text>
              </View>
            </View>

            {user.medicalInfo.additionalNotes && (
              <View style={styles.notesSection}>
                <Text style={styles.notesTitle}>Additional Notes</Text>
                <Text style={styles.notesText}>{user.medicalInfo.additionalNotes}</Text>
              </View>
            )}

            {user.medicalInfo.lastUpdated && (
              <View style={styles.lastUpdated}>
                <Text style={styles.lastUpdatedText}>
                  Last updated: {new Date(user.medicalInfo.lastUpdated).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No health conditions recorded</Text>
          </View>
        )}
      </View>
      )}

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications" size={20} color="#666" />
            <Text style={styles.settingText}>Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#ccc', true: '#2E86AB' }}
          />
        </View>

        {/* Server Status Check Removed */}

        {/* Update Medical Information - Only for patients */}
        {user?.role === 'patient' && (
          <TouchableOpacity style={styles.settingItem} onPress={navigateToMedicalInfo}>
            <View style={styles.settingLeft}>
              <Ionicons name="medical" size={20} color="#2E86AB" />
              <Text style={styles.settingText}>Update Medical Information</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.settingItem} onPress={navigateToChangePassword}>
          <View style={styles.settingLeft}>
            <Ionicons name="shield-checkmark" size={20} color="#e74c3c" />
            <Text style={styles.settingText}>Change Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Support</Text>
        
        <TouchableOpacity style={styles.settingItem} onPress={showAbout}>
          <View style={styles.settingLeft}>
            <Ionicons name="information-circle" size={20} color="#666" />
            <Text style={styles.settingText}>About</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle" size={20} color="#666" />
            <Text style={styles.settingText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="document-text" size={20} color="#666" />
            <Text style={styles.settingText}>Privacy Policy</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#F44336" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>ML Ulcer Classification v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  profileHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2E86AB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  patientBadgeIcon: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 24,
    height: 24,
    backgroundColor: '#2E86AB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
    marginLeft: 15,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#2E86AB',
    marginTop: 2,
  },
  userDetails: {
    flexDirection: 'row',
    marginTop: 4,
  },
  userDetail: {
    fontSize: 12,
    color: '#666',
    marginRight: 15,
  },
  patientBadge: {
    fontSize: 12,
    color: '#2E86AB',
    fontWeight: '600',
    marginTop: 4,
  },
  statsSection: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  singleStatItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 10,
    padding: 20,
  },
  medicalInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  medicalInfoItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  bmiItem: {
    width: '100%',
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  medicalInfoLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 5,
  },
  medicalInfoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  bmiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bmiValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  bmiCategory: {
    fontSize: 14,
    fontWeight: '600',
  },
  medicalHistoryList: {
    gap: 15,
  },
  medicalHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  medicalHistoryContent: {
    marginLeft: 15,
    flex: 1,
  },
  medicalHistoryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  medicalHistoryValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 2,
  },
  riskText: {
    color: '#F44336',
  },
  notesSection: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  lastUpdated: {
    alignItems: 'center',
    marginTop: 10,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    marginBottom: 15,
  },
  addInfoButton: {
    backgroundColor: '#2E86AB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addInfoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutSection: {
    backgroundColor: '#fff',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 12,
    color: '#999',
  },
  footHistoryCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2E86AB',
  },
  footHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  footHistoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginLeft: 10,
  },
  footHistorySubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  footHistoryAction: {
    fontSize: 14,
    color: '#2E86AB',
    fontWeight: '500',
  },
});