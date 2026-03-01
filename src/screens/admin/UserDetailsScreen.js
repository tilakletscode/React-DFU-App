import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../services/api';
import FullScreenImageViewer from '../../components/FullScreenImageViewer';
import ScanResultDisplay from '../../components/ScanResultDisplay';

// Helper function to get proper image URI
const getImageUri = (imagePath) => {
  if (!imagePath) return null;
  
  console.log('📸 Processing image path:', imagePath.substring(0, 50));
  
  // If it already starts with data: URI, use it directly
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // If it looks like base64 (long string without slashes), format as data URI
  if (imagePath.length > 100 && !imagePath.includes('/') && !imagePath.includes('http')) {
    return `data:image/jpeg;base64,${imagePath}`;
  }
  
  // If it's a URL or file path, use it directly
  if (imagePath.startsWith('http') || imagePath.startsWith('file://')) {
    return imagePath;
  }
  
  // Default: treat as base64
  return `data:image/jpeg;base64,${imagePath}`;
};

// Component to handle image display with fallback
const ImageWithFallback = ({ imagePath, style }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (imageError) {
    return (
      <View style={[style, styles.imageFallback]}>
        <Ionicons name="image-outline" size={50} color="#ccc" />
        <Text style={styles.fallbackText}>Image not available</Text>
      </View>
    );
  }

  return (
    <View>
      {imageLoading && (
        <View style={[style, styles.imageLoading]}>
          <ActivityIndicator size="large" color="#2E86AB" />
          <Text style={styles.loadingText}>Loading image...</Text>
        </View>
      )}
      <Image 
        source={{ uri: getImageUri(imagePath) }}
        style={[style, imageLoading && { opacity: 0 }]}
        resizeMode="contain"
        onError={(error) => {
          console.error('📸 Image load error:', error.nativeEvent.error);
          console.log('📸 Failed image URI:', getImageUri(imagePath));
          console.log('📸 Original image path:', imagePath);
          setImageError(true);
          setImageLoading(false);
        }}
        onLoad={() => {
          console.log('📸 Image loaded successfully');
          setImageLoading(false);
        }}
        onLoadStart={() => {
          console.log('📸 Image loading started');
          setImageLoading(true);
        }}
      />
    </View>
  );
};

// Helper function to format duration with time indication
const formatDuration = (duration) => {
  if (!duration && duration !== 0) return 'Not specified';
  
  // Convert to string if it's a number
  const durationStr = String(duration);
  
  // If the duration already contains time units, return as is
  if (durationStr.toLowerCase().includes('year') || 
      durationStr.toLowerCase().includes('month') || 
      durationStr.toLowerCase().includes('day') ||
      durationStr.toLowerCase().includes('week')) {
    return durationStr;
  }
  
  // If it's just a number, try to format it intelligently
  const numericValue = parseFloat(durationStr);
  if (!isNaN(numericValue)) {
    if (numericValue < 1) {
      return `${numericValue} months`;
    } else if (numericValue >= 1 && numericValue < 24) {
      return `${numericValue} ${numericValue === 1 ? 'year' : 'years'}`;
    } else {
      return `${numericValue} months`;
    }
  }
  
  // If it contains numbers, try to extract and format
  const numberMatch = durationStr.match(/(\d+\.?\d*)/);
  if (numberMatch) {
    const num = parseFloat(numberMatch[1]);
    const remainingText = durationStr.replace(numberMatch[1], '').trim();
    
    if (remainingText) {
      return `${num} ${remainingText}`;
    } else {
      // Default assumption: if just a number, it's probably years
      return `${num} ${num === 1 ? 'year' : 'years'}`;
    }
  }
  
  // Return as is if can't parse
  return durationStr;
};

// Helper function to format diabetic foot ulcer duration
const formatUlcerDuration = (value) => {
  if (!value) return 'Not specified';
  
  // Map the stored values back to readable text
  switch (value) {
    case '0': return 'No ulcer';
    case '0.5': return 'Less than 1 month';
    case '1.5': return '1-2 months';
    case '4.5': return '3-6 months';
    case '9': return '6-12 months';
    case '15': return 'More than a year';
    default: 
      // If it's a number, format with time unit
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        if (numericValue < 1) {
          return `${value} months`;
        } else if (numericValue === 1) {
          return `${value} month`;
        } else {
          return `${value} months`;
        }
      }
      return value; // fallback for any other values
  }
};

