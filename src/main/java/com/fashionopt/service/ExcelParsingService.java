package com.fashionopt.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.text.DataFormat;
import java.text.SimpleDateFormat;
import java.util.Date;

@Service
public class ExcelParsingService {

    private static final Logger logger = LoggerFactory.getLogger(ExcelParsingService.class);

    public String parseExcelFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        StringBuilder sb = new StringBuilder();
        Workbook workbook = null;
        InputStream inputStream = null;

        try {
            inputStream = file.getInputStream();
            // Use WorkbookFactory for auto-detection of .xls and .xlsx
            workbook = WorkbookFactory.create(inputStream);

            for (Sheet sheet : workbook) {
                sb.append("Sheet: ").append(sheet.getSheetName()).append("\n");
                for (Row row : sheet) {
                    for (Cell cell : row) {
                        switch (cell.getCellType()) {
                            case STRING:
                                sb.append(cell.getStringCellValue());
                                break;
                            case NUMERIC:
                                if (DateUtil.isCellDateFormatted(cell)) {
                                    // Format date values
                                    DataFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                                    Date date = cell.getDateCellValue();
                                    sb.append(formatter.format(date));
                                } else {
                                    // Handle numeric values, consider formatting if needed
                                    sb.append(String.valueOf(cell.getNumericCellValue()));
                                }
                                break;
                            case BOOLEAN:
                                sb.append(cell.getBooleanCellValue());
                                break;
                            case FORMULA:
                                // Evaluate formula cells
                                try {
                                    sb.append(cell.getStringCellValue()); // Get cached formula result as string
                                } catch (IllegalStateException e) {
                                    // Handle cases where formula cannot be evaluated to string directly
                                     sb.append(String.valueOf(cell.getNumericCellValue())); // try numeric
                                }
                                break;
                            case BLANK:
                                sb.append("[BLANK]");
                                break;
                            default:
                                sb.append("[UNKNOWN CELL TYPE]");
                        }
                        sb.append("\t"); // Delimiter
                    }
                    sb.append("\n"); // Newline after each row
                }
                sb.append("\n"); // Extra newline after each sheet's content
            }
            logger.info("Successfully parsed Excel file: {}", file.getOriginalFilename());
            return sb.toString();
        } catch (IOException e) {
            logger.error("IOException while parsing Excel file {}: {}", file.getOriginalFilename(), e.getMessage(), e);
            return "Error parsing Excel file: " + e.getMessage();
        } catch (Exception e) {
            logger.error("Unexpected error while parsing Excel file {}: {}", file.getOriginalFilename(), e.getMessage(), e);
            return "Unexpected error parsing Excel file: " + e.getMessage();
        } finally {
            try {
                if (workbook != null) {
                    workbook.close();
                }
                if (inputStream != null) {
                    inputStream.close();
                }
            } catch (IOException e) {
                logger.error("Error closing workbook or input stream for file {}: {}", file.getOriginalFilename(), e.getMessage(), e);
            }
        }
    }
}
