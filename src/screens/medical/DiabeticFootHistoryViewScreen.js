import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';

const DiabeticFootHistoryViewScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const historyData = user?.diabeticFootHistory;

  const formatAnswer = (value) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === 'hot') return 'Hot';
    if (value === 'cold') return 'Cold';
    if (value === 'normal') return 'Normal';
    return 'Not specified';
  };

  const formatDuration = (value) => {
    if (!value) return 'Not specified';
    
    // Map the stored values back to readable text
    switch (value) {
      case '0': return 'No ulcer';
      case '0.5': return 'Less than 1 month';
      case '1.5': return '1-2 months';
      case '4.5': return '3-6 months';
      case '9': return '6-12 months';
      case '15': return 'More than a year';
      default: return value + ' months'; // fallback for any other values
    }
  };

  const renderDataItem = (icon, iconColor, label, rightValue, leftValue = null) => (
    <View style={styles.dataItem}>
      <View style={styles.dataHeader}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <Text style={styles.dataLabel}>{label}</Text>
      </View>
      {leftValue !== null ? (
        <View style={styles.legContainer}>
          <View style={styles.legSection}>
            <Text style={styles.legLabel}>Right Leg</Text>
            <Text style={styles.dataValue}>{formatAnswer(rightValue)}</Text>
          </View>
          <View style={styles.legSection}>
            <Text style={styles.legLabel}>Left Leg</Text>
            <Text style={styles.dataValue}>{formatAnswer(leftValue)}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.dataValue}>{formatAnswer(rightValue)}</Text>
      )}
    </View>
  );

  const renderDurationItem = (icon, iconColor, label, rightValue, leftValue) => (
    <View style={styles.dataItem}>
      <View style={styles.dataHeader}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <Text style={styles.dataLabel}>{label}</Text>
      </View>
      <View style={styles.legContainer}>
        <View style={styles.legSection}>
          <Text style={styles.legLabel}>Right Leg</Text>
          <Text style={styles.dataValue}>{formatDuration(rightValue)}</Text>
        </View>
        <View style={styles.legSection}>
          <Text style={styles.legLabel}>Left Leg</Text>
          <Text style={styles.dataValue}>{formatDuration(leftValue)}</Text>
        </View>
      </View>
    </View>
  );

  if (!historyData?.completed) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="document-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No diabetic foot history available</Text>
          <TouchableOpacity 
            style={styles.completeButton}
            onPress={() => navigation.navigate('DiabeticFootHistory')}
          >
            <Text style={styles.completeButtonText}>Complete Assessment</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Diabetic Foot History</Text>
          <Text style={styles.subtitle}>
            Last updated: {new Date(historyData.lastUpdated).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.dataContainer}>
          {/* Duration Questions */}
          {renderDurationItem(
            'time-outline', '#FF9800', 
            'Duration of Ulcer', 
            historyData.ulcerDuration?.right, 
            historyData.ulcerDuration?.left
          )}

          {/* Yes/No Questions */}
          {renderDataItem(
            'medical-outline', '#F44336', 
            'Past History of Ulcer', 
            historyData.pastUlcerHistory?.right, 
            historyData.pastUlcerHistory?.left
          )}

          {renderDataItem(
            'cut-outline', '#E91E63', 
            'History of Amputation', 
            historyData.amputationHistory?.right, 
            historyData.amputationHistory?.left
          )}

          {renderDataItem(
            'body-outline', '#9C27B0', 
            'Joint Pain', 
            historyData.jointPain?.right, 
            historyData.jointPain?.left
          )}

          {renderDataItem(
            'hand-left-outline', '#673AB7', 
            'Numbness', 
            historyData.numbness?.right, 
            historyData.numbness?.left
          )}

          {renderDataItem(
            'flash-outline', '#3F51B5', 
            'Tingling/Pricking feeling', 
            historyData.tingling?.right, 
            historyData.tingling?.left
          )}

          {renderDataItem(
            'walk-outline', '#2196F3', 
            'Claudication', 
            historyData.claudication?.right, 
            historyData.claudication?.left
          )}

          {renderDataItem(
            'fitness-outline', '#03DAC6', 
            'Cramping', 
            historyData.cramping?.right, 
            historyData.cramping?.left
          )}

          {renderDataItem(
            'thermometer-outline', '#4CAF50', 
            'Temperature', 
            historyData.temperature?.right, 
            historyData.temperature?.left
          )}

          {renderDataItem(
            'warning-outline', '#FF5722', 
            'Nail Lesion', 
            historyData.nailLesion?.right, 
            historyData.nailLesion?.left
          )}

          {/* General Question */}
          {renderDataItem(
            'leaf-outline', '#795548', 
            'Loss of Hair', 
            historyData.lossOfHair
          )}
        </View>

        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('DiabeticFootHistory')}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.editButtonText}>Edit Information</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  dataContainer: {
    gap: 15,
  },
  dataItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2E86AB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dataLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  dataValue: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  legContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legSection: {
    flex: 0.48,
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
  },
  legLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  editButton: {
    backgroundColor: '#2E86AB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  completeButton: {
    backgroundColor: '#2E86AB',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DiabeticFootHistoryViewScreen;
