package com.fashionopt.controller;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.OptimizationResult; // Assuming this is part of CombinedSimulationResult
import com.fashionopt.service.GeminiRestApiService;
import com.fashionopt.service.SessionDataService;
// GeminiContextService might not be directly needed if we verify through the prompt
// import com.fashionopt.service.GeminiContextService; 

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.FileInputStream;
import java.util.Collections; // For empty lists in DTOs

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNotNull;


@SpringBootTest
@AutoConfigureMockMvc
public class GeminiControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GeminiRestApiService mockGeminiRestApiService;

    @MockBean
    private SessionDataService mockSessionDataService;

    // @Autowired // If needed for direct context verification, but prompt verification is primary
    // private GeminiContextService geminiContextService;

    @Test
    void testQueryWithExcelFileUpload() throws Exception {
        // Arrange
        String query = "Analyze this Excel data";

        FileInputStream fis = new FileInputStream("src/test/resources/test_data.xlsx");
        MockMultipartFile excelFile = new MockMultipartFile(
            "file", // Must match the @RequestParam name in GeminiController's query method
            "test_data.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fis
        );

        // Expected parsed content from ExcelParsingService, adjust based on its actual output
        // Including sheet names and typical tab/newline delimiters
        String expectedExcelContent = 
            "Sheet: Sheet1\n" +
            "Name\tAge\tCity\t\n" +
            "Alice\t30.0\tNew York\t\n" + // Numeric values parsed as double
            "Bob\t24.0\tLondon\t\n\n" +    // Extra newline after sheet by parser
            "Sheet: Sheet2\n" +
            "Product\tPrice\tStock\t\n" +
            "Apple\t1.0\t100.0\t\n" +
            "Banana\t0.5\t150.0\t\n\n"; // Extra newline after sheet by parser
        
        String mockedSimulationFileData = "Mocked simulation file data from initial CSV/TXT";

        // Mock SessionDataService behavior
        when(mockSessionDataService.hasCompleteData()).thenReturn(true);
        when(mockSessionDataService.getFileData()).thenReturn(mockedSimulationFileData);

        // Create a simple CombinedSimulationResult or mock it
        CombinedSimulationResult mockResults = new CombinedSimulationResult();
        // Populate with minimal data to avoid NullPointerExceptions in GeminiContextService
        OptimizationResult gaResult = new OptimizationResult("GA", 0, 0, 0, 0, Collections.emptyList(), "");
        OptimizationResult acoResult = new OptimizationResult("ACO", 0, 0, 0, 0, Collections.emptyList(), "");
        mockResults.setGaResult(gaResult);
        mockResults.setAcoResult(acoResult);
        // Set other fields if they are accessed and could be null
        mockResults.setBestSolution(gaResult); // Or some logic to determine best
        mockResults.setRevenue(0);
        mockResults.setProfitMargin(0);
        mockResults.setConvergenceRate(0);


        when(mockSessionDataService.getResults()).thenReturn(mockResults);
        when(mockSessionDataService.getGADetailedOutput()).thenReturn("Mocked GA detailed output");
        when(mockSessionDataService.getAntDetailedOutput()).thenReturn("Mocked ACO detailed output");
        
        // Mock GeminiRestApiService
        when(mockGeminiRestApiService.queryGemini(anyString())).thenReturn("Mocked Gemini Response");

        // Act
        mockMvc.perform(multipart("/api/gemini/query")
                .file(excelFile)
                .param("query", query))
            .andExpect(status().isOk());

        // Assert
        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(mockGeminiRestApiService).queryGemini(promptCaptor.capture());
        String actualPrompt = promptCaptor.getValue();

        assertNotNull(actualPrompt);
        // System.out.println("Actual prompt:\n" + actualPrompt); // For debugging

        assertTrue(actualPrompt.contains("USER QUERY: " + query), "Prompt should contain the user query.");
        
        // Normalize line endings in expectedExcelContent and actualPrompt for robust comparison
        String normalizedExpectedExcelContent = expectedExcelContent.replaceAll("\\r\\n", "\n").trim();
        String normalizedActualPromptSegment = actualPrompt.replaceAll("\\r\\n", "\n");

        // Check for the heading and the content separately for clarity
        assertTrue(normalizedActualPromptSegment.contains("User Uploaded Excel Data:\n"), "Prompt should contain 'User Uploaded Excel Data:' heading.");
        
        // Find the start of the Excel data in the prompt
        String excelDataMarker = "User Uploaded Excel Data:\n";
        int excelDataStartIndex = normalizedActualPromptSegment.indexOf(excelDataMarker);
        assertTrue(excelDataStartIndex != -1, "Excel data marker not found in prompt.");
        
        // Extract the part of the prompt that should contain the excel data
        // And compare it after trimming, as the parser might add trailing newlines
        String actualExcelDataSegment = normalizedActualPromptSegment.substring(excelDataStartIndex + excelDataMarker.length());
        
        // The Excel parsing service might add an extra newline at the end of the whole string it produces.
        // Also, the comparison should be robust to minor whitespace differences at the end of lines if possible,
        // but for now, we'll rely on the exact string match after normalization and trimming.
        assertTrue(actualExcelDataSegment.trim().contains(normalizedExpectedExcelContent), 
            "Prompt should contain the correct parsed Excel content. Expected:\n" + normalizedExpectedExcelContent + "\nBut got (segment):\n" + actualExcelDataSegment.trim());

        assertTrue(actualPrompt.contains("Product Data (from original simulation input):\n" + mockedSimulationFileData), 
            "Prompt should contain mocked simulation file data.");
        assertTrue(actualPrompt.contains("Mocked GA detailed output"), "Prompt should contain GA output.");
        assertTrue(actualPrompt.contains("Mocked ACO detailed output"), "Prompt should contain ACO output.");
    }
}
