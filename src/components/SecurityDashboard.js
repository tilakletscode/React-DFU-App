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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { securityMonitor } from '../services/secureApi';

export default function SecurityDashboard() {
  const [securityStatus, setSecurityStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    loadSecurityStatus();
  }, []);

  const loadSecurityStatus = async () => {
    try {
      setLoading(true);
      const status = await securityMonitor.getSecurityStatus();
      setSecurityStatus(status);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load security status:', error);
      Alert.alert('Error', 'Failed to load security status');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSecurityStatus();
    setRefreshing(false);
  };

  const validateSecurityConfig = () => {
    const config = securityMonitor.validateSecurityConfig();
    return config;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SECURE':
        return '#4CAF50';
      case 'VULNERABLE':
        return '#F44336';
      case 'WARNING':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SECURE':
        return 'shield-checkmark';
      case 'VULNERABLE':
        return 'shield-close';
      case 'WARNING':
        return 'shield-warning';
      default:
        return 'shield-outline';
    }
  };

  const renderSecurityMetric = (title, status, details, icon) => (
    <View style={styles.metricContainer}>
      <View style={styles.metricHeader}>
        <Ionicons name={icon} size={24} color={getStatusColor(status)} />
        <Text style={styles.metricTitle}>{title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      <Text style={styles.metricDetails}>{details}</Text>
    </View>
  );

  const renderSecurityOverview = () => {
    if (!securityStatus) return null;

    return (
      <View style={styles.overviewContainer}>
        <Text style={styles.sectionTitle}>Security Overview</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Ionicons 
              name={getStatusIcon(securityStatus.overall)} 
              size={32} 
              color={getStatusColor(securityStatus.overall)} 
            />
            <Text style={styles.overallStatus}>Overall Status: {securityStatus.overall}</Text>
          </View>
          <Text style={styles.timestamp}>
            Last Updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Never'}
          </Text>
        </View>
      </View>
    );
  };

  const renderSecurityMetrics = () => {
    if (!securityStatus) return null;

    return (
      <View style={styles.metricsContainer}>
        <Text style={styles.sectionTitle}>Security Metrics</Text>
        
        {renderSecurityMetric(
          'Authentication',
          securityStatus.authentication?.status || 'UNKNOWN',
          securityStatus.authentication?.details || 'Status unavailable',
          'key-outline'
        )}
        
        {renderSecurityMetric(
          'ML Service',
          securityStatus.mlService?.status || 'UNKNOWN',
          securityStatus.mlService?.details || 'Status unavailable',
          'analytics-outline'
        )}
        
        {renderSecurityMetric(
          'Encryption',
          securityStatus.encryption?.status || 'UNKNOWN',
          `Algorithm: ${securityStatus.encryption?.algorithm || 'Unknown'}`,
          'lock-closed-outline'
        )}
      </View>
    );
  };

  const renderConfigurationValidation = () => {
    const config = validateSecurityConfig();
    
    return (
      <View style={styles.configContainer}>
        <Text style={styles.sectionTitle}>Configuration Validation</Text>
        <View style={[styles.configCard, { 
          borderColor: config.isValid ? '#4CAF50' : '#F44336' 
        }]}>
          <View style={styles.configHeader}>
            <Ionicons 
              name={config.isValid ? 'checkmark-circle' : 'close-circle'} 
              size={24} 
              color={config.isValid ? '#4CAF50' : '#F44336'} 
            />
            <Text style={styles.configStatus}>
              Configuration: {config.isValid ? 'Valid' : 'Issues Found'}
            </Text>
          </View>
          
          {config.issues.length > 0 && (
            <View style={styles.issuesContainer}>
              <Text style={styles.issuesTitle}>Issues Found:</Text>
              {config.issues.map((issue, index) => (
                <Text key={index} style={styles.issueText}>• {issue}</Text>
              ))}
            </View>
          )}
          
          {config.recommendations.length > 0 && (
            <View style={styles.recommendationsContainer}>
              <Text style={styles.recommendationsTitle}>Recommendations:</Text>
              {config.recommendations.map((rec, index) => (
                <Text key={index} style={styles.recommendationText}>• {rec}</Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSecurityFeatures = () => (
    <View style={styles.featuresContainer}>
      <Text style={styles.sectionTitle}>Security Features</Text>
      <View style={styles.featuresGrid}>
        <View style={styles.featureItem}>
          <Ionicons name="lock-closed" size={24} color="#4CAF50" />
          <Text style={styles.featureText}>Image Encryption</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
          <Text style={styles.featureText}>HTTPS/TLS</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="key-outline" size={24} color="#4CAF50" />
          <Text style={styles.featureText}>JWT Tokens</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="speedometer-outline" size={24} color="#4CAF50" />
          <Text style={styles.featureText}>Rate Limiting</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="eye-off-outline" size={24} color="#4CAF50" />
          <Text style={styles.featureText}>Data Masking</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="document-text-outline" size={24} color="#4CAF50" />
          <Text style={styles.featureText}>Audit Logging</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading Security Status...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Ionicons name="shield" size={32} color="#2E86AB" />
        <Text style={styles.headerTitle}>Security Dashboard</Text>
      </View>

      {renderSecurityOverview()}
      {renderSecurityMetrics()}
      {renderConfigurationValidation()}
      {renderSecurityFeatures()}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#2E86AB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  overviewContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  overviewCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overallStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#333',
  },
  timestamp: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  metricsContainer: {
    padding: 20,
  },
  metricContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricDetails: {
    fontSize: 14,
    color: '#666',
    marginLeft: 36,
  },
  configContainer: {
    padding: 20,
  },
  configCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  configStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    color: '#333',
  },
  issuesContainer: {
    marginBottom: 16,
  },
  issuesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
    marginBottom: 8,
  },
  issueText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 16,
    marginBottom: 4,
  },
  recommendationsContainer: {
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#4CAF50',
    marginLeft: 16,
    marginBottom: 4,
  },
  featuresContainer: {
    padding: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureItem: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
    color: '#333',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E86AB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
