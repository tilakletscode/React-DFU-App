import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { authAPI } from '../../services/api';

// Debounce function to optimize search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function DoctorDashboardScreen({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalPatients: 0,
    recentPredictions: 0,
    unreadMessages: 0
  });
  
  // Reference for search input
  const searchInputRef = useRef(null);

  // Debounced search function
  const debouncedFetchPatients = useCallback(
    debounce(() => {
      fetchPatients(false); // Don't show loading for search
    }, 500),
    [searchQuery]
  );

  useEffect(() => {
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      debouncedFetchPatients();
    }
  }, [searchQuery, debouncedFetchPatients]);

  useEffect(() => {
    fetchPatients();
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const dashboardData = await authAPI.getDoctorDashboard();
      setStats(prevStats => ({
        ...prevStats,
        totalPatients: dashboardData.overview?.totalPatients || prevStats.totalPatients,
        recentPredictions: dashboardData.overview?.totalPredictions || 0,
        unreadMessages: dashboardData.overview?.unreviewedPredictions || 0
      }));
    } catch (error) {
      console.log('Dashboard stats fetch error:', error);
      // Don't show error to user, just log it
    }
  };

  const fetchPatients = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await authAPI.getPatients({
        search: searchQuery
      });
      setPatients(response.patients || response.users || []);
      
      setStats({
        totalPatients: response.pagination?.total || response.total || 0,
        recentPredictions: 0, // You can add this later
        unreadMessages: 0 // You can add this later
      });
    } catch (error) {
      console.error('Fetch patients error:', error);
      if (showLoading) {
        Alert.alert('Error', 'Failed to fetch patients. Please check your connection.');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPatients(),
      fetchDashboardStats()
    ]);
    setRefreshing(false);
  };

  const handlePatientPress = (patientId, patientName) => {
    navigation.navigate('PatientDetails', { 
      userId: patientId,
      patientName: patientName || 'Patient'
    });
  };



  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading patients...</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, Dr. {user?.firstName}!</Text>
        <Text style={styles.roleText}>Doctor Dashboard</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#3498db' }]}>
          <Ionicons name="people" size={24} color="white" />
          <Text style={styles.statNumber}>{stats.totalPatients}</Text>
          <Text style={styles.statLabel}>Total Patients</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#2ecc71' }]}>
          <Ionicons name="analytics" size={24} color="white" />
          <Text style={styles.statNumber}>{stats.recentPredictions}</Text>
          <Text style={styles.statLabel}>Recent Tests</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#f39c12' }]}>
          <Ionicons name="mail" size={24} color="white" />
          <Text style={styles.statNumber}>{stats.unreadMessages}</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </View>
      </View>



      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search patients by name, email, phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Recent Patients */}
      <View style={styles.patientsContainer}>
        <Text style={styles.sectionTitle}>Recent Patients</Text>
        {patients && patients.length > 0 ? patients.slice(0, 10).map((patient) => (
          <TouchableOpacity
            key={patient._id}
            style={styles.patientCard}
            onPress={() => handlePatientPress(patient._id, `${patient.firstName} ${patient.lastName}`)}
          >
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patient.firstName} {patient.lastName}</Text>
              <Text style={styles.patientEmail}>{patient.email}</Text>
              <Text style={styles.patientDate}>
                Age: {patient.age} | Joined: {new Date(patient.createdAt).toLocaleDateString()}
              </Text>
              {patient.medicalInfoCompleted && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                  <Text style={styles.completedText}>Medical Info Complete</Text>
                </View>
              )}
            </View>
            <View style={styles.patientActions}>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => navigation.navigate('SendMessage', { 
                  patientId: patient._id, 
                  patientName: `${patient.firstName} ${patient.lastName}` 
                })}
              >
                <Ionicons name="chatbubble" size={20} color="#3498db" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        )) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No patients found</Text>
            <Text style={styles.emptySubText}>
              {searchQuery ? 'Try adjusting your search' : 'Patients will appear here once registered'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
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
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  roleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'white',
    marginTop: 5,
  },

  searchContainer: {
    padding: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  patientsContainer: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  patientCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  patientEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  patientDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  completedText: {
    fontSize: 12,
    color: '#27ae60',
    marginLeft: 5,
  },
  patientActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageButton: {
    padding: 8,
    marginRight: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
});
