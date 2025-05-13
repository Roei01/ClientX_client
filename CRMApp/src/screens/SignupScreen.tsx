import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
} from "react-native";
import axios from "axios";

const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    // Reset error message
    setErrorMessage("");

    // Basic validation
    if (
      !username ||
      !email ||
      !firstName ||
      !lastName ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage("נא למלא את כל השדות");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("הסיסמאות אינן תואמות");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage("נא להזין כתובת אימייל תקינה");
      return;
    }

    // Password validation (at least 6 characters)
    if (password.length < 6) {
      setErrorMessage("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setIsLoading(true);

    try {
      console.log(
        "Making signup request to:",
        "http://localhost:30000/api/auth/signup"
      );
      const response = await axios.post(
        "http://localhost:30000/api/auth/signup",
        {
          username,
          email,
          firstName,
          lastName,
          password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Signup API response:", response.status, response.statusText);
      setIsLoading(false);

      if (response.data && response.data.success) {
        console.log("Signup successful");
        Alert.alert("הרשמה הצליחה", "המשתמש נרשם בהצלחה. ניתן להתחבר כעת.", [
          {
            text: "המשך להתחברות",
            onPress: () => navigation.navigate("Login"),
          },
        ]);
      } else {
        console.log("Signup unsuccessful:", response.data);
        setErrorMessage(response.data?.message || "ההרשמה נכשלה");
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Signup error details:", error);

      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);

        setErrorMessage(error.response.data?.message || "אירעה שגיאה בהרשמה");
      } else if (error.request) {
        console.error("No response received:", error.request);
        setErrorMessage("אירעה שגיאה בתקשורת עם השרת. אנא נסה שוב מאוחר יותר.");
      } else {
        console.error("Error setting up request:", error.message);
        setErrorMessage("אירעה שגיאה בהרשמה. אנא נסה שוב.");
      }
      console.error("Signup error:", error);
    }
  };

  return (
    <ImageBackground
      source={require("../image/1.jpg")}
      style={styles.background}
      imageStyle={{ opacity: 0.1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollView}>
        <View style={styles.container}>
          <Text style={styles.title}>יצירת חשבון חדש</Text>

          {errorMessage ? (
            <Text style={styles.error}>{errorMessage}</Text>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>שם משתמש</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן שם משתמש"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>דואר אלקטרוני</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן דואר אלקטרוני"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>שם פרטי</Text>
              <TextInput
                style={styles.input}
                placeholder="הזן שם פרטי"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>

            <View style={[styles.formGroup, styles.halfWidth]}>
              <Text style={styles.label}>שם משפחה</Text>
              <TextInput
                style={styles.input}
                placeholder="הזן שם משפחה"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>סיסמה</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן סיסמה (לפחות 6 תווים)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>אימות סיסמה</Text>
            <TextInput
              style={styles.input}
              placeholder="הזן סיסמה שוב"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? "בתהליך הרשמה..." : "הרשמה"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.linkText}>כבר יש לך חשבון? התחבר/י כאן</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
    color: "#333",
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: "500",
    color: "#555",
    textAlign: "right",
  },
  input: {
    height: 50,
    borderColor: "#ddd",
    borderWidth: 1,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#fff",
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  error: {
    color: "#e74c3c",
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#fde8e7",
    borderRadius: 5,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#28a745",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 15,
  },
  buttonDisabled: {
    backgroundColor: "#95d5a5",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  linkText: {
    color: "#0066cc",
    fontSize: 16,
    textAlign: "center",
  },
});

export default SignupScreen;
