import React, { useState, useEffect, createContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  Platform,
} from "react-native";

// Auth Screens
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";

// Main App Screens
import HomeScreen from "./screens/HomeScreen";
import ClientsScreen from "./screens/ClientsScreen";
import TasksScreen from "./screens/TasksScreen";
import SettingsScreen from "./screens/SettingsScreen";
import UsersScreen from "./screens/UsersScreen";
import ImportExportScreen from "./screens/ImportExportScreen";
import MessagesScreen from "./screens/MessagesScreen";
import NotificationsScreen from "./screens/NotificationsScreen";

// Custom Drawer Component
import CustomDrawerContent from "./components/CustomDrawerContent";

// Declare global variables for TypeScript
declare global {
  var authToken: string | null;
  var userInfo: any | null;
}

// Create an auth context to manage authentication state
interface AuthContextProps {
  authToken: string | null;
  userInfo: any | null;
  setAuth: (token: string | null, user: any | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextProps>({
  authToken: null,
  userInfo: null,
  setAuth: () => {},
  logout: () => {},
  isAuthenticated: false,
});

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Auth Navigator
const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
  </Stack.Navigator>
);

// Placeholder components for screens we'll create later
const ProfileScreen = () => (
  <View style={styles.center}>
    <Text>הפרופיל שלי</Text>
  </View>
);
const TeamsScreen = () => (
  <View style={styles.center}>
    <Text>ניהול צוותים</Text>
  </View>
);
const ReportsScreen = () => (
  <View style={styles.center}>
    <Text>דוחות</Text>
  </View>
);

// App Navigator with Drawer or Tabs based on platform
const AppNavigator = () => {
  // For web, use a simpler navigation to avoid Reanimated issues
  if (Platform.OS === "web") {
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#0066cc",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        <Stack.Screen name="דף הבית" component={HomeScreen} />
        <Stack.Screen name="לקוחות" component={ClientsScreen} />
        <Stack.Screen name="משתמשים" component={UsersScreen} />
        <Stack.Screen name="משימות" component={TasksScreen} />
        <Stack.Screen name="הודעות" component={MessagesScreen} />
        <Stack.Screen name="התראות" component={NotificationsScreen} />
        <Stack.Screen name="ייבוא וייצוא" component={ImportExportScreen} />
        <Stack.Screen name="הגדרות" component={SettingsScreen} />
      </Stack.Navigator>
    );
  }

  // For mobile, use drawer navigation
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: "#0066cc",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        drawerActiveBackgroundColor: "#0066cc",
        drawerActiveTintColor: "#fff",
        drawerInactiveTintColor: "#333",
      }}
    >
      <Drawer.Screen name="דף הבית" component={HomeScreen} />
      <Drawer.Screen name="לקוחות" component={ClientsScreen} />
      <Drawer.Screen name="משתמשים" component={UsersScreen} />
      <Drawer.Screen name="משימות" component={TasksScreen} />
      <Drawer.Screen name="הודעות" component={MessagesScreen} />
      <Drawer.Screen name="התראות" component={NotificationsScreen} />
      <Drawer.Screen name="צוותים" component={TeamsScreen} />
      <Drawer.Screen name="דוחות" component={ReportsScreen} />
      <Drawer.Screen name="ייבוא וייצוא" component={ImportExportScreen} />
      <Drawer.Screen name="הפרופיל שלי" component={ProfileScreen} />
      <Drawer.Screen name="הגדרות" component={SettingsScreen} />
    </Drawer.Navigator>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);

  // Set auth token and user info
  const setAuth = (token: string | null, user: any | null) => {
    console.log("Setting auth token:", token ? "Token exists" : "No token");
    console.log("Setting user info:", user);

    // Update the global variables for compatibility with existing code
    globalThis.authToken = token;
    globalThis.userInfo = user;

    // Update state
    setAuthToken(token);
    setUserInfo(user);
  };

  // Logout function
  const logout = () => {
    setAuth(null, null);
  };

  // Check if user is logged in
  useEffect(() => {
    // In a real app, check AsyncStorage for token
    // For development, we use a mock token if none exists
    setTimeout(() => {
      // Check if we have a token in global state (legacy approach)
      if (globalThis.authToken) {
        setAuthToken(globalThis.authToken);
        setUserInfo(globalThis.userInfo);
      } else {
        // For development, use a mock token if needed
        // Comment this out to require real login
        // setAuth('mock-token', {
        //   _id: 'mock-user-id',
        //   username: 'mockuser',
        //   firstName: 'Mock',
        //   lastName: 'User',
        //   role: 'admin'
        // });
      }
      setIsLoading(false);
    }, 1000);
  }, []);

  const authContextValue: AuthContextProps = {
    authToken,
    userInfo,
    setAuth,
    logout,
    isAuthenticated: !!authToken,
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <NavigationContainer>
        {authToken ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </AuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default App;
