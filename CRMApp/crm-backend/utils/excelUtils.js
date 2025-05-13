const xlsx = require('xlsx');
const excel4node = require('excel4node');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

/**
 * Import data from Excel file
 * @param {string} filePath - Path to Excel file
 * @param {object} options - Import options
 * @param {string} options.sheetName - Sheet name to import (optional)
 * @param {function} options.mapFunction - Function to map excel rows to objects
 * @returns {Array} Array of objects parsed from Excel
 */
const importFromExcel = (filePath, options = {}) => {
  try {
    // Read the Excel file
    const workbook = xlsx.readFile(filePath);
    
    // Get the sheet name (either specified or first sheet)
    const sheetName = options.sheetName || workbook.SheetNames[0];
    
    // Get the worksheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert the worksheet to JSON
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
    
    // If mapFunction is provided, map the data
    if (options.mapFunction && typeof options.mapFunction === 'function') {
      return jsonData.map(options.mapFunction);
    }
    
    return jsonData;
  } catch (error) {
    throw new Error(`Error importing from Excel: ${error.message}`);
  }
};

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {object} options - Export options
 * @param {string} options.fileName - Output file name
 * @param {string} options.sheetName - Sheet name
 * @param {Array} options.columns - Column definitions [{header: 'Column1', key: 'prop1', width: 20}, ...]
 * @param {string} options.directory - Directory to save file (default: uploads/exports)
 * @returns {string} Path to the exported file
 */
const exportToExcel = (data, options) => {
  try {
    // Create a new workbook
    const workbook = new excel4node.Workbook();
    
    // Add a worksheet
    const worksheet = workbook.addWorksheet(options.sheetName || 'Sheet 1');
    
    // Add column headers with styles
    const headerStyle = workbook.createStyle({
      font: {
        bold: true,
        color: '#ffffff',
      },
      fill: {
        type: 'pattern',
        patternType: 'solid',
        fgColor: '#4472C4',
      },
      border: {
        left: {
          style: 'thin',
          color: '#000000',
        },
        right: {
          style: 'thin',
          color: '#000000',
        },
        top: {
          style: 'thin',
          color: '#000000',
        },
        bottom: {
          style: 'thin',
          color: '#000000',
        },
      },
    });
    
    // Add header row
    options.columns.forEach((column, columnIndex) => {
      worksheet.cell(1, columnIndex + 1)
        .string(column.header)
        .style(headerStyle);
      
      // Set column width if specified
      if (column.width) {
        worksheet.column(columnIndex + 1).setWidth(column.width);
      }
    });
    
    // Add data rows
    const dataStyle = workbook.createStyle({
      border: {
        left: {
          style: 'thin',
          color: '#000000',
        },
        right: {
          style: 'thin',
          color: '#000000',
        },
        top: {
          style: 'thin',
          color: '#000000',
        },
        bottom: {
          style: 'thin',
          color: '#000000',
        },
      },
    });
    
    data.forEach((item, rowIndex) => {
      options.columns.forEach((column, columnIndex) => {
        const cellValue = item[column.key];
        const cell = worksheet.cell(rowIndex + 2, columnIndex + 1).style(dataStyle);
        
        // Handle different data types
        if (cellValue === null || cellValue === undefined) {
          cell.string('');
        } else if (cellValue instanceof Date) {
          cell.date(cellValue).style({ numberFormat: 'yyyy-mm-dd hh:mm:ss' });
        } else if (typeof cellValue === 'number') {
          cell.number(cellValue);
        } else if (typeof cellValue === 'boolean') {
          cell.bool(cellValue);
        } else if (mongoose.Types.ObjectId.isValid(cellValue)) {
          cell.string(cellValue.toString());
        } else {
          cell.string(String(cellValue));
        }
      });
    });
    
    // Create directory if it doesn't exist
    const directory = options.directory || path.join(__dirname, '../uploads/exports');
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Generate filename with timestamp if not provided
    const fileName = options.fileName || `export_${Date.now()}.xlsx`;
    const filePath = path.join(directory, fileName);
    
    // Write to file
    return new Promise((resolve, reject) => {
      workbook.write(filePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(filePath);
        }
      });
    });
  } catch (error) {
    throw new Error(`Error exporting to Excel: ${error.message}`);
  }
};

/**
 * Parse Excel date (numeric value) to JavaScript Date
 * @param {number} excelDate - Excel date value
 * @returns {Date} JavaScript Date object
 */
const parseExcelDate = (excelDate) => {
  // Excel dates are number of days since 1900-01-01
  // With an adjustment for the Excel leap year bug
  const millisecondsSince1900 = (excelDate - 25569) * 86400 * 1000;
  return new Date(millisecondsSince1900);
};

module.exports = {
  importFromExcel,
  exportToExcel,
  parseExcelDate
}; 