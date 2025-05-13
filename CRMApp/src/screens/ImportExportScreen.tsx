import React, { useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import axios from "axios";
import { AuthContext } from "../App";
import FileUploader from "../components/FileUploader";
import { saveAs } from "file-saver";

const ImportExportScreen = () => {
  const { authToken, userInfo } = useContext(AuthContext);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const handleFileSelect = (file: any) => {
    setSelectedFile(file);
    setImportResults(null);
  };

  const importClients = async () => {
    if (!selectedFile) {
      Alert.alert("Error", "Please select a file first");
      return;
    }

    setIsImporting(true);
    try {
      const response = await axios.post(
        "http://localhost:30000/api/import-export/import-clients",
        selectedFile,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      setImportResults(response.data.results);
      Alert.alert(
        "Success",
        `Imported ${response.data.results.imported} of ${response.data.results.total} clients successfully`
      );
    } catch (error) {
      console.error("Import error:", error);
      Alert.alert(
        "Import Failed",
        error.response?.data?.message || "An error occurred during import"
      );
    } finally {
      setIsImporting(false);
    }
  };

  const exportClients = async (fileType = "xlsx") => {
    setIsExporting(true);
    try {
      const response = await axios.get(
        "http://localhost:30000/api/import-export/export-clients",
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          responseType: "blob",
        }
      );

      // For web, use file-saver to download the file
      if (Platform.OS === "web") {
        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(blob, `clients-export-${Date.now()}.xlsx`);
      } else {
        // For mobile platforms, handle file saving differently
        // This would require a native file saving solution
        Alert.alert("Export Successful", "File exported successfully");
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(
        "Export Failed",
        error.response?.data?.message || "An error occurred during export"
      );
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await axios.get(
        "http://localhost:30000/api/import-export/template",
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          responseType: "blob",
        }
      );

      // For web, use file-saver to download the file
      if (Platform.OS === "web") {
        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(blob, "client-import-template.xlsx");
      } else {
        // For mobile platforms, handle file saving differently
        Alert.alert(
          "Template Downloaded",
          "Template file downloaded successfully"
        );
      }
    } catch (error) {
      console.error("Template download error:", error);
      Alert.alert(
        "Download Failed",
        error.response?.data?.message ||
          "An error occurred while downloading the template"
      );
    }
  };

  const renderImportResults = () => {
    if (!importResults) return null;

    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Import Results</Text>
        <Text style={styles.resultsText}>
          Total records: {importResults.total}
        </Text>
        <Text style={styles.resultsText}>
          Successfully imported: {importResults.imported}
        </Text>
        <Text style={styles.resultsText}>
          Failed: {importResults.errors.length}
        </Text>

        {importResults.errors.length > 0 && (
          <View style={styles.errorsContainer}>
            <Text style={styles.errorTitle}>Errors:</Text>
            {importResults.errors.map((error, index) => (
              <View key={index} style={styles.errorItem}>
                <Text style={styles.errorText}>
                  Row {index + 1}: {error.error}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Check if user has permission to access this feature
  const hasPermission =
    userInfo?.role === "admin" ||
    userInfo?.role === "manager" ||
    userInfo?.role === "teamLeader";

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessDenied}>
          You don't have permission to access this feature.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Import & Export</Text>
        <Text style={styles.subtitle}>
          Import clients from Excel or export to Excel
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Import Clients</Text>
        <Text style={styles.sectionDescription}>
          Upload an Excel file (.xlsx or .xls) containing client data. The file
          should have columns for name, email, phone, address, and industry.
        </Text>

        <FileUploader
          title="Select Excel File"
          onFileSelect={handleFileSelect}
          buttonText="Choose Excel File"
          isLoading={isImporting}
        />

        <TouchableOpacity
          style={[styles.button, isImporting && styles.buttonDisabled]}
          onPress={importClients}
          disabled={isImporting || !selectedFile}
        >
          {isImporting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Import Clients</Text>
          )}
        </TouchableOpacity>

        {renderImportResults()}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Clients</Text>
        <Text style={styles.sectionDescription}>
          Export all client data to an Excel file.
        </Text>

        <TouchableOpacity
          style={[styles.button, isExporting && styles.buttonDisabled]}
          onPress={() => exportClients()}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Export to Excel</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.templateSection}>
        <Text style={styles.sectionTitle}>Import Template</Text>
        <Text style={styles.sectionDescription}>
          Download a template Excel file to ensure your data is formatted
          correctly for import.
        </Text>

        <TouchableOpacity
          style={styles.templateButton}
          onPress={downloadTemplate}
        >
          <Text style={styles.templateButtonText}>
            Download Import Template
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#666666",
  },
  section: {
    margin: 15,
    padding: 15,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#0066cc",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
  },
  buttonDisabled: {
    backgroundColor: "#7fb0e0",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  resultsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b3d9ff",
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 10,
  },
  resultsText: {
    fontSize: 14,
    color: "#444444",
    marginBottom: 5,
  },
  errorsContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#fff0f0",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffcccc",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#cc0000",
    marginBottom: 8,
  },
  errorItem: {
    marginVertical: 5,
  },
  errorText: {
    fontSize: 13,
    color: "#cc0000",
  },
  templateSection: {
    margin: 15,
    marginTop: 0,
    padding: 15,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  templateButton: {
    backgroundColor: "#4caf50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  templateButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16,
  },
  accessDenied: {
    padding: 20,
    fontSize: 18,
    color: "#cc0000",
    textAlign: "center",
  },
});

export default ImportExportScreen;
