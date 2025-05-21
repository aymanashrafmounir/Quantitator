package com.fashionopt.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.*;

public class ExcelParsingServiceTest {

    private ExcelParsingService excelParsingService;

    @BeforeEach
    void setUp() {
        excelParsingService = new ExcelParsingService();
    }

    @Test
    void testParseExcelFile_Success() throws IOException {
        try (FileInputStream fis = new FileInputStream("src/test/resources/test_data.xlsx")) {
            MultipartFile multipartFile = new MockMultipartFile("test_data.xlsx", "test_data.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fis);

            String result = excelParsingService.parseExcelFile(multipartFile);

            assertNotNull(result);
            // Normalize line endings for comparison
            String normalizedResult = result.replaceAll("\\r\\n", "\n");

            // Sheet1 data
            assertTrue(normalizedResult.contains("Sheet: Sheet1\n"));
            assertTrue(normalizedResult.contains("Name\tAge\tCity\t\n"));
            assertTrue(normalizedResult.contains("Alice\t30.0\tNew York\t\n")); // Numeric values are read as doubles
            assertTrue(normalizedResult.contains("Bob\t24.0\tLondon\t\n"));   // Numeric values are read as doubles

            // Sheet2 data
            assertTrue(normalizedResult.contains("Sheet: Sheet2\n"));
            assertTrue(normalizedResult.contains("Product\tPrice\tStock\t\n"));
            assertTrue(normalizedResult.contains("Apple\t1.0\t100.0\t\n")); // Numeric values are read as doubles
            assertTrue(normalizedResult.contains("Banana\t0.5\t150.0\t\n"));// Numeric values are read as doubles
        }
    }

    @Test
    void testParseExcelFile_EmptyFile() throws IOException {
        try (FileInputStream fis = new FileInputStream("src/test/resources/empty_test.xlsx")) {
            MultipartFile multipartFile = new MockMultipartFile("empty_test.xlsx", "empty_test.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fis);

            String result = excelParsingService.parseExcelFile(multipartFile);
            assertNotNull(result);
            // Expecting sheet name and then empty content or specific representation
            // The default sheet is named "Sheet" or "Sheet1" depending on openpyxl version when created (it was "Sheet" for empty)
            // The current parser adds a header "Sheet: <name>\n" and then row content.
            // For a sheet with no cells, it might just be "Sheet: Sheet\n\n"
            String normalizedResult = result.replaceAll("\\r\\n", "\n");
            assertTrue(normalizedResult.contains("Sheet: Sheet\n\n") || normalizedResult.contains("Sheet: Sheet1\n\n") );
        }
    }
    
    @Test
    void testParseExcelFile_DifferentCellTypes() throws IOException {
        try (FileInputStream fis = new FileInputStream("src/test/resources/cell_types_test.xlsx")) {
            MultipartFile multipartFile = new MockMultipartFile("cell_types_test.xlsx", "cell_types_test.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fis);

            String result = excelParsingService.parseExcelFile(multipartFile);
            assertNotNull(result);
            String normalizedResult = result.replaceAll("\\r\\n", "\n");
            
            assertTrue(normalizedResult.contains("Sheet: CellTypes\n"));
            assertTrue(normalizedResult.contains("StringVal\tNumericVal\tBooleanVal\tFormulaVal\t\n"));
            // The formula =A2 (where A2 is "Test") should result in "Test" being read.
            // POI reads the cached formula result if not configured to evaluate.
            assertTrue(normalizedResult.contains("Test\t123.45\tTRUE\tTest\t\n"));
        }
    }

    @Test
    void testParseExcelFile_IOException() {
        MultipartFile multipartFile = new MockMultipartFile("error.xlsx", "error.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[0]) {
            @Override
            public InputStream getInputStream() throws IOException {
                throw new IOException("Simulated IOException");
            }
        };

        String result = excelParsingService.parseExcelFile(multipartFile);
        assertNotNull(result);
        assertTrue(result.startsWith("Error parsing Excel file: Simulated IOException"));
    }

    @Test
    void testParseExcelFile_NullFile() {
        // Current implementation of ExcelParsingService returns null if the file is null or empty.
        String result = excelParsingService.parseExcelFile(null);
        assertNull(result, "Expected null when file is null, as per current service logic.");
    }

    @Test
    void testParseExcelFile_EmptyMultipartFile() throws IOException {
        MultipartFile multipartFile = new MockMultipartFile("empty.xlsx", "empty.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new byte[0]);
        
        // Current implementation of ExcelParsingService returns null if the file is null or empty.
        String result = excelParsingService.parseExcelFile(multipartFile);
        assertNull(result, "Expected null when file is empty, as per current service logic.");
    }
}
