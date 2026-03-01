import React, { useEffect } from 'react';
import { NavigationContainer, useFocusEffect, useNavigation } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch } from 'react-redux';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Custom hooks
import { useUnreadMessages } from '../hooks/useUnreadMessages';

// Redux actions
import { loadUserFromStorage } from '../store/slices/authSlice';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import UserInfoScreen from '../screens/auth/UserInfoScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SimpleOTPLoginScreen from '../screens/auth/SimpleOTPLoginScreen';
import SimpleForgotPasswordScreen from '../screens/auth/SimpleForgotPasswordScreen';

// Main App Screens
import HomeScreen from '../screens/main/HomeScreen';
import CameraScreen from '../screens/main/CameraScreen';
import ResultsScreen from '../screens/main/ResultsScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Medical Screens
import DiabeticFootHistoryScreen from '../screens/medical/DiabeticFootHistoryScreen';
import DiabeticFootHistoryViewScreen from '../screens/medical/DiabeticFootHistoryViewScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AddUserScreen from '../screens/admin/AddUserScreen';
import UserDetailsScreen from '../screens/admin/UserDetailsScreen';

// Doctor Screens
import DoctorDashboardScreen from '../screens/doctor/DoctorDashboardScreen';
import SendMessageScreen from '../screens/doctor/SendMessageScreen';
import PatientDetailsScreen from '../screens/doctor/PatientDetailsScreen';

// Shared Screens
import MessagesScreen from '../screens/shared/MessagesScreen';
import MessagesListScreen from '../screens/shared/MessagesListScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import ChangePasswordScreen from '../screens/shared/ChangePasswordScreen';

// Placeholder screens (to be implemented)
const SearchPatientsScreen = () => <View><Text>Search Patients Screen</Text></View>;


const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom component for Messages tab with unread badge
const MessagesTabIcon = ({ focused, color, size }) => {
  const { unreadCount } = useUnreadMessages();
  
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons 
        name={focused ? 'chatbubbles' : 'chatbubbles-outline'} 
        size={size} 
        color={color} 
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount.toString()}
          </Text>
        </View>
      )}
    </View>
  );
};

// Auth Stack Navigator
function AuthStackNavigator() {
  const { isAuthenticated, registrationCompleted } = useSelector((state) => state.auth);
  
  // If user is authenticated but hasn't completed registration, 
  // start with UserInfo screen (medical information)
  const initialRoute = (isAuthenticated && !registrationCompleted) ? 'UserInfo' : 'Login';
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#3fa3c6',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ title: 'DFU Assist' }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen 
        name="UserInfo" 
        component={UserInfoScreen}
        options={({ route }) => ({
          title: 'Medical Information',
          // Disable back button only for new registrations
          headerLeft: (isAuthenticated && !registrationCompleted) ? () => null : undefined
        })}
      />
      <Stack.Screen 
        name="Welcome" 
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="OTPLogin" 
        component={SimpleOTPLoginScreen}
        options={{ title: 'OTP Login' }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={SimpleForgotPasswordScreen}
        options={{ title: 'Reset Password' }}
      />
    </Stack.Navigator>
  );
}

// Patient Stack Navigator
function PatientStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2E86AB',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="MessagesList" 
        component={MessagesListScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}

