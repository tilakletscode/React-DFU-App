import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { fetchPredictionHistory, deletePrediction } from '../../store/slices/predictionSlice';
import { getGradeInfo } from '../../utils/gradeDescriptions';
import ScanResultDisplay from '../../components/ScanResultDisplay';

export default function HistoryScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  
  const dispatch = useDispatch();
  const { history, loading } = useSelector((state) => state.prediction);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    // Load history when screen focuses
    const unsubscribe = navigation.addListener('focus', () => {
      dispatch(fetchPredictionHistory());
    });

    return unsubscribe;
  }, [navigation, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(fetchPredictionHistory());
    setRefreshing(false);
  };

  const handleDeletePrediction = (predictionId, predictionClass) => {
    Alert.alert(
      'Delete Prediction',
      `Are you sure you want to delete the "${predictionClass}" result?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch(deletePrediction(predictionId)),
        },
      ]
    );
  };

  const getConfidenceColor = (confidence) => {
    if (confidence > 0.8) return '#4CAF50';
    if (confidence > 0.6) return '#FF9800';
    return '#F44336';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
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

  const renderPredictionItem = ({ item }) => {
    return (
      <ScanResultDisplay
        prediction={item}
        patient={user}
        scanDate={item.createdAt || item.timestamp}
        userRole={user?.role || 'patient'}
        showPatientInfo={false} // Don't show patient info in their own history
        style={styles.historyItem}
      />
    );
  };

    if (isPatient) {
      // Patient View - Detailed Grade Information
      return (
        <TouchableOpacity 
          style={[styles.predictionCard, { borderLeftColor: gradeInfo.color, borderLeftWidth: 4 }]}
          onPress={() => toggleExpanded(item._id)}
          activeOpacity={0.8}
        >
          {/* Header with Grade Info */}
          <View style={styles.cardHeader}>
            <View style={styles.predictionInfo}>
              <Text style={styles.gradeHistoryTitle}>{gradeInfo.title}</Text>
              <View style={styles.timestampRow}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.predictionDate}>
                  {new Date(item.createdAt || item.timestamp).toLocaleString('en-GB', {
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
              
              {/* User Information */}
              <View style={styles.userInfoRow}>
                <Ionicons name="person-outline" size={14} color="#666" />
                <Text style={styles.userInfoText}>
                  {user?.firstName} {user?.lastName} • {user?.age} years • {user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not specified'}
                </Text>
              </View>
            </View>
            
            <View style={styles.cardActions}>
              <View style={[styles.severityIndicator, { backgroundColor: gradeInfo.color }]}>
                <Text style={styles.severityIndicatorText}>
                  {gradeInfo.severity === 'critical' ? '!' : 
                   gradeInfo.severity === 'high' ? '⚠' :
                   gradeInfo.severity === 'medium' ? '●' : '✓'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePrediction(item._id, item.prediction.predicted_class)}
              >
                <Ionicons name="trash-outline" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Expandable Content */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {(item.imageUrl || item.imagePath) && (
                <TouchableOpacity 
                  onPress={() => openFullScreenImage(
                    item.imageUrl || item.imagePath, 
                    `${user?.firstName || user?.name || 'User'} ${user?.lastName || ''}`.trim() || 'Patient',
                    item.prediction.predicted_class || item.prediction.class
                  )}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ 
                      uri: (item.imageUrl || item.imagePath).startsWith('data:') 
                        ? (item.imageUrl || item.imagePath)
                        : (item.imageUrl || item.imagePath) === 'local://no-image' 
                          ? null
                          : `data:image/jpeg;base64,${item.imageUrl || item.imagePath}` 
                    }} 
                    style={styles.predictionImage}
                    resizeMode="contain"
                  />
                  <View style={styles.imageOverlay}>
                    <Ionicons name="expand" size={20} color="#fff" />
                    <Text style={styles.imageOverlayText}>Tap to view full screen</Text>
                  </View>
                </TouchableOpacity>
              )}

              <View style={styles.gradeDetailsContainer}>
                <View style={styles.meaningBox}>
                  <Text style={styles.detailLabel}>What it meant:</Text>
                  <Text style={styles.detailText}>{gradeInfo.meaning}</Text>
                </View>
                
                <View style={styles.actionBox}>
                  <Text style={styles.detailLabel}>Recommended action:</Text>
                  <Text style={styles.detailText}>{gradeInfo.action}</Text>
                </View>
              </View>

              {(item.notes || item.scanContext?.notes) && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Your notes:</Text>
                  <Text style={styles.notesText}>{item.notes || item.scanContext?.notes}</Text>
                </View>
              )}

              {/* Removed confidence score for patients */}
            </View>
          )}

          {/* Expand/Collapse Indicator */}
          <View style={styles.expandIndicator}>
            <Ionicons 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#666" 
            />
            <Text style={styles.expandText}>
              {isExpanded ? 'Tap to collapse' : 'Tap for details'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else {
      // Doctor/Admin View - Original Format
      return (
        <View style={styles.predictionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.predictionInfo}>
              <Text style={styles.predictionTitle}>{item.prediction.predicted_class}</Text>
              <Text style={styles.predictionDate}>
                {new Date(item.createdAt || item.timestamp).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                })}
              </Text>
              
              {/* User Information */}
              <Text style={styles.userInfoText}>
                {user?.firstName} {user?.lastName} • {user?.age} years • {user?.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'Not specified'}
              </Text>
            </View>
            
            <View style={styles.cardActions}>
              <View style={[
                styles.confidenceBadge,
                { backgroundColor: getConfidenceColor(item.prediction.confidence) }
              ]}>
                <Text style={styles.confidenceText}>
                  {(item.prediction.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeletePrediction(item._id, item.prediction.predicted_class)}
              >
                <Ionicons name="trash-outline" size={20} color="#F44336" />
              </TouchableOpacity>
            </View>
          </View>

          {item.imagePath && (
            <TouchableOpacity 
              onPress={() => openFullScreenImage(
                item.imagePath, 
                `${user?.firstName || 'User'} ${user?.lastName || ''}`.trim() || 'Patient',
                item.prediction.predicted_class
              )}
              activeOpacity={0.8}
            >
              <Image 
                source={{ 
                  uri: item.imagePath.startsWith('data:') 
                    ? item.imagePath 
                    : `data:image/jpeg;base64,${item.imagePath}` 
                }} 
                style={styles.predictionImage}
                resizeMode="contain"
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand" size={20} color="#fff" />
                <Text style={styles.imageOverlayText}>Tap to view full screen</Text>
              </View>
            </TouchableOpacity>
          )}

          {item.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}

          {/* Show top 3 probabilities */}
          <View style={styles.probabilitiesContainer}>
            {Object.entries(item.prediction.all_probabilities)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([className, probability]) => (
                <View key={className} style={styles.probabilityRow}>
                  <Text style={styles.probabilityName}>{className}</Text>
                  <Text style={styles.probabilityValue}>
                    {(probability * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
          </View>
        </View>
      );
    }
  };

  const EmptyHistoryComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Analysis History</Text>
      <Text style={styles.emptySubtitle}>
        Your analysis results will appear here after you perform scans
      </Text>
      <TouchableOpacity
        style={styles.startScanButton}
        onPress={() => navigation.navigate('Camera')}
      >
        <Ionicons name="camera" size={20} color="#fff" />
        <Text style={styles.startScanButtonText}>Start Your First Scan</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && history.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading your history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analysis History</Text>
        <Text style={styles.headerSubtitle}>
          {history.length} {history.length === 1 ? 'result' : 'results'}
        </Text>
      </View>

      <FlatList
        data={history}
        renderItem={renderPredictionItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2E86AB']}
            tintColor="#2E86AB"
          />
        }
        ListEmptyComponent={EmptyHistoryComponent}
      />

      {/* Full Screen Image Viewer */}
      <FullScreenImageViewer
        visible={fullScreenImage.visible}
        imageSource={fullScreenImage.imageSource}
        patientName={fullScreenImage.patientName}
        predictionClass={fullScreenImage.predictionClass}
        onClose={closeFullScreenImage}
      />
    </View>
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  predictionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  predictionInfo: {
    flex: 1,
  },
  predictionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  predictionDate: {
    fontSize: 14,
    color: '#666',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  userInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  deleteButton: {
    padding: 5,
  },
  predictionImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  notesContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  probabilitiesContainer: {
    gap: 5,
  },
  probabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  probabilityName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  probabilityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E86AB',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  startScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E86AB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  startScanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Patient-specific styles
  gradeHistoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  severityIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityIndicatorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  expandedContent: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  gradeDetailsContainer: {
    gap: 12,
    marginBottom: 15,
  },
  meaningBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 6,
  },
  actionBox: {
    backgroundColor: '#f0fff4',
    padding: 12,
    borderRadius: 6,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  confidenceLabel: {
    fontSize: 13,
    color: '#666',
  },
  confidenceBarMini: {
    flex: 1,
    height: 18,
    backgroundColor: '#f0f0f0',
    borderRadius: 9,
    overflow: 'hidden',
  },
  confidenceBarFillMini: {
    height: '100%',
    borderRadius: 9,
  },
  confidenceValueMini: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    minWidth: 45,
    textAlign: 'right',
  },
  expandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  expandText: {
    fontSize: 13,
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
});