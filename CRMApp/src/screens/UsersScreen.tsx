import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import axios from "axios";

const SERVER_URL = "http://localhost:30000"; // Update with your server URL

const UsersScreen = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SERVER_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${global.authToken}`,
        },
      });

      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      Alert.alert("שגיאה", "שגיאה בטעינת משתמשים");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setFirstName("");
    setLastName("");
    setPassword("");
    setRole("employee");
    setIsActive(true);
    setSelectedUser(null);
    setIsEditMode(false);
  };

  const openAddUserModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditUserModal = (user) => {
    setSelectedUser(user);
    setUsername(user.username);
    setEmail(user.email);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPassword(""); // Don't populate password field for security
    setRole(user.role);
    setIsActive(user.isActive);
    setIsEditMode(true);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (
      !username ||
      !email ||
      !firstName ||
      !lastName ||
      (!isEditMode && !password)
    ) {
      Alert.alert("שגיאה", "נא למלא את כל השדות");
      return;
    }

    try {
      setLoading(true);

      const userData = {
        username,
        email,
        firstName,
        lastName,
        role,
        isActive,
      };

      if (password) {
        userData.password = password;
      }

      let response;

      if (isEditMode) {
        // Update existing user
        response = await axios.put(
          `${SERVER_URL}/api/users/${selectedUser._id}`,
          userData,
          {
            headers: {
              Authorization: `Bearer ${global.authToken}`,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        // Create new user
        response = await axios.post(
          `${SERVER_URL}/api/users/register`,
          userData,
          {
            headers: {
              Authorization: `Bearer ${global.authToken}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      if (response.data.success) {
        setModalVisible(false);
        resetForm();
        fetchUsers();
        Alert.alert(
          "הצלחה",
          isEditMode ? "המשתמש עודכן בהצלחה" : "המשתמש נוצר בהצלחה"
        );
      }
    } catch (error) {
      console.error("Error saving user:", error);
      Alert.alert(
        "שגיאה",
        error.response?.data?.message || "שגיאה בשמירת המשתמש"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    Alert.alert("אישור מחיקה", "האם אתה בטוח שברצונך למחוק את המשתמש?", [
      {
        text: "ביטול",
        style: "cancel",
      },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            const response = await axios.delete(
              `${SERVER_URL}/api/users/${userId}`,
              {
                headers: {
                  Authorization: `Bearer ${global.authToken}`,
                },
              }
            );

            if (response.data.success) {
              fetchUsers();
              Alert.alert("הצלחה", "המשתמש נמחק בהצלחה");
            }
          } catch (error) {
            console.error("Error deleting user:", error);
            Alert.alert(
              "שגיאה",
              error.response?.data?.message || "שגיאה במחיקת המשתמש"
            );
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const renderRoleText = (role) => {
    switch (role) {
      case "admin":
        return "מנהל";
      case "manager":
        return "מנהל צוות";
      case "teamLeader":
        return "ראש צוות";
      default:
        return "עובד";
    }
  };

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.userDetails}>שם משתמש: {item.username}</Text>
        <Text style={styles.userDetails}>דוא״ל: {item.email}</Text>
        <Text style={styles.userDetails}>
          תפקיד: {renderRoleText(item.role)}
        </Text>
        <Text
          style={[
            styles.statusText,
            { color: item.isActive ? "green" : "red" },
          ]}
        >
          {item.isActive ? "פעיל" : "לא פעיל"}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditUserModal(item)}
        >
          <Text style={styles.buttonText}>ערוך</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(item._id)}
        >
          <Text style={styles.buttonText}>מחק</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ניהול משתמשים</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddUserModal}>
          <Text style={styles.addButtonText}>+ הוסף משתמש</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Text style={styles.emptyText}>אין משתמשים להצגה</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit User Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>
              {isEditMode ? "עריכת משתמש" : "הוספת משתמש חדש"}
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>שם משתמש:</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="שם משתמש"
                  editable={!isEditMode} // Can't edit username for existing users
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>דוא״ל:</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="דוא״ל"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>שם פרטי:</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="שם פרטי"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>שם משפחה:</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="שם משפחה"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>סיסמה:</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={
                    isEditMode ? "השאר ריק לשמור על הסיסמה הקיימת" : "סיסמה"
                  }
                  secureTextEntry={true}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>תפקיד:</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={[
                      styles.rolePicker,
                      role === "admin" && styles.selectedRole,
                    ]}
                    onPress={() => setRole("admin")}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        role === "admin" && styles.selectedRoleText,
                      ]}
                    >
                      מנהל
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.rolePicker,
                      role === "manager" && styles.selectedRole,
                    ]}
                    onPress={() => setRole("manager")}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        role === "manager" && styles.selectedRoleText,
                      ]}
                    >
                      מנהל צוות
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.rolePicker,
                      role === "teamLeader" && styles.selectedRole,
                    ]}
                    onPress={() => setRole("teamLeader")}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        role === "teamLeader" && styles.selectedRoleText,
                      ]}
                    >
                      ראש צוות
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.rolePicker,
                      role === "employee" && styles.selectedRole,
                    ]}
                    onPress={() => setRole("employee")}
                  >
                    <Text
                      style={[
                        styles.roleText,
                        role === "employee" && styles.selectedRoleText,
                      ]}
                    >
                      עובד
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.switchContainer}>
                <Text style={styles.label}>משתמש פעיל:</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: "#767577", true: "#0066cc" }}
                  thumbColor={isActive ? "#fff" : "#f4f3f4"}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.buttonText}>שמור</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f4f4",
    padding: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  addButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    paddingBottom: 20,
  },
  userItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  userDetails: {
    fontSize: 14,
    color: "#555",
    marginBottom: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 5,
  },
  actions: {
    justifyContent: "center",
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    marginBottom: 5,
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#0066cc",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    width: "90%",
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: "#333",
  },
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  rolePicker: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    width: "48%",
    alignItems: "center",
  },
  selectedRole: {
    backgroundColor: "#0066cc",
    borderColor: "#0066cc",
  },
  roleText: {
    color: "#333",
  },
  selectedRoleText: {
    color: "#fff",
    fontWeight: "bold",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: "#0066cc",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
  },
});

export default UsersScreen;
