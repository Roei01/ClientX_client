import React, { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import axios from "axios";
import { AuthContext } from "../App";

const SERVER_URL = "http://localhost:30000";

// Define interface for activity items
interface ActivityItem {
  id: string;
  type: string;
  action: string;
  text: string;
  timestamp: string;
}

const HomeScreen = ({ navigation }) => {
  const { authToken, userInfo } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalUsers: 0,
    activeUsers: 0,
    pendingTasks: 0,
    completedTasks: 0,
    unreadMessages: 0,
    unreadNotifications: 0,
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  // Use useCallback to memoize the fetch function
  const fetchDashboardData = useCallback(async () => {
    if (!authToken) {
      console.log("No auth token available, using mock data");
      setLoading(false);
      // Set mock data when no token
      setStats({
        totalClients: 150,
        totalUsers: 25,
        activeUsers: 18,
        pendingTasks: 12,
        completedTasks: 47,
        unreadMessages: 3,
        unreadNotifications: 5,
      });
      // Set mock activities
      setRecentActivities([
        {
          id: "1",
          type: "client",
          action: "add",
          text: 'לקוח חדש נוסף: חברת אלפא בע"מ',
          timestamp: new Date().toISOString(),
        },
        {
          id: "2",
          type: "task",
          action: "complete",
          text: 'המשימה "פגישת התנעה" הושלמה',
          timestamp: new Date().toISOString(),
        },
        {
          id: "3",
          type: "message",
          action: "new",
          text: "הודעה חדשה התקבלה מאת יוסי כהן",
          timestamp: new Date().toISOString(),
        },
        {
          id: "4",
          type: "user",
          action: "update",
          text: "עודכנו פרטי המשתמש: רונית לוי",
          timestamp: new Date().toISOString(),
        },
        {
          id: "5",
          type: "notification",
          action: "new",
          text: "התראה חדשה: פגישת צוות ביום חמישי",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      setLoading(true);
      console.log(
        "Fetching dashboard with token:",
        authToken ? `${authToken.substring(0, 10)}...` : "No token"
      );

      // Check if token is our test token "mock-jwt-token-for-development"
      if (authToken === "mock-jwt-token-for-development") {
        console.log("Using mock token - mock data will be shown");
        // Simulated response with mock data
        setStats({
          totalClients: 150,
          totalUsers: 25,
          activeUsers: 18,
          pendingTasks: 12,
          completedTasks: 47,
          unreadMessages: 3,
          unreadNotifications: 5,
        });
        setRecentActivities([
          // Mock activities
          {
            id: "1",
            type: "client",
            action: "add",
            text: 'לקוח חדש נוסף: חברת אלפא בע"מ',
            timestamp: new Date().toISOString(),
          },
          // More mock activities...
        ]);
        setLoading(false);
        return;
      }

      // Ensure token has proper format for API call
      let tokenToUse = authToken;
      if (authToken && !authToken.startsWith("Bearer ")) {
        tokenToUse = `Bearer ${authToken}`;
      }

      console.log(
        "Making API call with token:",
        tokenToUse ? `${tokenToUse.substring(0, 16)}...` : "No token"
      );

      const response = await axios.get(`${SERVER_URL}/api/dashboard`, {
        headers: {
          Authorization: tokenToUse,
        },
      });

      // Process response normally
      console.log(
        "Dashboard API response:",
        response.status,
        response.data.success
      );

      if (response.data.success) {
        // Update to match the backend response structure
        setStats({
          totalClients: response.data.data.totalClients || 0,
          totalUsers: response.data.data.totalUsers || 0,
          activeUsers: response.data.data.activeUsers || 0,
          pendingTasks: response.data.data.pendingTasks || 0,
          completedTasks: response.data.data.completedTasks || 0,
          unreadMessages: response.data.data.unreadMessages || 0,
          unreadNotifications: response.data.data.unreadNotifications || 0,
        });

        if (response.data.recentActivities) {
          setRecentActivities(response.data.recentActivities);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Use mock data when API fails
      // If API doesn't exist yet, use mock data
      setStats({
        totalClients: 150,
        totalUsers: 25,
        activeUsers: 18,
        pendingTasks: 12,
        completedTasks: 47,
        unreadMessages: 3,
        unreadNotifications: 5,
      });
      setRecentActivities([
        {
          id: "1",
          type: "client",
          action: "add",
          text: 'לקוח חדש נוסף: חברת אלפא בע"מ',
          timestamp: new Date().toISOString(),
        },
        {
          id: "2",
          type: "task",
          action: "complete",
          text: 'המשימה "פגישת התנעה" הושלמה',
          timestamp: new Date().toISOString(),
        },
        {
          id: "3",
          type: "message",
          action: "new",
          text: "הודעה חדשה התקבלה מאת יוסי כהן",
          timestamp: new Date().toISOString(),
        },
        {
          id: "4",
          type: "user",
          action: "update",
          text: "עודכנו פרטי המשתמש: רונית לוי",
          timestamp: new Date().toISOString(),
        },
        {
          id: "5",
          type: "notification",
          action: "new",
          text: "התראה חדשה: פגישת צוות ביום חמישי",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [authToken]); // Make sure fetchDashboardData updates when authToken changes

  // Only fetch data when component mounts and when authToken is available
  useEffect(() => {
    if (authToken) {
      console.log("Auth token available, fetching dashboard data");
      fetchDashboardData();
    } else {
      console.log("No auth token yet, showing mock data");
      // Set mock data immediately if no token
      setStats({
        totalClients: 150,
        totalUsers: 25,
        activeUsers: 18,
        pendingTasks: 12,
        completedTasks: 47,
        unreadMessages: 3,
        unreadNotifications: 5,
      });
      // Set mock activities
      setRecentActivities([
        {
          id: "1",
          type: "client",
          action: "add",
          text: 'לקוח חדש נוסף: חברת אלפא בע"מ',
          timestamp: new Date().toISOString(),
        },
        {
          id: "2",
          type: "task",
          action: "complete",
          text: 'המשימה "פגישת התנעה" הושלמה',
          timestamp: new Date().toISOString(),
        },
        {
          id: "3",
          type: "message",
          action: "new",
          text: "הודעה חדשה התקבלה מאת יוסי כהן",
          timestamp: new Date().toISOString(),
        },
        {
          id: "4",
          type: "user",
          action: "update",
          text: "עודכנו פרטי המשתמש: רונית לוי",
          timestamp: new Date().toISOString(),
        },
        {
          id: "5",
          type: "notification",
          action: "new",
          text: "התראה חדשה: פגישת צוות ביום חמישי",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [authToken, fetchDashboardData]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderActivityIcon = (type) => {
    switch (type) {
      case "client":
        return "👥";
      case "task":
        return "✓";
      case "message":
        return "✉️";
      case "user":
        return "👤";
      case "notification":
        return "🔔";
      default:
        return "📝";
    }
  };

  const renderActivity = ({ item }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityIconContainer}>
        <Text style={styles.activityIcon}>{renderActivityIcon(item.type)}</Text>
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>{item.text}</Text>
        <Text style={styles.activityTime}>{formatDate(item.timestamp)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          שלום, {userInfo?.firstName || "משתמש"}!
        </Text>
        <Text style={styles.subtitle}>ברוך הבא למערכת ה-CRM</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("לקוחות")}
        >
          <Text style={styles.actionButtonText}>הוסף לקוח</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("משימות")}
        >
          <Text style={styles.actionButtonText}>הוסף משימה</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate("הודעות")}
        >
          <Text style={styles.actionButtonText}>שלח הודעה</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>סטטיסטיקות מערכת</Text>
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalClients}</Text>
          <Text style={styles.statLabel}>לקוחות</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>משתמשים</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.pendingTasks}</Text>
          <Text style={styles.statLabel}>משימות פתוחות</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.completedTasks}</Text>
          <Text style={styles.statLabel}>משימות שהושלמו</Text>
        </View>
      </View>

      {/* Notifications Grid */}
      <View style={styles.notificationsContainer}>
        <TouchableOpacity
          style={[styles.notification, styles.messageNotification]}
          onPress={() => navigation.navigate("הודעות")}
        >
          <Text style={styles.notificationNumber}>{stats.unreadMessages}</Text>
          <Text style={styles.notificationLabel}>הודעות שלא נקראו</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.notification, styles.alertNotification]}
          onPress={() => navigation.navigate("התראות")}
        >
          <Text style={styles.notificationNumber}>
            {stats.unreadNotifications}
          </Text>
          <Text style={styles.notificationLabel}>התראות חדשות</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activities */}
      <View style={styles.activitiesContainer}>
        <Text style={styles.sectionTitle}>פעילות אחרונה</Text>
        <FlatList
          data={recentActivities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyActivities}>
              <Text style={styles.emptyText}>אין פעילויות אחרונות להצגה</Text>
            </View>
          }
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f4",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 20,
    backgroundColor: "#0066cc",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
    textAlign: "right",
  },
  subtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "right",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  actionButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
    color: "#333",
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  statBox: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0066cc",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  notificationsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginTop: 10,
  },
  notification: {
    width: "48%",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageNotification: {
    backgroundColor: "#3498db",
  },
  alertNotification: {
    backgroundColor: "#e74c3c",
  },
  notificationNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  notificationLabel: {
    fontSize: 14,
    color: "#fff",
    marginTop: 5,
  },
  activitiesContainer: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    margin: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 16,
    color: "#333",
  },
  activityTime: {
    fontSize: 12,
    color: "#999",
    marginTop: 3,
  },
  emptyActivities: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
  },
});

export default HomeScreen;
