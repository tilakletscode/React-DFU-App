import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPredictionHistory } from '../../store/slices/predictionSlice';
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

  const renderPredictionItem = ({ item }) => {
    // Debug: Log the full item structure
    console.log('🔍 HistoryScreen item:', JSON.stringify(item, null, 2));
    
    // Create a combined prediction object that includes both prediction data and image
    const combinedPrediction = {
      ...item.prediction,
      imageUrl: item.imageUrl, // Add the image URL from the parent item
      notes: item.notes // Add notes from the parent item
    };
    
    // Debug: Log the combined prediction object
    console.log('🔍 HistoryScreen combinedPrediction:', JSON.stringify(combinedPrediction, null, 2));
    
    return (
      <ScanResultDisplay
        prediction={combinedPrediction} // Pass the combined prediction object
        patient={user}
        scanDate={item.createdAt || item.timestamp}
        userRole={user?.role || 'patient'}
        showPatientInfo={false} // Don't show patient info in their own history
        style={styles.historyItem}
      />
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No scan history</Text>
      <Text style={styles.emptySubtitle}>
        Your scan results will appear here once you start analyzing images
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading scan history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        renderItem={renderPredictionItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  historyItem: {
    marginBottom: 16,
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
    color: '#666',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
