import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import axios from "axios";
import { AuthContext } from "../App";

const SERVER_URL = "http://localhost:30000";

interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const NotificationsScreen = () => {
  const { authToken } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SERVER_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("שגיאה", "שגיאה בטעינת התראות");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await axios.put(
        `${SERVER_URL}/api/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        // Update local state
        setNotifications((prevNotifications) =>
          prevNotifications.map((notification) =>
            notification._id === notificationId
              ? { ...notification, isRead: true }
              : notification
          )
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      Alert.alert("שגיאה", "שגיאה בסימון התראה כנקראה");
    }
  };

  const markAllAsRead = async () => {
    try {
      setLoading(true);
      const response = await axios.put(
        `${SERVER_URL}/api/notifications/read-all`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        // Update all notifications to be read
        setNotifications((prevNotifications) =>
          prevNotifications.map((notification) => ({
            ...notification,
            isRead: true,
          }))
        );
        Alert.alert("הצלחה", "כל ההתראות סומנו כנקראו");
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      Alert.alert("שגיאה", "שגיאה בסימון כל ההתראות כנקראות");
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await axios.delete(
        `${SERVER_URL}/api/notifications/${notificationId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        // Remove notification from local state
        setNotifications((prevNotifications) =>
          prevNotifications.filter(
            (notification) => notification._id !== notificationId
          )
        );
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      Alert.alert("שגיאה", "שגיאה במחיקת התראה");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case "task":
        return "משימה";
      case "message":
        return "הודעה";
      case "system":
        return "מערכת";
      case "reminder":
        return "תזכורת";
      default:
        return "התראה";
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View
      style={[
        styles.notificationItem,
        !item.isRead && styles.unreadNotification,
      ]}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View
            style={[
              styles.notificationType,
              item.type === "task" && styles.taskType,
              item.type === "message" && styles.messageType,
              item.type === "system" && styles.systemType,
              item.type === "reminder" && styles.reminderType,
            ]}
          >
            <Text style={styles.notificationTypeText}>
              {getNotificationTypeText(item.type)}
            </Text>
          </View>
          <Text style={styles.notificationDate}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
      </View>

      <View style={styles.notificationActions}>
        {!item.isRead && (
          <TouchableOpacity
            style={[styles.actionButton, styles.readButton]}
            onPress={() => markAsRead(item._id)}
          >
            <Text style={styles.actionButtonText}>סמן כנקרא</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => deleteNotification(item._id)}
        >
          <Text style={styles.actionButtonText}>מחק</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = () => {
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    return (
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>התראות</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
          >
            <Text style={styles.markAllText}>סמן הכל כנקרא</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.notificationsList}
        ListHeaderComponent={renderHeader}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyText}>אין התראות להצגה</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f4",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  unreadBadge: {
    backgroundColor: "#e74c3c",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    paddingHorizontal: 8,
  },
  unreadCount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  markAllButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 5,
  },
  markAllText: {
    color: "#fff",
    fontWeight: "bold",
  },
  notificationsList: {
    paddingBottom: 20,
  },
  notificationItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 20,
    marginTop: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadNotification: {
    borderRightWidth: 4,
    borderRightColor: "#0066cc",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  notificationType: {
    backgroundColor: "#95a5a6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  taskType: {
    backgroundColor: "#2ecc71",
  },
  messageType: {
    backgroundColor: "#3498db",
  },
  systemType: {
    backgroundColor: "#e67e22",
  },
  reminderType: {
    backgroundColor: "#9b59b6",
  },
  notificationTypeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  notificationDate: {
    color: "#7f8c8d",
    fontSize: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  notificationBody: {
    fontSize: 14,
    color: "#555",
    marginBottom: 10,
  },
  notificationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    marginLeft: 8,
  },
  readButton: {
    backgroundColor: "#0066cc",
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
});

export default NotificationsScreen;
