# Enhanced Fashion Optimization Project

## Overview
This project has been enhanced with several new features to improve user experience and provide better feedback during algorithm execution.

## New Features Added

### 1. Time Estimation and Progress Tracking
- **Real-time Progress Display**: Both GA and ACO algorithms now show progress percentage and estimated time remaining
- **Initial Time Estimates**: When simulation starts, users see initial time estimates (typically 2 minutes)
- **Dynamic Updates**: Time estimates are updated based on actual algorithm progress
- **Progress Bars**: Visual progress bars in the frontend show completion status

### 2. Enhanced Error Handling
- **Python Script Errors**: Better detection and reporting of Python script errors
- **Missing Dependencies**: Specific error messages for missing Python modules
- **JSON Parsing Errors**: Improved handling of malformed output from Python scripts
- **Traceback Detection**: Automatic detection of Python tracebacks and error reporting

### 3. Edge Case Handling

#### Invisible Solution
- **Detection**: When *either* algorithm returns zero or negative profit
- **Message**: "Invisible Solution - One or both algorithms returned zero or negative profit"
- **Guidance**: Suggests parameter adjustment or data review
- **Status**: Special "INVISIBLE_SOLUTION" status in the system

#### Shelf Space Validation
- **Pre-validation**: Checks if required shelf space exceeds available capacity before starting simulation
- **Calculation**: Automatically calculates total required shelf space from uploaded data
- **Error Message**: "No Space in total shelf space - Required: X, Available: Y"
- **Early Termination**: Prevents unnecessary algorithm execution when space is insufficient

#### Input Validation
- **Discount Base**: Must be between 0.1 and 0.5 (inclusive)
- **Chromosome Bits**: Must be between 10 and 100 (inclusive)
- **Error Message**: Specific messages for invalid input ranges
- **Early Termination**: Prevents simulation from starting with invalid parameters

### 4. Improved Frontend Experience
- **Status Messages**: Clear, user-friendly status messages for different scenarios
- **Time Display**: Shows estimated time remaining during simulation
- **Error Categorization**: Different message types (info, warning, error, success)
- **Better Visual Feedback**: Enhanced progress indicators and status displays

## Technical Enhancements

### Backend Changes
1. **SimulationStatusService**:
   - Added `checkForSpecialCases()` method for edge case detection
   - Added `validateShelfSpace()` method for pre-validation
   - Added `setShelfSpaceError()` method for shelf space error handling

2. **GAService & AntColonyService**:
   - Enhanced error detection and reporting
   - Better time estimation logic
   - Improved Python script output parsing
   - Added support for progress message parsing

3. **SimulationController**:
   - Added shelf space validation before simulation start
   - Added initial time estimate setting
   - Enhanced error handling for setup failures

### Frontend Changes
1. **Enhanced Status Processing**:
   - Support for new status types: "INVISIBLE_SOLUTION", "SHELF_SPACE_ERROR"
   - Improved time estimation display
   - Better error message categorization

2. **User Experience**:
   - More informative status messages
   - Visual progress indicators
   - Contextual guidance for different scenarios

### Python Script Enhancements
1. **Progress Reporting**:
   - Added progress output in format: `[PROGRESS] GA/ACO: X% completed, estimated Ys remaining`
   - Real-time progress calculation based on generation/iteration count
   - Dynamic time estimation based on elapsed time

2. **Better Error Handling**:
   - Improved error detection and reporting
   - Flush output for real-time progress updates

## Installation and Usage

### Prerequisites
- Java 17 or higher
- Python 3.11 with required packages (pandas, numpy, etc.)
- Maven for building the project

### Building the Project
```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./mvnw compile
./mvnw spring-boot:run
```

### Running the Application
1. Start the Spring Boot application
2. Open your browser to `http://localhost:8080`
3. Upload your CSV/Excel file with product data
4. Configure simulation parameters
5. Run the simulation and monitor progress in real-time

## New Status Types

### COMPLETED
- Both algorithms finished successfully
- Results are available for viewing

### INVISIBLE_SOLUTION
- Both algorithms returned zero profit
- Suggests parameter adjustment or data review

### SHELF_SPACE_ERROR
- Required shelf space exceeds available capacity
- Simulation terminated early to save resources

### ERROR
- One or more algorithms failed
- Detailed error messages provided

## File Structure
```
enhanced_project/
├── src/main/java/com/fashionopt/
│   ├── controller/
│   │   └── SimulationController.java (enhanced)
│   ├── service/
│   │   ├── SimulationStatusService.java (enhanced)
│   │   ├── GAService.java (enhanced)
│   │   └── AntColonyService.java (enhanced)
│   └── dto/ (unchanged)
├── src/main/resources/static/
│   └── script.js (enhanced)
├── GA.py (enhanced with progress reporting)
├── ant.py (enhanced with progress reporting)
└── README.md (this file)
```

## Backward Compatibility
All existing functionality has been preserved. The enhancements are additive and do not break existing features.

## Future Improvements
- More granular progress reporting
- Advanced error recovery mechanisms
- Additional validation rules
- Performance optimizations



## Python Environment Configuration

To ensure the Python scripts run correctly, please follow these steps:

### 1. Python Installation
Ensure you have Python 3.x installed on your system. The application will attempt to use `python3.11`, `python3`, or `python` in that order. You can download Python from the official website: [https://www.python.org/downloads/](https://www.python.org/downloads/)

### 2. Add Python to PATH (if not already)
During Python installation, make sure to check the option "Add Python to PATH" or manually add it to your system's environment variables. This allows the Java application to find the Python executable.

### 3. Install Required Python Packages
Navigate to the `enhanced_project` directory (where `GA.py` and `ant.py` are located) in your terminal and install the necessary packages using pip:

```bash
pip install pandas openpyxl numpy
```

These packages are essential for the Python algorithms to function correctly.