// Main App Tab Navigator for Patients
function PatientTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Use custom icon for Messages tab to show unread count
          if (route.name === 'Messages') {
            return <MessagesTabIcon focused={focused} color={color} size={size} />;
          }
          
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Camera') {
            iconName = focused ? 'camera' : 'camera-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2E86AB',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#2E86AB',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Camera" 
        component={CameraNavigator}
        options={{ title: 'Scan', headerShown: false }}
      />
      <Tab.Screen 
        name="CameraMain" 
        component={CameraScreen}
        options={{ 
          title: 'Capture Image',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen 
        name="Results" 
        component={ResultsScreen}
        options={{ 
          title: 'Analysis Results',
          tabBarButton: () => null, // Hide from tab bar
        }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen}
        options={{ title: 'History' }}
      />
      <Tab.Screen 
        name="Messages" 
        component={PatientStackNavigator}
        options={{ title: 'Messages' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Admin Tab Navigator
function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Use custom icon for Messages tab to show unread count
          if (route.name === 'Messages') {
            return <MessagesTabIcon focused={focused} color={color} size={size} />;
          }
          
          let iconName;
          if (route.name === 'AdminDashboard') {
            iconName = focused ? 'shield' : 'shield-outline';
          } else if (route.name === 'Users') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#e74c3c',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#e74c3c',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="AdminDashboard" 
        component={AdminStackNavigator}
        options={{ title: 'Dashboard', headerShown: false }}
      />
      <Tab.Screen 
        name="Messages" 
        component={AdminStackNavigator}
        options={{ title: 'Messages', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Doctor Tab Navigator
function DoctorTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Use custom icon for Messages tab to show unread count
          if (route.name === 'Messages') {
            return <MessagesTabIcon focused={focused} color={color} size={size} />;
          }
          
          let iconName;
          if (route.name === 'DoctorDashboard') {
            iconName = focused ? 'medical' : 'medical-outline';
          } else if (route.name === 'Patients') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#3498db',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="DoctorDashboard" 
        component={DoctorStackNavigator}
        options={{ title: 'Dashboard', headerShown: false }}
      />
      <Tab.Screen 
        name="Messages" 
        component={DoctorStackNavigator}
        options={{ title: 'Messages', headerShown: false }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

// Admin Stack Navigator
function AdminStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#e74c3c',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="AdminDashboardMain" 
        component={AdminDashboardScreen}
        options={{ title: 'Admin Dashboard' }}
      />
      <Stack.Screen 
        name="UserDetails" 
        component={UserDetailsScreen}
        options={{ title: 'User Details' }}
      />
      <Stack.Screen 
        name="AddUser" 
        component={AddUserScreen}
        options={{ title: 'Add New User' }}
      />
      <Stack.Screen 
        name="MessagesList" 
        component={MessagesListScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}

// Doctor Stack Navigator
function DoctorStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#3498db',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="DoctorDashboardMain" 
        component={DoctorDashboardScreen}
        options={{ title: 'Doctor Dashboard' }}
      />
      <Stack.Screen 
        name="PatientDetails" 
        component={PatientDetailsScreen}
        options={{ title: 'Patient Details' }}
      />
      <Stack.Screen 
        name="SearchPatients" 
        component={SearchPatientsScreen}
        options={{ title: 'Search Patients' }}
      />
      <Stack.Screen 
        name="SendMessage" 
        component={SendMessageScreen}
        options={{ title: 'Send Message' }}
      />
      <Stack.Screen 
        name="MessagesList" 
        component={MessagesListScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}

// Camera Stack Navigator (for camera flow)
function CameraNavigator() {
  const { user } = useSelector((state) => state.auth);
  const navigation = useNavigation();
  
  // Use useFocusEffect to handle route changes when user state updates
  useFocusEffect(
    React.useCallback(() => {
      // If user has completed diabetic foot history, navigate to CameraMain
      if (user?.diabeticFootHistory?.completed) {
        navigation.navigate('CameraMain');
      }
    }, [user?.diabeticFootHistory?.completed, navigation])
  );
  
  // Determine initial route based on diabetic foot history completion
  const initialRoute = user?.diabeticFootHistory?.completed ? 'CameraMain' : 'DiabeticFootHistory';
  
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2E86AB',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="DiabeticFootHistory" 
        component={DiabeticFootHistoryScreen}
        options={{ title: 'Diabetic Foot History' }}
      />
      <Stack.Screen 
        name="CameraMain" 
        component={CameraScreen}
        options={{ title: 'Capture Image' }}
      />
      <Stack.Screen 
        name="Results" 
        component={ResultsScreen}
        options={{ title: 'Analysis Results' }}
      />
    </Stack.Navigator>
  );
}

// Profile Stack Navigator - To allow UserInfo access from Profile
function ProfileStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ProfileScreen" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="UserInfo" 
        component={UserInfoScreen}
        options={{ 
          title: 'Update Medical Information',
          headerStyle: {
            backgroundColor: '#2E86AB',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen 
        name="DiabeticFootHistory" 
        component={DiabeticFootHistoryScreen}
        options={{ 
          title: 'Diabetic Foot History',
          headerStyle: {
            backgroundColor: '#2E86AB',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen 
        name="DiabeticFootHistoryView" 
        component={DiabeticFootHistoryViewScreen}
        options={{ 
          title: 'Diabetic Foot History',
          headerStyle: {
            backgroundColor: '#2E86AB',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen 
        name="ChangePassword" 
        component={ChangePasswordScreen}
        options={{ 
          title: 'Change Password',
          headerStyle: {
            backgroundColor: '#2E86AB',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack.Navigator>
  );
}

// Loading Screen Component
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2E86AB" />
    </View>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, isInitialized, registrationCompleted, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    // Try to load user from storage when app starts
    dispatch(loadUserFromStorage());
  }, [dispatch]);

  // Show loading screen while checking authentication status
  if (!isInitialized) {
    return <LoadingScreen />;
  }

  // Determine which navigator to show based on user role
  const getNavigator = () => {
    if (!isAuthenticated) {
      return <AuthStackNavigator />;
    }
    
    // If user is authenticated but hasn't completed registration (medical info),
    // keep them in auth stack to complete medical information (only for patients)
    if (!registrationCompleted && (!user?.role || user?.role === 'patient')) {
      return <AuthStackNavigator />;
    }
    
    // Route based on user role
    const userRole = user?.role || 'patient';
    
    switch (userRole) {
      case 'admin':
        return <AdminTabNavigator />;
      case 'doctor':
        return <DoctorTabNavigator />;
      case 'patient':
      default:
        return <PatientTabNavigator />;
    }
  };

  return (
    <NavigationContainer>
      {getNavigator()}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -8,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
});