export default function UserDetailsScreen({ route, navigation }) {
  const { userId } = route.params;
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editData, setEditData] = useState({});
  const [updating, setUpdating] = useState(false);
  const [editTab, setEditTab] = useState('basic'); // 'basic' or 'medical'
  const [fullScreenImage, setFullScreenImage] = useState({
    visible: false,
    imageSource: null,
    patientName: '',
    predictionClass: ''
  });

  useEffect(() => {
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUserDetails(userId);
      setUserDetails(response);
      setEditData({
        // Basic info
        firstName: response.user.firstName,
        lastName: response.user.lastName,
        email: response.user.email,
        age: response.user.age.toString(),
        gender: response.user.gender,
        role: response.user.role,
        isVerified: response.user.isVerified,
        // Medical info
        height: response.user.medicalInfo?.height?.toString() || '',
        weight: response.user.medicalInfo?.weight?.toString() || '',
        bloodSugarLevel: response.user.medicalInfo?.bloodSugarLevel || '',
        hba1c: response.user.medicalInfo?.hba1c || '',
        diabetesDuration: response.user.medicalInfo?.diabetesDuration || '',
        hypertensionDuration: response.user.medicalInfo?.hypertensionDuration || '',
        isSmoker: response.user.medicalInfo?.isSmoker || false,
        hasCardiovascularDisease: response.user.medicalInfo?.hasCardiovascularDisease || '',
        hasChronicKidneyDisease: response.user.medicalInfo?.hasChronicKidneyDisease || '',
        additionalNotes: response.user.medicalInfo?.additionalNotes || '',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch user details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserDetails();
    setRefreshing(false);
  };

  const handleActivateDeactivate = async () => {
    if (!userDetails?.user) {
      Alert.alert('Error', 'User data not available');
      return;
    }
    
    const currentUser = userDetails.user;
    const isCurrentlyActive = currentUser.isActive !== false; // Default to true if undefined
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    const actionTitle = isCurrentlyActive ? 'Deactivate Account' : 'Activate Account';
    
    console.log('Current user active status:', isCurrentlyActive);
    console.log('User data:', currentUser);
    
    Alert.alert(
      actionTitle,
      `Are you sure you want to ${action} this account? ${isCurrentlyActive ? 'The user will not be able to login until reactivated.' : 'The user will be able to login normally.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              console.log('Updating user status to:', !isCurrentlyActive);
              const response = await authAPI.updateUserStatus(userId, !isCurrentlyActive);
              console.log('Update response:', response);
              Alert.alert('Success', `Account ${action}d successfully`);
              fetchUserDetails(); // Refresh the data
            } catch (error) {
              console.error('Update user status error:', error);
              Alert.alert('Error', `Failed to ${action} account: ${error.message || 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const openFullScreenImage = (imageSource, patientName, predictionClass) => {
    setFullScreenImage({
      visible: true,
      imageSource,
      patientName,
      predictionClass
    });
  };

  const closeFullScreenImage = () => {
    setFullScreenImage({
      visible: false,
      imageSource: null,
      patientName: '',
      predictionClass: ''
    });
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account? This action cannot be undone and will remove all associated data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.deleteUser(userId);
              Alert.alert('Success', 'Account deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account');
            }
          }
        }
      ]
    );
  };

  const handleUpdateUser = async () => {
    try {
      setUpdating(true);
      
      // Prepare user data
      const userData = {
        firstName: editData.firstName,
        lastName: editData.lastName,
        email: editData.email,
        age: parseInt(editData.age),
        gender: editData.gender,
        role: editData.role,
        medicalInfo: {
          height: editData.height ? parseFloat(editData.height) : null,
          weight: editData.weight ? parseFloat(editData.weight) : null,
          bmi: editData.height && editData.weight ? 
            (parseFloat(editData.weight) / Math.pow(parseFloat(editData.height)/100, 2)).toFixed(1) : null,
          bloodSugarLevel: editData.bloodSugarLevel,
          hba1c: editData.hba1c,
          diabetesDuration: editData.diabetesDuration,
          hypertensionDuration: editData.hypertensionDuration,
          isSmoker: editData.isSmoker,
          hasCardiovascularDisease: editData.hasCardiovascularDisease,
          hasChronicKidneyDisease: editData.hasChronicKidneyDisease,
          additionalNotes: editData.additionalNotes,
          lastUpdated: new Date(),
        }
      };
      
      await authAPI.updateUser(userId, userData);
      setEditModalVisible(false);
      setEditTab('basic'); // Reset to basic tab
      await fetchUserDetails();
      Alert.alert('Success', 'User details updated successfully');
    } catch (error) {
      console.error('Update user error:', error);
      Alert.alert('Error', 'Failed to update user details');
    } finally {
      setUpdating(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#e74c3c';
      case 'doctor': return '#3498db';
      case 'patient': return '#2ecc71';
      default: return '#95a5a6';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return 'shield';
      case 'doctor': return 'medical';
      case 'patient': return 'person';
      default: return 'person';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e74c3c" />
        <Text style={styles.loadingText}>Loading user details...</Text>
      </View>
    );
  }

  if (!userDetails) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#e74c3c" />
        <Text style={styles.errorText}>Failed to load user details</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { user, predictions = [], messages = [], stats = {} } = userDetails;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* User Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.userMeta}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
              <Ionicons name={getRoleIcon(user.role)} size={16} color="white" />
              <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: (user.isActive !== false) ? '#27ae60' : '#e67e22' }
            ]}>
              <Text style={styles.statusText}>
                {(user.isActive !== false) ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setEditModalVisible(true)}
        >
          <Ionicons name="create" size={20} color="#3498db" />
          <Text style={styles.actionButtonText}>Edit Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: (user.isActive !== false) ? '#e67e22' : '#27ae60' }]}
          onPress={handleActivateDeactivate}
        >
          <Ionicons 
            name={(user.isActive !== false) ? 'lock-closed' : 'lock-open'} 
            size={20} 
            color="white" 
          />
          <Text style={[styles.actionButtonText, { color: 'white' }]}>
            {(user.isActive !== false) ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
          onPress={handleDeleteAccount}
        >
          <Ionicons name="trash" size={20} color="white" />
          <Text style={[styles.actionButtonText, { color: 'white' }]}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalPredictions || 0}</Text>
          <Text style={styles.statLabel}>Total Scans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.unreadMessages || 0}</Text>
          <Text style={styles.statLabel}>Unread Messages</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{user.age}</Text>
          <Text style={styles.statLabel}>Age</Text>
        </View>
      </View>

      {/* User Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.detailCard}>
          <DetailRow label="Full Name" value={`${user.firstName || user.name || 'N/A'} ${user.lastName || ''}`.trim()} />
          <DetailRow label="Username" value={user.username || 'N/A'} />
          <DetailRow label="Email" value={user.email || 'N/A'} />
          <DetailRow label="Phone Number" value={user.phone || 'Not provided'} />
          <DetailRow label="Age" value={user.age ? `${user.age} years` : 'N/A'} />
          <DetailRow label="Gender" value={user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'N/A'} />
          <DetailRow label="Role" value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'} />
          <DetailRow label="Account Status" value={user.isActive !== false ? 'Active' : 'Inactive'} />
          <DetailRow label="Email Verified" value={user.emailVerified ? 'Yes' : 'No'} />
          <DetailRow label="Phone Verified" value={user.phoneVerified ? 'Yes' : 'No'} />
          <DetailRow label="Joined Date" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'} />
          {user.lastLogin && (
            <DetailRow label="Last Login" value={new Date(user.lastLogin).toLocaleDateString()} />
          )}
          {user.updatedAt && (
            <DetailRow label="Last Updated" value={new Date(user.updatedAt).toLocaleDateString()} />
          )}
        </View>
      </View>

      {/* Professional Information (for doctors) */}
      {user.role === 'doctor' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Information</Text>
          <View style={styles.detailCard}>
            <DetailRow label="Specialization" value={user.specialization || 'Not specified'} />
            <DetailRow label="License Number" value={user.licenseNumber || 'Not provided'} />
            <DetailRow label="Hospital" value={user.hospital || 'Not specified'} />
          </View>
        </View>
      )}

      {/* Medical Information (for patients) */}
      {user.role === 'patient' && user.medicalInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          <View style={styles.detailCard}>
            {console.log('🔍 Medical Info Debug:', {
              diabetesDuration: user.medicalInfo.diabetesDuration,
              hypertensionDuration: user.medicalInfo.hypertensionDuration,
              type: typeof user.medicalInfo.diabetesDuration
            })}
            {user.medicalInfo.height && (
              <DetailRow label="Height" value={`${user.medicalInfo.height} cm`} />
            )}
            {user.medicalInfo.weight && (
              <DetailRow label="Weight" value={`${user.medicalInfo.weight} kg`} />
            )}
            {user.medicalInfo.bmi && (
              <DetailRow label="BMI" value={user.medicalInfo.bmi.toString()} />
            )}
            {user.medicalInfo.bloodSugarLevel && (
              <DetailRow label="Blood Sugar Level" value={`${user.medicalInfo.bloodSugarLevel} mg/dL`} />
            )}
            {user.medicalInfo.hba1c && (
              <DetailRow label="HbA1c" value={`${user.medicalInfo.hba1c}%`} />
            )}
            <DetailRow label="Diabetes Duration" value={formatDuration(user.medicalInfo.diabetesDuration)} />
            <DetailRow label="Hypertension Duration" value={formatDuration(user.medicalInfo.hypertensionDuration)} />
            {user.medicalInfo.isSmoker !== null && user.medicalInfo.isSmoker !== undefined && (
              <DetailRow label="Smoker" value={user.medicalInfo.isSmoker ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasDiabetes !== null && user.medicalInfo.hasDiabetes !== undefined && (
              <DetailRow label="Has Diabetes" value={user.medicalInfo.hasDiabetes ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasHighBloodPressure !== null && user.medicalInfo.hasHighBloodPressure !== undefined && (
              <DetailRow label="Has High Blood Pressure" value={user.medicalInfo.hasHighBloodPressure ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasHighCholesterol !== null && user.medicalInfo.hasHighCholesterol !== undefined && (
              <DetailRow label="Has High Cholesterol" value={user.medicalInfo.hasHighCholesterol ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasHeartDisease !== null && user.medicalInfo.hasHeartDisease !== undefined && (
              <DetailRow label="Has Heart Disease" value={user.medicalInfo.hasHeartDisease ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasKidneyDisease !== null && user.medicalInfo.hasKidneyDisease !== undefined && (
              <DetailRow label="Has Kidney Disease" value={user.medicalInfo.hasKidneyDisease ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasChronicKidneyDisease !== null && user.medicalInfo.hasChronicKidneyDisease !== undefined && (
              <DetailRow label="Has Chronic Kidney Disease" value={user.medicalInfo.hasChronicKidneyDisease ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasNerveDamage !== null && user.medicalInfo.hasNerveDamage !== undefined && (
              <DetailRow label="Has Nerve Damage" value={user.medicalInfo.hasNerveDamage ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasPoorCirculation !== null && user.medicalInfo.hasPoorCirculation !== undefined && (
              <DetailRow label="Has Poor Circulation" value={user.medicalInfo.hasPoorCirculation ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasFootUlcers !== null && user.medicalInfo.hasFootUlcers !== undefined && (
              <DetailRow label="Has Foot Ulcers" value={user.medicalInfo.hasFootUlcers ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasAmputations !== null && user.medicalInfo.hasAmputations !== undefined && (
              <DetailRow label="Has Amputations" value={user.medicalInfo.hasAmputations ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasFootDeformities !== null && user.medicalInfo.hasFootDeformities !== undefined && (
              <DetailRow label="Has Foot Deformities" value={user.medicalInfo.hasFootDeformities ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasCalluses !== null && user.medicalInfo.hasCalluses !== undefined && (
              <DetailRow label="Has Calluses" value={user.medicalInfo.hasCalluses ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasCorns !== null && user.medicalInfo.hasCorns !== undefined && (
              <DetailRow label="Has Corns" value={user.medicalInfo.hasCorns ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasBlisters !== null && user.medicalInfo.hasBlisters !== undefined && (
              <DetailRow label="Has Blisters" value={user.medicalInfo.hasBlisters ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasCuts !== null && user.medicalInfo.hasCuts !== undefined && (
              <DetailRow label="Has Cuts" value={user.medicalInfo.hasCuts ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasSores !== null && user.medicalInfo.hasSores !== undefined && (
              <DetailRow label="Has Sores" value={user.medicalInfo.hasSores ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasIngrownToenails !== null && user.medicalInfo.hasIngrownToenails !== undefined && (
              <DetailRow label="Has Ingrown Toenails" value={user.medicalInfo.hasIngrownToenails ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasFungalInfections !== null && user.medicalInfo.hasFungalInfections !== undefined && (
              <DetailRow label="Has Fungal Infections" value={user.medicalInfo.hasFungalInfections ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasDrySkin !== null && user.medicalInfo.hasDrySkin !== undefined && (
              <DetailRow label="Has Dry Skin" value={user.medicalInfo.hasDrySkin ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasCrackedHeels !== null && user.medicalInfo.hasCrackedHeels !== undefined && (
              <DetailRow label="Has Cracked Heels" value={user.medicalInfo.hasCrackedHeels ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasFootPain !== null && user.medicalInfo.hasFootPain !== undefined && (
              <DetailRow label="Has Foot Pain" value={user.medicalInfo.hasFootPain ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasNumbness !== null && user.medicalInfo.hasNumbness !== undefined && (
              <DetailRow label="Has Numbness" value={user.medicalInfo.hasNumbness ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasTingling !== null && user.medicalInfo.hasTingling !== undefined && (
              <DetailRow label="Has Tingling" value={user.medicalInfo.hasTingling ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasBurning !== null && user.medicalInfo.hasBurning !== undefined && (
              <DetailRow label="Has Burning" value={user.medicalInfo.hasBurning ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasWeakness !== null && user.medicalInfo.hasWeakness !== undefined && (
              <DetailRow label="Has Weakness" value={user.medicalInfo.hasWeakness ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasBalanceProblems !== null && user.medicalInfo.hasBalanceProblems !== undefined && (
              <DetailRow label="Has Balance Problems" value={user.medicalInfo.hasBalanceProblems ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasWalkingDifficulties !== null && user.medicalInfo.hasWalkingDifficulties !== undefined && (
              <DetailRow label="Has Walking Difficulties" value={user.medicalInfo.hasWalkingDifficulties ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.hasCardiovascularDisease !== null && user.medicalInfo.hasCardiovascularDisease !== undefined && (
              <DetailRow label="Has Cardiovascular Disease" value={user.medicalInfo.hasCardiovascularDisease ? 'Yes' : 'No'} />
            )}
            {user.medicalInfo.additionalNotes && (
              <DetailRow label="Additional Notes" value={user.medicalInfo.additionalNotes} />
            )}
          </View>
        </View>
      )}

      {/* Diabetic Foot History */}
      {user.diabeticFootHistory && user.diabeticFootHistory.completed && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diabetic Foot History</Text>
          <View style={styles.detailCard}>
            <DetailRow 
              label="Right Foot Ulcer Duration" 
              value={formatUlcerDuration(user.diabeticFootHistory.ulcerDuration?.right)} 
            />
            <DetailRow 
              label="Left Foot Ulcer Duration" 
              value={formatUlcerDuration(user.diabeticFootHistory.ulcerDuration?.left)} 
            />
            <DetailRow 
              label="Right Foot Past Ulcer" 
              value={user.diabeticFootHistory.pastUlcerHistory?.right !== null ? (user.diabeticFootHistory.pastUlcerHistory.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Past Ulcer" 
              value={user.diabeticFootHistory.pastUlcerHistory?.left !== null ? (user.diabeticFootHistory.pastUlcerHistory.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Amputation History" 
              value={user.diabeticFootHistory.amputationHistory?.right !== null ? (user.diabeticFootHistory.amputationHistory.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Amputation History" 
              value={user.diabeticFootHistory.amputationHistory?.left !== null ? (user.diabeticFootHistory.amputationHistory.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Joint Pain" 
              value={user.diabeticFootHistory.jointPain?.right !== null ? (user.diabeticFootHistory.jointPain.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Joint Pain" 
              value={user.diabeticFootHistory.jointPain?.left !== null ? (user.diabeticFootHistory.jointPain.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Numbness" 
              value={user.diabeticFootHistory.numbness?.right !== null ? (user.diabeticFootHistory.numbness.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Numbness" 
              value={user.diabeticFootHistory.numbness?.left !== null ? (user.diabeticFootHistory.numbness.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Tingling" 
              value={user.diabeticFootHistory.tingling?.right !== null ? (user.diabeticFootHistory.tingling.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Tingling" 
              value={user.diabeticFootHistory.tingling?.left !== null ? (user.diabeticFootHistory.tingling.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Claudication" 
              value={user.diabeticFootHistory.claudication?.right !== null ? (user.diabeticFootHistory.claudication.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Claudication" 
              value={user.diabeticFootHistory.claudication?.left !== null ? (user.diabeticFootHistory.claudication.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Cramping" 
              value={user.diabeticFootHistory.cramping?.right !== null ? (user.diabeticFootHistory.cramping.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Cramping" 
              value={user.diabeticFootHistory.cramping?.left !== null ? (user.diabeticFootHistory.cramping.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Temperature" 
              value={user.diabeticFootHistory.temperature?.right || 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Temperature" 
              value={user.diabeticFootHistory.temperature?.left || 'Not specified'} 
            />
            <DetailRow 
              label="Right Foot Nail Lesion" 
              value={user.diabeticFootHistory.nailLesion?.right !== null ? (user.diabeticFootHistory.nailLesion.right ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Left Foot Nail Lesion" 
              value={user.diabeticFootHistory.nailLesion?.left !== null ? (user.diabeticFootHistory.nailLesion.left ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Loss of Hair" 
              value={user.diabeticFootHistory.lossOfHair !== null ? (user.diabeticFootHistory.lossOfHair ? 'Yes' : 'No') : 'Not specified'} 
            />
            <DetailRow 
              label="Last Updated" 
              value={user.diabeticFootHistory.lastUpdated ? new Date(user.diabeticFootHistory.lastUpdated).toLocaleDateString() : 'Not available'} 
            />
          </View>
        </View>
      )}

      {/* Recent Predictions */}
      {predictions && predictions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Scans ({predictions.length})</Text>
          {predictions.slice(0, 5).map((prediction) => prediction && prediction._id ? (
            <ScanResultDisplay
              key={prediction._id}
              prediction={prediction}
              patient={user}
              scanDate={prediction.createdAt}
              userRole="admin"
              showPatientInfo={true}
              style={styles.scanResult}
            />
          ) : null)}
        </View>
      )}

      {/* Recent Messages */}
      {messages && messages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Messages ({messages.length})</Text>
          {messages.slice(0, 3).map((message) => message && message._id ? (
            <View key={message._id} style={styles.messageCard}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageSender}>
                  {message.fromUserId 
                    ? `Dr. ${message.fromUserId.firstName} ${message.fromUserId.lastName}` 
                    : 'System Message'
                  }
                </Text>
                <Text style={styles.messageDate}>
                  {new Date(message.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.messageText}>{message.message}</Text>
            </View>
          ) : null)}
        </View>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit User Details</Text>
            <TouchableOpacity onPress={handleUpdateUser} disabled={updating}>
              {updating ? (
                <ActivityIndicator size="small" color="#3498db" />
              ) : (
                <Text style={styles.saveButton}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              value={editData.firstName}
              onChangeText={(text) => setEditData({...editData, firstName: text})}
            />

            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={editData.lastName}
              onChangeText={(text) => setEditData({...editData, lastName: text})}
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={editData.email}
              onChangeText={(text) => setEditData({...editData, email: text})}
              keyboardType="email-address"
            />

            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={editData.age}
              onChangeText={(text) => setEditData({...editData, age: text})}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.genderContainer}>
              {['male', 'female', 'other'].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.genderButton,
                    editData.gender === gender && styles.genderButtonSelected
                  ]}
                  onPress={() => setEditData({...editData, gender})}
                >
                  <Text style={[
                    styles.genderButtonText,
                    editData.gender === gender && styles.genderButtonTextSelected
                  ]}>
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleContainer}>
              {['patient', 'doctor', 'admin'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleButton,
                    editData.role === role && { backgroundColor: getRoleColor(role) }
                  ]}
                  onPress={() => setEditData({...editData, role})}
                >
                  <Ionicons 
                    name={getRoleIcon(role)} 
                    size={16} 
                    color={editData.role === role ? 'white' : getRoleColor(role)} 
                  />
                  <Text style={[
                    styles.roleButtonText,
                    editData.role === role && { color: 'white' }
                  ]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        visible={fullScreenImage.visible}
        imageSource={fullScreenImage.imageSource}
        patientName={fullScreenImage.patientName}
        predictionClass={fullScreenImage.predictionClass}
        onClose={closeFullScreenImage}
      />
    </ScrollView>
  );
}

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    backgroundColor: '#e74c3c',
    padding: 20,
    paddingTop: 40,
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 10,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    gap: 5,
  },
  roleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: '#3498db',
    fontWeight: '600',
    fontSize: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  section: {
    margin: 15,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  predictionCard: {
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
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  predictionDate: {
    fontSize: 12,
    color: '#666',
  },
  predictionResultContainer: {
    alignItems: 'flex-end',
  },
  predictionResult: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  predictionNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  imageContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  predictionImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  imageFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  fallbackText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  imageLoading: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    zIndex: 1,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
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
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  messageSender: {
    fontSize: 14,
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
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  genderContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  genderButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  genderButtonText: {
    fontSize: 14,
    color: '#666',
  },
  genderButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
    gap: 5,
  },
  roleButtonText: {
    fontSize: 14,
    color: '#666',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
  },
  userInfoText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
});
