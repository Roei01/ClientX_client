import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import {
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";

const CustomDrawerContent = (props) => {
  const handleLogout = () => {
    // Clear auth token
    global.authToken = null;
    global.userInfo = null;

    // Force app to re-render and show login screen
    props.navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props}>
        <View style={styles.drawerHeader}>
          <Image
            source={require("../image/1.jpg")}
            style={styles.profileImage}
          />
          <View style={styles.userInfoSection}>
            <Text style={styles.userName}>
              {global.userInfo?.firstName} {global.userInfo?.lastName}
            </Text>
            <Text style={styles.userRole}>{global.userInfo?.role}</Text>
          </View>
        </View>

        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View style={styles.bottomDrawerSection}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>התנתק</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawerHeader: {
    padding: 20,
    backgroundColor: "#0066cc",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    height: 60,
    width: 60,
    borderRadius: 30,
    marginRight: 10,
  },
  userInfoSection: {
    marginLeft: 10,
  },
  userName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  userRole: {
    color: "#d0d0d0",
    fontSize: 14,
  },
  bottomDrawerSection: {
    borderTopColor: "#f4f4f4",
    borderTopWidth: 1,
    padding: 15,
  },
  logoutButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#dc3545",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default CustomDrawerContent;
