import React, { useState, useEffect, useCallback } from 'react';
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

export default function AdminDashboardScreen({ navigation }) {
  const { user } = useSelector((state) => state.auth);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [stats, setStats] = useState({
    totalUsers: 0,
    patients: 0,
    doctors: 0,
    admins: 0
  });

  // Debounced search function
  const debouncedFetchUsers = useCallback(
    debounce(() => {
      fetchUsers(false); // Don't show loading for search
    }, 500),
    [selectedRole, searchQuery]
  );

  useEffect(() => {
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      debouncedFetchUsers();
    }
  }, [selectedRole, searchQuery, debouncedFetchUsers]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await authAPI.getUsers({
        search: searchQuery,
        ...(selectedRole !== 'all' && { role: selectedRole })
      });
      setUsers(response.users);
      
      // Calculate stats from API response
      const allUsers = response.users;
      
      // If we have statistics from the API, use them
      if (response.statistics && response.statistics.length > 0) {
        const statsMap = response.statistics.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {});
        
        setStats({
          totalUsers: response.pagination?.total || response.total,
          patients: statsMap.patient || 0,
          doctors: statsMap.doctor || 0,
          admins: statsMap.admin || 0
        });
      } else {
        // Fallback: calculate from current page data
        setStats({
          totalUsers: response.pagination?.total || response.total || allUsers.length,
          patients: allUsers.filter(u => u.role === 'patient').length,
          doctors: allUsers.filter(u => u.role === 'doctor').length,
          admins: allUsers.filter(u => u.role === 'admin').length
        });
      }
    } catch (error) {
      if (showLoading) {
        Alert.alert('Error', 'Failed to fetch users');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleUserPress = (userId, userName) => {
    navigation.navigate('UserDetails', { 
      userId, 
      userName: userName || 'User' 
    });
  };

  const handleAddUser = () => {
    navigation.navigate('AddUser');
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
        <ActivityIndicator size="large" color="#2E86AB" />
        <Text style={styles.loadingText}>Loading users...</Text>
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
        <Text style={styles.welcomeText}>Welcome, {user?.firstName}!</Text>
        <Text style={styles.roleText}>Administrator</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#3498db' }]}>
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#2ecc71' }]}>
          <Text style={styles.statNumber}>{stats.patients}</Text>
          <Text style={styles.statLabel}>Patients</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#f39c12' }]}>
          <Text style={styles.statNumber}>{stats.doctors}</Text>
          <Text style={styles.statLabel}>Doctors</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#e74c3c' }]}>
          <Text style={styles.statNumber}>{stats.admins}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {['all', 'patient', 'doctor', 'admin'].map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterButton,
                selectedRole === role && styles.filterButtonActive
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[
                styles.filterText,
                selectedRole === role && styles.filterTextActive
              ]}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Add User Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>Add New User</Text>
      </TouchableOpacity>

      {/* Users List */}
      <View style={styles.usersContainer}>
        <Text style={styles.sectionTitle}>Users</Text>
        {users.map((user) => (
          <TouchableOpacity
            key={user._id}
            style={styles.userCard}
            onPress={() => handleUserPress(user._id, `${user.firstName} ${user.lastName}`)}
          >
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) }]}>
                  <Ionicons name={getRoleIcon(user.role)} size={12} color="white" />
                  <Text style={styles.roleText}>{user.role}</Text>
                </View>
              </View>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userUsername}>@{user.username}</Text>
              <Text style={styles.userDate}>
                Joined: {new Date(user.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        ))}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
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
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: '#2E86AB',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: 'white',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27ae60',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 10,
    justifyContent: 'center',
    marginBottom: 15,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  usersContainer: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  userCard: {
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
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
    color: '#999',
  },
});
