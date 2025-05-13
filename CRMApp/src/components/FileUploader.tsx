import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";

interface FileUploaderProps {
  title?: string;
  onFileSelect: (file: any) => void;
  allowedTypes?: string;
  buttonText?: string;
  isLoading?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  title = "Upload File",
  onFileSelect,
  allowedTypes = ".xlsx,.xls",
  buttonText = "Choose File",
  isLoading = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError(null);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      console.log("Selected file:", file);

      // Create a FormData object for easier upload
      const formData = new FormData();
      formData.append("file", file);

      setSelectedFile({
        name: file.name,
        size: file.size,
        formData: formData,
      });

      onFileSelect(formData);
    } catch (err) {
      console.error("Error selecting file:", err);
      setError("Error selecting file. Please try again.");
    }
  };

  const selectFile = () => {
    if (Platform.OS === "web" && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Render a hidden input for web
  const renderFileInput = () => {
    if (Platform.OS === "web") {
      return (
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedTypes}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {renderFileInput()}

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={selectFile}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.buttonText}>{buttonText}</Text>
        )}
      </TouchableOpacity>

      {selectedFile && (
        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>Selected: {selectedFile.name}</Text>
          <Text style={styles.fileSize}>
            Size: {(selectedFile.size / 1024).toFixed(2)} KB
          </Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  uploadButton: {
    backgroundColor: "#0066cc",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  fileInfo: {
    marginTop: 16,
    padding: 10,
    backgroundColor: "#e8f4ff",
    borderRadius: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  fileSize: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  errorText: {
    color: "#e74c3c",
    marginTop: 10,
    fontSize: 14,
  },
});

export default FileUploader;
