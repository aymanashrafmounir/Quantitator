package com.fashionopt.service;

import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.SimulationRequest;

@Service
public class SessionDataService {

    private static final String FILE_DATA_KEY = "fileData";
    private static final String PARAMETERS_KEY = "parameters";
    private static final String RESULTS_KEY = "results";
    private static final String RAW_FILE_PATH_KEY = "rawFilePath";
    private static final String GA_DETAILED_OUTPUT_KEY = "gaDetailedOutput";
    private static final String ANT_DETAILED_OUTPUT_KEY = "antDetailedOutput";

    /**
     * Stores file data in the session
     */
    public void storeFileData(String fileData) {
        getSession().setAttribute(FILE_DATA_KEY, fileData);
    }

    /**
     * Retrieves file data from the session
     */
    public String getFileData() {
        return (String) getSession().getAttribute(FILE_DATA_KEY);
    }

    /**
     * Stores parameters in the session
     */
    public void storeParameters(SimulationRequest request) {
        Map<String, Object> params = new HashMap<>();
        params.put("productionBudget", request.getProductionBudget());
        params.put("marketingBudget", request.getMarketingBudget());
        params.put("logisticsBudget", request.getLogisticsBudget());
        params.put("shelfSpace", request.getShelfSpace());
        params.put("discountBase", request.getDiscountBase());
        params.put("chromosomeBits", request.getChromosomeBits());
        
        getSession().setAttribute(PARAMETERS_KEY, params);
    }

    /**
     * Retrieves parameters from the session
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getParameters() {
        return (Map<String, Object>) getSession().getAttribute(PARAMETERS_KEY);
    }

    /**
     * Stores optimization results in the session
     */
    public void storeResults(CombinedSimulationResult results) {
        getSession().setAttribute(RESULTS_KEY, results);
    }

    /**
     * Retrieves optimization results from the session
     */
    public CombinedSimulationResult getResults() {
        return (CombinedSimulationResult) getSession().getAttribute(RESULTS_KEY);
    }

    /**
     * Stores the raw file path for Python script access
     */
    public void storeRawFilePath(String path) {
        getSession().setAttribute(RAW_FILE_PATH_KEY, path);
    }

    /**
     * Retrieves the raw file path
     */
    public String getRawFilePath() {
        return (String) getSession().getAttribute(RAW_FILE_PATH_KEY);
    }
    
    /**
     * Stores GA detailed output in the session
     */
    public void storeGADetailedOutput(String output) {
        getSession().setAttribute(GA_DETAILED_OUTPUT_KEY, output);
    }
    
    /**
     * Retrieves GA detailed output from the session
     */
    public String getGADetailedOutput() {
        return (String) getSession().getAttribute(GA_DETAILED_OUTPUT_KEY);
    }
    
    /**
     * Stores Ant Colony detailed output in the session
     */
    public void storeAntDetailedOutput(String output) {
        getSession().setAttribute(ANT_DETAILED_OUTPUT_KEY, output);
    }
    
    /**
     * Retrieves Ant Colony detailed output from the session
     */
    public String getAntDetailedOutput() {
        return (String) getSession().getAttribute(ANT_DETAILED_OUTPUT_KEY);
    }
    
    /**
     * Checks if all required data is available in the session
     */
    public boolean hasCompleteData() {
        return getFileData() != null && 
               getParameters() != null && 
               getResults() != null;
    }
    
    /**
     * Validates session data integrity
     */
    public void validateSessionData() {
        if (getSession().isNew()) {
            throw new IllegalStateException("Session is new, previous data may have been lost");
        }
    }

    /**
     * Helper method to get the current session
     */
    private HttpSession getSession() {
        ServletRequestAttributes attr = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
        return attr.getRequest().getSession(true);
    }
}
