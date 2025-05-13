import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import axios from "axios";
import { AuthContext } from "../App";

interface Message {
  _id: string;
  subject: string;
  content: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  recipients: Array<{
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      username: string;
    };
    readAt: Date | null;
  }>;
  createdAt: string;
  isRead: boolean;
  isPriority: boolean;
}

interface MessageListResponse {
  success: boolean;
  messages: Message[];
  unreadCount: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

const MessagesScreen = () => {
  const { authToken, userInfo } = useContext(AuthContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [composeModalVisible, setComposeModalVisible] = useState(false);
  const [composeData, setComposeData] = useState({
    recipients: "",
    subject: "",
    content: "",
  });
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchMessages();
  }, [activeFolder, currentPage, searchQuery]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get<MessageListResponse>(
        `http://localhost:30000/api/messages?folder=${activeFolder}&page=${currentPage}&search=${searchQuery}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        if (currentPage === 1) {
          setMessages(response.data.messages);
        } else {
          setMessages((prev) => [...prev, ...response.data.messages]);
        }
        setUnreadCount(response.data.unreadCount);
        setHasMorePages(currentPage < response.data.pagination.pages);
      } else {
        Alert.alert("Error", "Failed to fetch messages");
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      Alert.alert("Error", "An error occurred while fetching messages");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setCurrentPage(1);
    fetchMessages();
  };

  const handleLoadMore = () => {
    if (hasMorePages && !loading) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleViewMessage = async (message: Message) => {
    try {
      const response = await axios.get(
        `http://localhost:30000/api/messages/${message._id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.data.success) {
        setSelectedMessage(response.data.message);
        setViewModalVisible(true);

        // If the message wasn't read, refresh the list after viewing
        if (!message.isRead) {
          setTimeout(() => {
            fetchMessages();
          }, 500);
        }
      } else {
        Alert.alert("Error", "Failed to fetch message details");
      }
    } catch (error) {
      console.error("Error viewing message:", error);
      Alert.alert("Error", "An error occurred while viewing the message");
    }
  };

  const handleSendMessage = async () => {
    try {
      if (
        !composeData.recipients.trim() ||
        !composeData.subject.trim() ||
        !composeData.content.trim()
      ) {
        Alert.alert("Error", "Please fill all fields");
        return;
      }

      // Parse recipient usernames
      const recipientUsernames = composeData.recipients
        .split(",")
        .map((username) => username.trim())
        .filter((username) => username.length > 0);

      const response = await axios.post(
        "http://localhost:30000/api/messages",
        {
          recipients: recipientUsernames,
          subject: composeData.subject,
          content: composeData.content,
          isPriority: false,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        Alert.alert("Success", "Message sent successfully");
        setComposeModalVisible(false);
        setComposeData({
          recipients: "",
          subject: "",
          content: "",
        });

        // If we're in sent folder, refresh immediately
        if (activeFolder === "sent") {
          fetchMessages();
        }
      } else {
        Alert.alert("Error", response.data.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "An error occurred while sending the message");
    }
  };

  const handleReplyToMessage = async () => {
    if (!selectedMessage || !messageContent.trim()) {
      Alert.alert("Error", "Message content cannot be empty");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:30000/api/messages",
        {
          recipients: [selectedMessage.sender.username],
          subject: `Re: ${selectedMessage.subject}`,
          content: messageContent,
          parentMessage: selectedMessage._id,
          isPriority: false,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        Alert.alert("Success", "Reply sent successfully");
        setMessageContent("");
        setViewModalVisible(false);

        // If we're in sent folder, refresh immediately
        if (activeFolder === "sent") {
          fetchMessages();
        }
      } else {
        Alert.alert("Error", response.data.message || "Failed to send reply");
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      Alert.alert("Error", "An error occurred while sending the reply");
    }
  };

  const renderItem = ({ item }: { item: Message }) => (
    <TouchableOpacity
      style={[styles.messageItem, !item.isRead && styles.unreadMessage]}
      onPress={() => handleViewMessage(item)}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.messageSender}>
          {activeFolder === "sent"
            ? `To: ${item.recipients
                .map((r) => r.user.firstName + " " + r.user.lastName)
                .join(", ")}`
            : `From: ${item.sender.firstName} ${item.sender.lastName}`}
        </Text>
        <Text style={styles.messageDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.messageSubject} numberOfLines={1}>
        {item.isPriority && <Text style={styles.priorityIndicator}>! </Text>}
        {item.subject}
      </Text>
      <Text style={styles.messagePreview} numberOfLines={2}>
        {item.content}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No messages found</Text>
    </View>
  );

  // Use this function for icons
  const Icon = ({ type }: { type: string }) => {
    // Use emoji or unicode symbols as fallback icons
    switch (type) {
      case "pencil":
        return <Text style={{ fontSize: 20 }}>✏️</Text>;
      case "chevron-left":
        return <Text style={{ fontSize: 20 }}>←</Text>;
      case "times":
        return <Text style={{ fontSize: 20 }}>✕</Text>;
      default:
        return <Text style={{ fontSize: 20 }}>•</Text>;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => setComposeModalVisible(true)}
        >
          <Icon type="pencil" />
          <Text style={styles.composeButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.folderTabs}>
        <TouchableOpacity
          style={[
            styles.folderTab,
            activeFolder === "inbox" && styles.activeFolder,
          ]}
          onPress={() => {
            setActiveFolder("inbox");
            setCurrentPage(1);
          }}
        >
          <Text style={styles.folderText}>Inbox</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.folderTab,
            activeFolder === "sent" && styles.activeFolder,
          ]}
          onPress={() => {
            setActiveFolder("sent");
            setCurrentPage(1);
          }}
        >
          <Text style={styles.folderText}>Sent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.folderTab,
            activeFolder === "archived" && styles.activeFolder,
          ]}
          onPress={() => {
            setActiveFolder("archived");
            setCurrentPage(1);
          }}
        >
          <Text style={styles.folderText}>Archived</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? renderEmptyList : null}
        ListFooterComponent={
          loading && messages.length > 0 ? (
            <ActivityIndicator style={styles.loader} />
          ) : null
        }
      />

      {/* View Message Modal */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setViewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setViewModalVisible(false)}
            >
              <Icon type="chevron-left" />
              <Text style={styles.closeButtonText}>Back</Text>
            </TouchableOpacity>
          </View>

          {selectedMessage && (
            <ScrollView style={styles.messageDetailContainer}>
              <Text style={styles.messageDetailSubject}>
                {selectedMessage.subject}
              </Text>
              <View style={styles.messageDetailMeta}>
                <Text style={styles.messageDetailSender}>
                  From: {selectedMessage.sender.firstName}{" "}
                  {selectedMessage.sender.lastName}
                </Text>
                <Text style={styles.messageDetailRecipients}>
                  To:{" "}
                  {selectedMessage.recipients
                    .map((r) => `${r.user.firstName} ${r.user.lastName}`)
                    .join(", ")}
                </Text>
                <Text style={styles.messageDetailDate}>
                  {new Date(selectedMessage.createdAt).toLocaleString()}
                </Text>
              </View>
              <View style={styles.messageDetailContentContainer}>
                <Text style={styles.messageDetailContent}>
                  {selectedMessage.content}
                </Text>
              </View>

              <View style={styles.replyContainer}>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Type your reply here..."
                  multiline
                  value={messageContent}
                  onChangeText={setMessageContent}
                />
                <TouchableOpacity
                  style={styles.replyButton}
                  onPress={handleReplyToMessage}
                >
                  <Text style={styles.replyButtonText}>Reply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Compose Message Modal */}
      <Modal
        visible={composeModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setComposeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setComposeModalVisible(false)}
            >
              <Icon type="times" />
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.composeContainer}>
            <TextInput
              style={styles.composeInput}
              placeholder="Recipients (comma separated usernames)"
              value={composeData.recipients}
              onChangeText={(text) =>
                setComposeData({ ...composeData, recipients: text })
              }
            />
            <TextInput
              style={styles.composeInput}
              placeholder="Subject"
              value={composeData.subject}
              onChangeText={(text) =>
                setComposeData({ ...composeData, subject: text })
              }
            />
            <TextInput
              style={styles.composeContentInput}
              placeholder="Message content"
              multiline
              textAlignVertical="top"
              value={composeData.content}
              onChangeText={(text) =>
                setComposeData({ ...composeData, content: text })
              }
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  composeButton: {
    flexDirection: "row",
    backgroundColor: "#0066cc",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
  },
  composeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 5,
  },
  folderTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  folderTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  activeFolder: {
    borderBottomWidth: 2,
    borderBottomColor: "#0066cc",
  },
  folderText: {
    color: "#333",
    fontWeight: "500",
  },
  badgeContainer: {
    backgroundColor: "#e74c3c",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  listContainer: {
    padding: 10,
    flexGrow: 1,
  },
  messageItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#ddd",
  },
  unreadMessage: {
    borderLeftColor: "#0066cc",
    backgroundColor: "#f0f8ff",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  messageSender: {
    fontWeight: "500",
    fontSize: 14,
    color: "#333",
  },
  messageDate: {
    fontSize: 12,
    color: "#666",
  },
  messageSubject: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
    color: "#222",
  },
  priorityIndicator: {
    color: "#e74c3c",
    fontWeight: "bold",
  },
  messagePreview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  loader: {
    marginVertical: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 40 : 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#0066cc",
    fontSize: 16,
    marginLeft: 5,
  },
  sendButton: {
    backgroundColor: "#0066cc",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  messageDetailContainer: {
    padding: 15,
  },
  messageDetailSubject: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  messageDetailMeta: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 5,
  },
  messageDetailSender: {
    fontSize: 14,
    marginBottom: 5,
  },
  messageDetailRecipients: {
    fontSize: 14,
    marginBottom: 5,
  },
  messageDetailDate: {
    fontSize: 12,
    color: "#666",
  },
  messageDetailContentContainer: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 20,
  },
  messageDetailContent: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  replyContainer: {
    marginTop: 10,
    marginBottom: 30,
  },
  replyInput: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 15,
    minHeight: 100,
    fontSize: 16,
    marginBottom: 10,
    textAlignVertical: "top",
  },
  replyButton: {
    backgroundColor: "#0066cc",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  replyButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  composeContainer: {
    padding: 15,
  },
  composeInput: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  composeContentInput: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 15,
    minHeight: 200,
    fontSize: 16,
    marginBottom: 15,
  },
});

export default MessagesScreen;
