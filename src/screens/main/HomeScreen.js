import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { fetchPredictionHistory } from '../../store/slices/predictionSlice';
import { apiUtils } from '../../services/api';
import { getGradeInfo } from '../../utils/gradeDescriptions';

export default function HomeScreen({ navigation }) {
  const [serverHealth, setServerHealth] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);
  
  const { user } = useSelector((state) => state.auth);
  const { history, loading } = useSelector((state) => state.prediction);
  const dispatch = useDispatch();
  
  // Check if user is a patient
  const isPatient = user?.role === 'patient' || (!user?.role || (user?.role !== 'doctor' && user?.role !== 'admin'));

  useEffect(() => {
    // Fetch recent predictions when screen loads
    dispatch(fetchPredictionHistory());
    checkServerHealth();
  }, [dispatch]);

  const checkServerHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const health = await apiUtils.checkServerHealth();
      setServerHealth(health);
    } catch (error) {
      setServerHealth({ auth: false, ml: false, error: error.message });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const navigateToCamera = () => {
    console.log('📸 Navigating to camera...');
    
    if (!serverHealth?.ml) {
      Alert.alert(
        'Service Unavailable',
        'The ML analysis service is currently unavailable. Please try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Navigate to the Camera tab - the CameraNavigator will handle routing
      // based on whether user has completed diabetic foot history
      navigation.navigate('Camera');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const navigateToHistory = () => {
    navigation.navigate('History');
  };

  const recentPredictions = history.slice(0, 3); // Show last 3 predictions

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome</Text>
        <Text style={styles.userName}>
          {user?.firstName && user?.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user?.name || user?.firstName || user?.username || 'User'}!
        </Text>
        
        {/* Server Status Indicator */}
        <View style={styles.statusContainer}>
          {isCheckingHealth ? (
            <ActivityIndicator size="small" color="#2E86AB" />
          ) : (
            <View style={styles.statusRow}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: serverHealth?.auth ? '#4CAF50' : '#F44336' }
              ]} />
              <Text style={styles.statusText}>
                Services {serverHealth?.auth && serverHealth?.ml ? 'Online' : 'Offline'}
              </Text>
              <TouchableOpacity onPress={checkServerHealth} style={styles.refreshButton}>
                <Ionicons name="refresh" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={[styles.actionCard, styles.primaryAction]}
            onPress={navigateToCamera}
          >
            <Ionicons name="camera" size={40} color="#fff" />
            <Text style={styles.actionTitle}>New Scan</Text>
            <Text style={styles.actionSubtitle}>Analyze an image</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={navigateToHistory}
          >
            <Ionicons name="time" size={40} color="#2E86AB" />
            <Text style={[styles.actionTitle, { color: '#2E86AB' }]}>History</Text>
            <Text style={styles.actionSubtitle}>View past results</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Results */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Results</Text>
          {history.length > 3 && (
            <TouchableOpacity onPress={navigateToHistory}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E86AB" />
            <Text style={styles.loadingText}>Loading recent results...</Text>
          </View>
        ) : recentPredictions.length > 0 ? (
          <View style={styles.resultsContainer}>
            {recentPredictions.map((prediction, index) => {
              const gradeInfo = isPatient ? getGradeInfo(prediction.prediction, 'patient') : null;
              
              return (
                <TouchableOpacity 
                  key={prediction._id} 
                  style={[
                    styles.resultCard,
                    isPatient && { borderLeftColor: gradeInfo.color, borderLeftWidth: 3 }
                  ]}
                  onPress={() => navigation.navigate('History')}
                  activeOpacity={0.7}
                >
                  {isPatient ? (
                    // Patient View
                    <>
                      <View style={styles.resultHeader}>
                        <View style={[styles.gradeIndicator, { backgroundColor: gradeInfo?.color || '#666' }]}>
                          <Text style={styles.gradeIndicatorText}>
                            {gradeInfo?.grade || '?'}
                          </Text>
                        </View>
                        <Text style={styles.resultDate}>
                          {new Date(prediction.createdAt || prediction.timestamp).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })}
                        </Text>
                      </View>
                      
                      <Text style={styles.resultTitlePatient}>
                        {gradeInfo?.description || 'Scan analysis'}
                      </Text>
                      
                      <Text style={styles.gradeStatus}>
                        {gradeInfo?.severity === 'Emergency' ? '⚠️ Urgent attention needed' :
                         gradeInfo?.severity === 'Critical' ? '🔴 Medical attention recommended' :
                         gradeInfo?.severity === 'Severe' ? '🟡 Monitor closely' :
                         '✅ Continue preventive care'}
                      </Text>
                      
                      {prediction.notes && (
                        <Text style={styles.resultNotes} numberOfLines={1}>
                          Note: {prediction.notes}
                        </Text>
                      )}
                    </>
                  ) : (
                    // Doctor/Admin View
                    <>
                      <View style={styles.resultHeader}>
                        <View style={[
                          styles.confidenceBadge,
                          {
                            backgroundColor: prediction.prediction.confidence > 0.8 
                              ? '#4CAF50' 
                              : prediction.prediction.confidence > 0.6 
                              ? '#FF9800' 
                              : '#F44336'
                          }
                        ]}>
                          <Text style={styles.confidenceText}>
                            {(prediction.prediction.confidence * 100).toFixed(1)}%
                          </Text>
                        </View>
                        <Text style={styles.resultDate}>
                          {new Date(prediction.createdAt || prediction.timestamp).toLocaleDateString()}
                        </Text>
                      </View>
                      
                      <Text style={styles.resultTitle}>
                        {prediction.prediction.predicted_class}
                      </Text>
                      
                      {prediction.notes && (
                        <Text style={styles.resultNotes} numberOfLines={2}>
                          {prediction.notes}
                        </Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No analysis results yet</Text>
            <Text style={styles.emptySubtext}>Take your first scan to get started</Text>
          </View>
        )}
      </View>

      {/* Tips Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Patient Care Tips</Text>
        <View style={styles.tipsContainer}>
          <View style={styles.tipItem}>
            <Ionicons name="sunny" size={24} color="#2E86AB" />
            <Text style={styles.tipText}>Take photos in good lighting for accurate analysis</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="crop" size={24} color="#2E86AB" />
            <Text style={styles.tipText}>Keep the affected area centered and in focus</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="medical" size={24} color="#4CAF50" />
            <Text style={styles.tipText}>Share results with your healthcare provider</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="warning" size={24} color="#FF9800" />
            <Text style={styles.tipText}>This is a screening tool - always consult your doctor</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 10,
  },
  welcomeText: {
    fontSize: 18,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusContainer: {
    marginTop: 5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  refreshButton: {
    padding: 5,
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 16,
    color: '#2E86AB',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 0.48,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  primaryAction: {
    backgroundColor: '#2E86AB',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  resultsContainer: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultDate: {
    fontSize: 12,
    color: '#666',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  resultNotes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
  tipsContainer: {
    gap: 15,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  // Patient-specific styles
  gradeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeIndicatorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultTitlePatient: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  gradeStatus: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
});