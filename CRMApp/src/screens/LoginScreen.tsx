import axios from "axios";
import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { AuthContext } from "../App";
import { CommonActions } from "@react-navigation/native";

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setAuth } = useContext(AuthContext);

  // Clear error message when inputs change
  useEffect(() => {
    if (errorMessage) setErrorMessage("");
  }, [username, password]);

  const handleLogin = async () => {
    // Validate inputs
    if (!username || !password) {
      setErrorMessage("נא למלא שם משתמש וסיסמה");
      return;
    }

    setIsLoading(true);
    console.log("Attempting login with:", { username });

    // Check for the test user credentials
    if (username === "roeina" && password === "123456") {
      console.log("Using test user");
      setIsLoading(false);

      // Create mock user data
      const mockUser = {
        _id: "mock-user-id",
        username: "roeina",
        firstName: "Roei",
        lastName: "Nagar",
        role: "admin",
        isActive: true,
        lastActive: new Date(),
      };

      // Create mock token
      const mockToken = "mock-jwt-token-for-development";

      // Use AuthContext to set authentication state
      setAuth(mockToken, mockUser);

      // Navigate to home
      navigation.reset({
        index: 0,
        routes: [{ name: "דף הבית" }],
      });

      return;
    }

    try {
      console.log(
        "Making API request to:",
        "http://localhost:30000/api/auth/login"
      );
      const response = await axios.post(
        "http://localhost:30000/api/auth/login",
        {
          username,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("API response:", response.status, response.statusText);
      setIsLoading(false);

      if (response.data && response.data.success) {
        console.log("Login successful");
        setIsLoading(false);

        // Get token and user from response
        const token = response.data.token;
        const user = response.data.user;

        console.log("Token received:", token ? "Token exists" : "No token");

        // Ensure token is valid
        if (!token) {
          console.error("No token received in login response");
          setErrorMessage("שגיאת התחברות: לא התקבל טוקן מהשרת");
          return;
        }

        // Test token with a quick verification call
        try {
          const testResponse = await axios.get(
            "http://localhost:30000/api/auth/verify",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          console.log("Token verification:", testResponse.data);
        } catch (verifyError) {
          console.error("Token verification failed:", verifyError);
          // Continue anyway, might be that route doesn't exist
        }

        // Use AuthContext to set authentication state
        setAuth(token, user);

        // Use reset instead of CommonActions.navigate for proper navigation
        navigation.reset({
          index: 0,
          routes: [{ name: "דף הבית" }],
        });
      } else {
        console.log("Login response unsuccessful:", response.data);
        setErrorMessage(response.data?.message || "התחברות נכשלה");
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Login error details:", error);

      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);

        // Server responded with an error status
        if (error.response.status === 401) {
          setErrorMessage("שם משתמש או סיסמה שגויים");
        } else if (error.response.data && error.response.data.message) {
          setErrorMessage(error.response.data.message);
        } else {
          setErrorMessage("שגיאה בהתחברות, אנא נסה שוב");
        }
      } else if (error.request) {
        // No response received from the server
        console.error("Error request:", error.request);

        // Check if it's a connection issue to the backend
        if (error.message && error.message.includes("Network Error")) {
          setErrorMessage(
            "לא ניתן להתחבר לשרת. ודא שהשרת פועל ובדוק את החיבור לאינטרנט"
          );
        } else {
          setErrorMessage(
            "לא ניתן להתחבר לשרת. בדוק את החיבור לאינטרנט ונסה שוב"
          );
        }
      } else {
        // Error in request setup
        setErrorMessage("אירעה שגיאה בהתחברות, אנא נסה שוב");
      }
    }
  };

  return (
    <ImageBackground
      source={require("../image/1.jpg")}
      style={styles.background}
      imageStyle={{ opacity: 0.1 }}
    >
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image source={require("../image/1.jpg")} style={styles.logo} />
          <Text style={styles.logoText}>מערכת CRM</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.headerText}>כניסה למערכת</Text>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>שם משתמש</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן שם משתמש"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>סיסמה</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן סיסמה"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>התחברות</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() =>
              Alert.alert("שכחת סיסמה", "פנה למנהל המערכת לאיפוס סיסמה")
            }
          >
            <Text style={styles.linkText}>שכחת את הסיסמה?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.newAccountButton}
            onPress={() => navigation.navigate("Signup")}
          >
            <Text style={styles.newAccountButtonText}>צור חשבון חדש</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          © 2023 מערכת CRM - כל הזכויות שמורות
        </Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
  },
  formContainer: {
    width: "90%",
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  headerText: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  errorContainer: {
    backgroundColor: "#fde8e7",
    padding: 10,
    borderRadius: 5,
    width: "100%",
    marginBottom: 15,
  },
  errorMessage: {
    color: "#e74c3c",
    textAlign: "center",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    textAlign: "right",
    fontWeight: "500",
    color: "#555",
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#ddd",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  button: {
    backgroundColor: "#0066cc",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: "#7fb0e0",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    marginBottom: 10,
  },
  linkText: {
    color: "#0066cc",
    fontSize: 16,
  },
  newAccountButton: {
    backgroundColor: "#28a745",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  newAccountButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  footerText: {
    marginBottom: 20,
    color: "#555",
    fontSize: 14,
    textAlign: "center",
  },
});

export default LoginScreen;
