document.addEventListener("DOMContentLoaded", () => {
    // Configuration
    const API_URL = "http://localhost:8080/api";
    const STATUS_POLLING_INTERVAL = 1000; // Poll every 1 second
    const FETCH_TIMEOUT = 30000;

    // --- DOM Elements ---
    const appMainContent = document.getElementById("app-main-content"); // For blurring
    const navLinks = document.querySelectorAll(".nav-link:not(#gemini-chat-nav-button)");
    const sections = document.querySelectorAll(".section");
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const fileInfoDiv = document.getElementById("file-info");
    const fileNameSpan = document.getElementById("filename");
    const rowCountSpan = document.getElementById("row-count");
    const columnMappingDiv = document.getElementById("column-mapping");
    const runSimulationButton = document.getElementById("run-simulation");
    const buttonText = runSimulationButton.querySelector(".button-text");
    const buttonSpinner = runSimulationButton.querySelector(".spinner");
    const generalUploadFeedback = document.getElementById("general-upload-feedback");
    const formValidationSummary = document.getElementById("form-validation-summary");
    const globalLoaderOverlay = document.getElementById("global-loader-overlay");
    const resultsContentWrapper = document.getElementById("results-content-wrapper");
    const resultsMessageArea = document.getElementById("results-message-area");
    const resultsMessageText = document.getElementById("results-message-text");
    const dashboardProfitMetricEl = document.getElementById("profit-metric");
    const dashboardProductsMetricEl = document.getElementById("products-metric"); // Corrected: now correctly gets the element

    // Algorithm tab switching
    const algorithmTabs = document.querySelectorAll('.algorithm-tab');
    const algorithmResults = document.querySelectorAll('.algorithm-results');

    // New Progress Elements
    const simulationProgressArea = document.getElementById("simulation-progress-area");
    const overallStatusEl = document.getElementById("overall-status");
    const gaProgressBar = document.getElementById("ga-progress-bar");
    const gaProgressText = document.getElementById("ga-progress-text");
    const gaEta = document.getElementById("ga-eta");
    const acoProgressBar = document.getElementById("aco-progress-bar");
    const acoProgressText = document.getElementById("aco-progress-text");
    const acoEta = document.getElementById("aco-eta");
    const simulationErrorMessage = document.getElementById("simulation-error-message");


    // Updated DOM elements for GA results
    const gaResultsTablePlaceholder = document.getElementById("ga-results-table-placeholder");
    const gaResultsTableActual = document.getElementById("ga-results-table-actual");
    const gaResultsTableBody = gaResultsTableActual.querySelector("tbody");
    const gaTotalProfitEl = document.getElementById("ga-total-profit");
    const gaProductsCountEl = document.getElementById("ga-products-count");
    const gaTotalUnitsProducedEl = document.getElementById("ga-total-units-produced");
    const gaAvgProfitPerProductEl = document.getElementById("ga-avg-profit-per-product");
    const gaAvgQuantityPerProductEl = document.getElementById("ga-avg-quantity-per-product");
    const gaTopProfitProductNameEl = document.getElementById("ga-top-profit-product-name");
    const gaTopProfitProductValueEl = document.getElementById("ga-top-profit-product-value");
    const gaTopQuantityProductNameEl = document.getElementById("ga-top-quantity-product-name");
    const gaTopQuantityProductValueEl = document.getElementById("ga-top-quantity-product-value");
    const gaTopProfitProductCard = document.getElementById("ga-top-profit-product-card");
    const gaTopQuantityProductCard = document.getElementById("ga-top-quantity-product-card");

    // DOM elements for ACO results
    const acoResultsTablePlaceholder = document.getElementById("aco-results-table-placeholder");
    const acoResultsTableActual = document.getElementById("aco-results-table-actual");
    const acoResultsTableBody = acoResultsTableActual.querySelector("tbody");
    const acoTotalProfitEl = document.getElementById("aco-total-profit");
    const acoProductsCountEl = document.getElementById("aco-products-count");
    const acoTotalUnitsProducedEl = document.getElementById("aco-total-units-produced");
    const acoAvgProfitPerProductEl = document.getElementById("aco-avg-profit-per-product");
    const acoAvgQuantityPerProductEl = document.getElementById("aco-avg-quantity-per-product");
    const acoTopProfitProductNameEl = document.getElementById("aco-top-profit-product-name");
    const acoTopProfitProductValueEl = document.getElementById("aco-top-profit-product-value");
    const acoTopQuantityProductNameEl = document.getElementById("aco-top-quantity-product-name");
    const acoTopQuantityProductValueEl = document.getElementById("aco-top-quantity-product-value");
    const acoTopProfitProductCard = document.getElementById("aco-top-profit-product-card");
    const acoTopQuantityProductCard = document.getElementById("aco-top-quantity-product-card");

    // DOM elements for comparison results
    const comparisonGaProfitEl = document.getElementById("comparison-ga-profit");
    const comparisonAcoProfitEl = document.getElementById("comparison-aco-profit");
    const comparisonProfitDiffEl = document.getElementById("comparison-profit-diff");
    const comparisonBetterAlgoEl = document.getElementById("comparison-better-algo");

    // Chart contexts for GA
    const gaProductionChartCtx = document.getElementById("ga-productionChart").getContext("2d");
    const gaProfitContributionChartCtx = document.getElementById("ga-profitContributionChart").getContext("2d");
    const gaCostProfitChartCtx = document.getElementById("ga-costProfitChart").getContext("2d");

    // Chart contexts for ACO
    const acoProductionChartCtx = document.getElementById("aco-productionChart").getContext("2d");
    const acoProfitContributionChartCtx = document.getElementById("aco-profitContributionChart").getContext("2d");
    const acoCostProfitChartCtx = document.getElementById("aco-costProfitChart").getContext("2d");

    // Chart contexts for comparison
    const comparisonProfitChartCtx = document.getElementById("comparison-profitChart").getContext("2d");
    const comparisonQuantityChartCtx = document.getElementById("comparison-quantityChart").getContext("2d");

    // Chart objects
    let gaProductionChart, gaProfitContributionChart, gaCostProfitChart;
    let acoProductionChart, acoProfitContributionChart, acoCostProfitChart;
    let comparisonProfitChart, comparisonQuantityChart;

    let uploadedData = [];
    let currentSimResults = null;
    let currentSimulationId = null; // To store the ID of the ongoing simulation
    let statusPollingIntervalId = null; // To store the interval ID for polling
    let isSimulationActive = false; // New flag to prevent multiple simultaneous simulations

    const chartDefaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, ticks: { color: "var(--text-color-secondary)", font: { family: "var(--font-primary)"} }, grid: { color: "rgba(238, 238, 238, 0.1)" } },
            x: { ticks: { color: "var(--text-color-secondary)", font: { family: "var(--font-primary)"} }, grid: { display: false } }
        },
        plugins: {
            legend: { labels: { color: "var(--text-color-secondary)", font: { family: "var(--font-primary)", size: 14 } } },
            tooltip: { backgroundColor: "var(--secondary-bg-color)", titleColor: "var(--accent-color-secondary)", bodyColor: "var(--text-color-secondary)", titleFont: { family: "var(--font-headings)"}, bodyFont: { family: "var(--font-primary)"} }
        }
    };

    // Navigation setup
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            if (link.dataset.section) {
                sections.forEach(section => section.classList.remove("active"));
                document.getElementById(link.dataset.section).classList.add("active");
                navLinks.forEach(l => l.classList.remove("active"));
                link.classList.add("active");
            }
        });
    });

    // Algorithm tab switching
    algorithmTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and results
            algorithmTabs.forEach(t => t.classList.remove('active'));
            algorithmResults.forEach(r => r.classList.remove('active'));

            // Add active class to clicked tab and corresponding results
            tab.classList.add('active');
            const targetId = tab.id.replace('-tab', '-results');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // File upload handling
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileChange);
    ["dragenter", "dragover"].forEach(eventName => dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }, false));
    ["dragleave", "drop"].forEach(eventName => dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }, false));
    dropZone.addEventListener("drop", handleFileDrop, false);

    function handleFileChange(e) {
        const file = e.target.files[0];
        if (file) processUploadedFile(file);
    }

    function handleFileDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) processUploadedFile(files[0]);
    }

    function processUploadedFile(file) {
        clearGeneralUploadFeedback();
        if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx")) {
            showGeneralUploadFeedback("Unsupported file format. Please upload CSV or XLSX.");
            fileInput.value = ""; return;
        }
        fileInfoDiv.classList.remove("hidden");
        fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => { const data = new Uint8Array(e.target.result); parseFileData(file, data); };
        reader.readAsArrayBuffer(file);
    }

    function parseFileData(file, data) {
        try {
            if (file.name.endsWith(".xlsx")) {
                const workbook = XLSX.read(data, { type: "array" });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                uploadedData = XLSX.utils.sheet_to_json(worksheet);
                updateFileInfoDisplay();
                createColumnMappingUI(XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0]);
            } else if (file.name.endsWith(".csv")) {
                const csvData = new TextDecoder().decode(data);
                const rows = csvData.split("\n").filter(row => row.trim() !== "");
                if (rows.length < 2) throw new Error("CSV file must contain headers and at least one data row.");
                const headers = rows[0].split(",").map(h => h.trim());
                uploadedData = rows.slice(1).map(row => {
                    const values = row.split(",").map(v => v.trim());
                    return headers.reduce((obj, header, index) => { obj[header] = values[index] || ""; return obj; }, {});
                });
                updateFileInfoDisplay();
                createColumnMappingUI(headers);
            }
        } catch (error) {
            console.error("Error processing file:", error);
            showGeneralUploadFeedback(`Error processing file: ${error.message}`);
            fileInfoDiv.classList.add("hidden"); uploadedData = [];
        }
    }

    function updateFileInfoDisplay() {
        rowCountSpan.textContent = uploadedData.length;
    }

    function createColumnMappingUI(headers) {
        columnMappingDiv.innerHTML = `<h3>Map Data Columns</h3><p style="font-size:0.85rem; color: var(--text-color-secondary); margin-bottom:1rem;">Select a column from your uploaded Excel/CSV file for each required parameter.</p>`;

        const expectedParams = [
            { key: "colName", label: "Product Name", keywords: ["product", "name", "item"] },
            { key: "colPrice", label: "Price", keywords: ["price", "cost"] },
            { key: "colCp", label: "Production Cost", keywords: ["production", "cp"] },
            { key: "colCm", label: "Marketing Cost", keywords: ["marketing", "cm"] },
            { key: "colCl", label: "Logistics Cost", keywords: ["logistics", "cl"] },
            { key: "colShelfCost", label: "Shelf Space Cost", keywords: ["shelf", "space", "sc"] },
            { key: "colAge", label: "Age", keywords: ["age", "days"] },
            { key: "colStock", label: "Remaining Products", keywords: ["stock", "remaining", "inventory"] },
            { key: "colDemand", label: "Demand", keywords: ["demand", "expected"] },
            { key: "colShelf", label: "Shelf Space", keywords: ["shelf", "s_i"] }
        ];

        expectedParams.forEach(param => {
            const div = document.createElement("div");
            div.className = "mapping-group";

            let optionsHtml = "<option value=\"\">-- Select Column --</option>";

            // Auto-selection logic
            let bestMatch = "";
            for (const header of headers) {
                for (const keyword of param.keywords) {
                    if (header.toLowerCase().includes(keyword)) {
                        bestMatch = header;
                        break;
                    }
                }
                if (bestMatch) break;
            }

            headers.forEach(header => {
                const isSelected = header === bestMatch ? "selected" : "";
                optionsHtml += `<option value="${header}" ${isSelected}>${header}</option>`;
            });

            div.innerHTML = `
            <label for="map-${param.key}">${param.label}:</label>
            <select id="map-${param.key}" class="param-select" data-param="${param.key}">
                ${optionsHtml}
            </select>
        `;
            columnMappingDiv.appendChild(div);
        });
    }


    function getColumnMappings() {
        const mappings = {};
        document.querySelectorAll(".param-select").forEach(select => {
            const key = select.dataset.param;
            const val = select.value;
            // Only add to mappings if a value is selected (not the default empty option)
            if (val) mappings[key] = val;
        });
        return mappings;
    }

    // Form validation
    const budgetInputs = [
        { id: "production-budget", label: "Production Budget", min: 0 },
        { id: "marketing-budget", label: "Marketing Budget", min: 0 },
        { id: "logistics-budget", label: "Logistics Budget", min: 0 },
        { id: "discount_base", label: "Discount Base", min: 0, max:100, isFloat: true },
        { id: "space_storage", label: "Shelf Space Storage", min: 0 },
        { id: "bits_number", label: "Chromosome Bits", min: 1 }
    ];

    function validateInputs() {
        clearAllValidationMessages();
        let isValid = true;
        let errorMessages = [];

        budgetInputs.forEach(({ id, label, min, max, isFloat }) => {
            const inputElement = document.getElementById(id);
            const value = inputElement.value.trim();
            const errorElement = document.getElementById(`${id}-error`);

            if (value === "") {
                showValidationError(inputElement, errorElement, `${label} is required.`);
                errorMessages.push(`${label} is required.`);
                isValid = false;
                return;
            }

            const numValue = isFloat ? parseFloat(value) : parseInt(value, 10);

            if (isNaN(numValue)) {
                showValidationError(inputElement, errorElement, `${label} must be a valid number.`);
                errorMessages.push(`${label} must be a valid number.`);
                isValid = false;
                return;
            }

            if (min !== undefined && numValue < min) {
                showValidationError(inputElement, errorElement, `${label} must be at least ${min}.`);
                errorMessages.push(`${label} must be at least ${min}.`);
                isValid = false;
            }

            if (max !== undefined && numValue > max) {
                showValidationError(inputElement, errorElement, `${label} must not exceed ${max}.`);
                errorMessages.push(`${label} must not exceed ${max}.`);
                isValid = false;
            }
        });

        if (!fileInput.files[0]) {
            showGeneralUploadFeedback("Please upload a product data file (CSV/XLSX).");
            errorMessages.push("Product data file is required.");
            isValid = false;
        }

        // Validate that all required column mappings are selected
        const mappedColumns = getColumnMappings();
        const requiredMappings = [
            "colName", "colPrice", "colCp", "colCm", "colCl",
            "colShelfCost", "colAge", "colStock", "colShelf", "colDemand"
        ];

        requiredMappings.forEach(key => {
            // Check if the key exists in mappedColumns and its value is not an empty string
            if (!mappedColumns[key] || mappedColumns[key].trim() === "") {
                const label = document.querySelector(`[data-param="${key}"]`).previousElementSibling.textContent.replace(':', '');
                errorMessages.push(`Column mapping for '${label}' is required.`);
                isValid = false;
            }
        });

        if (!isValid) showFormValidationSummary(errorMessages);
        return isValid;
    }

    function showValidationError(inputElement, errorElement, message) {
        inputElement.classList.add("invalid");
        if (errorElement) errorElement.textContent = message;
    }

    function clearAllValidationMessages() {
        budgetInputs.forEach(({ id }) => {
            document.getElementById(id).classList.remove("invalid");
            const errorElement = document.getElementById(`${id}-error`);
            if (errorElement) errorElement.textContent = "";
        });
        document.querySelectorAll(".param-select").forEach(select => {
            select.classList.remove("invalid"); // Also clear invalid state for select elements
        });
        clearGeneralUploadFeedback();
        formValidationSummary.classList.add("hidden");
        formValidationSummary.innerHTML = "";
    }

    function showGeneralUploadFeedback(message) {
        generalUploadFeedback.textContent = message;
        generalUploadFeedback.style.color = "var(--error-color)";
    }

    function clearGeneralUploadFeedback() {
        generalUploadFeedback.textContent = "";
    }

    function showFormValidationSummary(messages) {
        formValidationSummary.innerHTML = "<strong>Please correct the following errors:</strong><ul>" + messages.map(msg => `<li>${msg}</li>`).join("") + "</ul>";
        formValidationSummary.classList.remove("hidden");
    }

    // Results display functions
    function showResultsMessage(message, type = "info") {
        resultsMessageText.textContent = message;
        resultsMessageArea.className = "results-message-area";
        resultsMessageArea.classList.add(type);
        resultsMessageArea.classList.remove("hidden");
        resultsContentWrapper.classList.add("hidden");
        simulationProgressArea.classList.add("hidden"); // Hide progress area when showing general message
    }

    function updateGAResults(result) {
        const products = result.products;
        if (!products || products.length === 0) {
            // No valid products, ensure KPI cards are hidden or show N/A
            gaTotalProfitEl.textContent = "$0.00";
            gaProductsCountEl.textContent = "0";
            gaTotalUnitsProducedEl.textContent = "0";
            gaAvgProfitPerProductEl.textContent = "$0.00";
            gaAvgQuantityPerProductEl.textContent = "0";
            gaTopProfitProductCard.classList.add("hidden");
            gaTopQuantityProductCard.classList.add("hidden");
            gaResultsTableBody.innerHTML = "<tr><td colspan='7'>No product results available for Genetic Algorithm.</td></tr>";
            gaResultsTablePlaceholder.classList.add("hidden");
            gaResultsTableActual.classList.remove("hidden");
            return;
        }

        // Update KPI metrics
        gaTotalProfitEl.textContent = "$" + result.totalProfit.toFixed(2);
        gaProductsCountEl.textContent = products.length;

        const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
        gaTotalUnitsProducedEl.textContent = totalUnits;

        const avgProfit = result.totalProfit / products.length;
        gaAvgProfitPerProductEl.textContent = "$" + avgProfit.toFixed(2);

        const avgQuantity = totalUnits / products.length;
        gaAvgQuantityPerProductEl.textContent = avgQuantity.toFixed(0);

        // Find top products
        const topProfitProduct = [...products].sort((a, b) => b.totalProfit - a.totalProfit)[0];
        const topQuantityProduct = [...products].sort((a, b) => b.quantity - a.quantity)[0];

        gaTopProfitProductNameEl.textContent = topProfitProduct.name;
        gaTopProfitProductValueEl.textContent = "$" + topProfitProduct.totalProfit.toFixed(2);
        gaTopProfitProductCard.classList.remove("hidden");

        gaTopQuantityProductNameEl.textContent = topQuantityProduct.name;
        gaTopQuantityProductValueEl.textContent = topQuantityProduct.quantity + " units";
        gaTopQuantityProductCard.classList.remove("hidden");

        // Update table
        gaResultsTableBody.innerHTML = "";
        products.forEach(product => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.quantity}</td>
                <td>$${product.price.toFixed(2)}</td>
                <td>$${product.unitCost.toFixed(2)}</td>
                <td>$${product.profitPerUnit.toFixed(2)}</td>
                <td>$${product.totalProfit.toFixed(2)}</td>
                <td>$${product.totalCost.toFixed(2)}</td>
            `;
            gaResultsTableBody.appendChild(row);
        });
        gaResultsTablePlaceholder.classList.add("hidden");
        gaResultsTableActual.classList.remove("hidden");

        // Update charts
        const productNames = products.map(p => p.name);
        const quantities = products.map(p => p.quantity);
        const profits = products.map(p => p.totalProfit);
        const costs = products.map(p => p.totalCost);

        // Production chart
        gaProductionChart.data.labels = productNames;
        gaProductionChart.data.datasets[0].data = quantities;
        gaProductionChart.update();

        // Profit contribution chart
        gaProfitContributionChart.data.labels = productNames;
        gaProfitContributionChart.data.datasets[0].data = profits;
        gaProfitContributionChart.update();

        // Cost vs Profit chart
        gaCostProfitChart.data.labels = productNames;
        gaCostProfitChart.data.datasets[0].data = costs;
        gaCostProfitChart.data.datasets[1].data = profits;
        gaCostProfitChart.update();
    }

    function updateACOResults(result) {
        const products = result.products;
        if (!products || products.length === 0) {
            acoTotalProfitEl.textContent = "$0.00";
            acoProductsCountEl.textContent = "0";
            acoTotalUnitsProducedEl.textContent = "0";
            acoAvgProfitPerProductEl.textContent = "$0.00";
            acoAvgQuantityPerProductEl.textContent = "0";
            acoTopProfitProductCard.classList.add("hidden");
            acoTopQuantityProductCard.classList.add("hidden");
            acoResultsTableBody.innerHTML = "<tr><td colspan='7'>No product results available for Ant Colony Optimization.</td></tr>";
            acoResultsTablePlaceholder.classList.add("hidden");
            acoResultsTableActual.classList.remove("hidden");
            return;
        }

        // Update KPI metrics
        acoTotalProfitEl.textContent = "$" + result.totalProfit.toFixed(2);
        acoProductsCountEl.textContent = products.length;

        const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
        acoTotalUnitsProducedEl.textContent = totalUnits;

        const avgProfit = result.totalProfit / products.length;
        acoAvgProfitPerProductEl.textContent = "$" + avgProfit.toFixed(2);

        const avgQuantity = totalUnits / products.length;
        acoAvgQuantityPerProductEl.textContent = avgQuantity.toFixed(0);

        // Find top products
        const topProfitProduct = [...products].sort((a, b) => b.totalProfit - a.totalProfit)[0];
        const topQuantityProduct = [...products].sort((a, b) => b.quantity - a.quantity)[0];

        acoTopProfitProductNameEl.textContent = topProfitProduct.name;
        acoTopProfitProductValueEl.textContent = "$" + topProfitProduct.totalProfit.toFixed(2);
        acoTopProfitProductCard.classList.remove("hidden");

        acoTopQuantityProductNameEl.textContent = topQuantityProduct.name;
        acoTopQuantityProductValueEl.textContent = topQuantityProduct.quantity + " units";
        acoTopQuantityProductCard.classList.remove("hidden");

        // Update table
        acoResultsTableBody.innerHTML = "";
        products.forEach(product => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${product.quantity}</td>
                <td>$${product.price.toFixed(2)}</td>
                <td>$${product.unitCost.toFixed(2)}</td>
                <td>$${product.profitPerUnit.toFixed(2)}</td>
                <td>$${product.totalProfit.toFixed(2)}</td>
                <td>$${product.totalCost.toFixed(2)}</td>
            `;
            acoResultsTableBody.appendChild(row);
        });
        acoResultsTablePlaceholder.classList.add("hidden");
        acoResultsTableActual.classList.remove("hidden");

        // Update charts
        const productNames = products.map(p => p.name);
        const quantities = products.map(p => p.quantity);
        const profits = products.map(p => p.totalProfit);
        const costs = products.map(p => p.totalCost);

        // Production chart
        acoProductionChart.data.labels = productNames;
        acoProductionChart.data.datasets[0].data = quantities;
        acoProductionChart.update();

        // Profit contribution chart
        acoProfitContributionChart.data.labels = productNames;
        acoProfitContributionChart.data.datasets[0].data = profits;
        acoProfitContributionChart.update();

        // Cost vs Profit chart
        acoCostProfitChart.data.labels = productNames;
        acoCostProfitChart.data.datasets[0].data = costs;
        acoCostProfitChart.data.datasets[1].data = profits;
        acoCostProfitChart.update();
    }

    function updateComparisonResults(gaResult, acoResult) {
        if (!gaResult || !gaResult.products || !acoResult || !acoResult.products) {
            comparisonGaProfitEl.textContent = "$0.00";
            comparisonAcoProfitEl.textContent = "$0.00";
            comparisonProfitDiffEl.textContent = "$0.00";
            comparisonBetterAlgoEl.textContent = "N/A";
            comparisonProfitChart.data.labels = [];
            comparisonProfitChart.data.datasets[0].data = [];
            comparisonProfitChart.data.datasets[1].data = [];
            comparisonProfitChart.update();
            comparisonQuantityChart.data.labels = [];
            comparisonQuantityChart.data.datasets[0].data = [];
            comparisonQuantityChart.data.datasets[1].data = [];
            comparisonQuantityChart.update();
            return;
        }

        // Update comparison metrics
        comparisonGaProfitEl.textContent = "$" + gaResult.totalProfit.toFixed(2);
        comparisonAcoProfitEl.textContent = "$" + acoResult.totalProfit.toFixed(2);

        const profitDiff = Math.abs(gaResult.totalProfit - acoResult.totalProfit);
        comparisonProfitDiffEl.textContent = "$" + profitDiff.toFixed(2);

        const betterAlgo = gaResult.totalProfit > acoResult.totalProfit ? "Genetic Algorithm" :
            (acoResult.totalProfit > gaResult.totalProfit ? "Ant Colony Optimization" : "Equal");
        comparisonBetterAlgoEl.textContent = betterAlgo;

        // Get all unique product names from both algorithms
        const allProductNames = new Set();
        gaResult.products.forEach(p => allProductNames.add(p.name));
        acoResult.products.forEach(p => allProductNames.add(p.name));
        const productNames = Array.from(allProductNames);

        // Create profit and quantity data for comparison charts
        const gaProfits = [];
        const acoProfits = [];
        const gaQuantities = [];
        const acoQuantities = [];

        productNames.forEach(name => {
            const gaProduct = gaResult.products.find(p => p.name === name);
            const acoProduct = acoResult.products.find(p => p.name === name);

            gaProfits.push(gaProduct ? gaProduct.totalProfit : 0);
            acoProfits.push(acoProduct ? acoProduct.totalProfit : 0);
            gaQuantities.push(gaProduct ? gaProduct.quantity : 0);
            acoQuantities.push(acoProduct ? acoProduct.quantity : 0);
        });

        // Update profit comparison chart
        comparisonProfitChart.data.labels = productNames;
        comparisonProfitChart.data.datasets[0].data = gaProfits;
        comparisonProfitChart.data.datasets[1].data = acoProfits;
        comparisonProfitChart.update();

        // Update quantity comparison chart
        comparisonQuantityChart.data.labels = productNames;
        comparisonQuantityChart.data.datasets[0].data = gaQuantities;
        comparisonQuantityChart.data.datasets[1].data = acoQuantities;
        comparisonQuantityChart.update();
    }

    function initializeCharts() {
        // Initialize GA charts
        if (gaProductionChart) gaProductionChart.destroy();
        if (gaProfitContributionChart) gaProfitContributionChart.destroy();
        if (gaCostProfitChart) gaCostProfitChart.destroy();

        gaProductionChart = new Chart(gaProductionChartCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{
                    label: "Optimal Production Quantity (GA)",
                    data: [],
                    backgroundColor: "rgba(0, 173, 181, 0.7)",
                    borderColor: "rgba(0, 173, 181, 1)",
                    borderWidth: 1,
                    hoverBackgroundColor: "rgba(0, 173, 181, 0.9)"
                }]
            },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });

        gaProfitContributionChart = new Chart(gaProfitContributionChartCtx, {
            type: "pie",
            data: {
                labels: [],
                datasets: [{
                    label: "Profit Contribution (GA)",
                    data: [],
                    backgroundColor: ["rgba(0, 173, 181, 0.7)", "rgba(54, 162, 235, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)", "rgba(153, 102, 255, 0.7)", "rgba(255, 159, 64, 0.7)", "rgba(255, 99, 132, 0.7)", "rgba(201, 203, 207, 0.7)", "rgba(100, 150, 200, 0.7)", "rgba(220, 120, 80, 0.7)"]
                }]
            },
            options: { ...JSON.parse(JSON.stringify(chartDefaultOptions)), scales: {} }
        });

        gaCostProfitChart = new Chart(gaCostProfitChartCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Total Cost (GA)",
                        data: [],
                        backgroundColor: "rgba(255, 99, 132, 0.7)",
                        borderColor: "rgba(255, 99, 132, 1)",
                        borderWidth: 1
                    },
                    {
                        label: "Total Profit (GA)",
                        data: [],
                        backgroundColor: "rgba(75, 192, 192, 0.7)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1
                    }
                ]
            },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });

        // Initialize ACO charts
        if (acoProductionChart) acoProductionChart.destroy();
        if (acoProfitContributionChart) acoProfitContributionChart.destroy();
        if (acoCostProfitChart) acoCostProfitChart.destroy();

        acoProductionChart = new Chart(acoProductionChartCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{
                    label: "Optimal Production Quantity (ACO)",
                    data: [],
                    backgroundColor: "rgba(255, 159, 64, 0.7)",
                    borderColor: "rgba(255, 159, 64, 1)",
                    borderWidth: 1,
                    hoverBackgroundColor: "rgba(255, 159, 64, 0.9)"
                }]
            },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });

        acoProfitContributionChart = new Chart(acoProfitContributionChartCtx, {
            type: "pie",
            data: {
                labels: [],
                datasets: [{
                    label: "Profit Contribution (ACO)",
                    data: [],
                    backgroundColor: ["rgba(255, 159, 64, 0.7)", "rgba(54, 162, 235, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)", "rgba(153, 102, 255, 0.7)", "rgba(0, 173, 181, 0.7)", "rgba(255, 99, 132, 0.7)", "rgba(201, 203, 207, 0.7)", "rgba(100, 150, 200, 0.7)", "rgba(220, 120, 80, 0.7)"]
                }]
            },
            options: { ...JSON.parse(JSON.stringify(chartDefaultOptions)), scales: {} }
        });

        acoCostProfitChart = new Chart(acoCostProfitChartCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "Total Cost (ACO)",
                        data: [],
                        backgroundColor: "rgba(255, 99, 132, 0.7)",
                        borderColor: "rgba(255, 99, 132, 1)",
                        borderWidth: 1
                    },
                    {
                        label: "Total Profit (ACO)",
                        data: [],
                        backgroundColor: "rgba(75, 192, 192, 0.7)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1
                    }
                ]
            },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });

        // Initialize comparison charts
        if (comparisonProfitChart) comparisonProfitChart.destroy();
        if (comparisonQuantityChart) comparisonQuantityChart.destroy();

        comparisonProfitChart = new Chart(comparisonProfitChartCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "GA Profit",
                        data: [],
                        backgroundColor: "rgba(0, 173, 181, 0.7)",
                        borderColor: "rgba(0, 173, 181, 1)",
                        borderWidth: 1
                    },
                    {
                        label: "ACO Profit",
                        data: [],
                        backgroundColor: "rgba(255, 159, 64, 0.7)",
                        borderColor: "rgba(255, 159, 64, 1)",
                        borderWidth: 1
                    }
                ]
            },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });

        comparisonQuantityChart = new Chart(comparisonQuantityChartCtx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "GA Quantity",
                        data: [],
                        backgroundColor: "rgba(0, 173, 181, 0.7)",
                        borderColor: "rgba(0, 173, 181, 1)",
                        borderWidth: 1
                    },
                    {
                        label: "ACO Quantity",
                        data: [],
                        backgroundColor: "rgba(255, 159, 64, 0.7)",
                        borderColor: "rgba(255, 159, 64, 1)",
                        borderWidth: 1
                    }
                ]
            },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });
    }

    function clearResultsDisplay() {
        // Hide all message and progress areas
        resultsMessageArea.classList.add("hidden");
        resultsMessageText.textContent = "";
        simulationProgressArea.classList.add("hidden");
        simulationErrorMessage.classList.add("hidden");
        simulationErrorMessage.textContent = "";

        // Reset progress bars and text
        overallStatusEl.textContent = "Pending";
        overallStatusEl.className = "status-text pending"; // Reset class
        gaProgressBar.style.width = "0%";
        gaProgressText.textContent = "0%";
        gaEta.textContent = "ETA: Calculating...";
        acoProgressBar.style.width = "0%";
        acoProgressText.textContent = "0%";
        acoEta.textContent = "ETA: Calculating...";

        // Hide result content wrapper initially
        resultsContentWrapper.classList.add("hidden");

        // Clear GA results
        gaTotalProfitEl.textContent = "$0.00";
        gaProductsCountEl.textContent = "0";
        gaTotalUnitsProducedEl.textContent = "0";
        gaAvgProfitPerProductEl.textContent = "$0.00";
        gaAvgQuantityPerProductEl.textContent = "0";
        gaTopProfitProductCard.classList.add("hidden");
        gaTopQuantityProductCard.classList.add("hidden");
        gaResultsTableBody.innerHTML = "";
        gaResultsTablePlaceholder.classList.remove("hidden");
        gaResultsTableActual.classList.add("hidden");

        // Clear ACO results
        acoTotalProfitEl.textContent = "$0.00";
        acoProductsCountEl.textContent = "0";
        acoTotalUnitsProducedEl.textContent = "0";
        acoAvgProfitPerProductEl.textContent = "$0.00";
        acoAvgQuantityPerProductEl.textContent = "0";
        acoTopProfitProductCard.classList.add("hidden");
        acoTopQuantityProductCard.classList.add("hidden");
        acoResultsTableBody.innerHTML = "";
        acoResultsTablePlaceholder.classList.remove("hidden");
        acoResultsTableActual.classList.add("hidden");

        // Clear comparison results
        comparisonGaProfitEl.textContent = "$0.00";
        comparisonAcoProfitEl.textContent = "$0.00";
        comparisonProfitDiffEl.textContent = "$0.00";
        comparisonBetterAlgoEl.textContent = "N/A";

        // Initialize all charts
        initializeCharts();
    }

    function showGlobalLoader(show) {
        globalLoaderOverlay.classList.toggle("hidden", !show);
    }

    // Main simulation event handler
    runSimulationButton.addEventListener("click", async () => {
        // Prevent multiple clicks if a simulation is already active
        if (isSimulationActive) {
            console.warn("Simulation is already active. Ignoring multiple clicks.");
            return;
        }

        // --- FIX: Add this block ---
        // Explicitly stop any leftover polling from a previous run
        if (statusPollingIntervalId) {
            clearInterval(statusPollingIntervalId);
            statusPollingIntervalId = null;
            console.log("Cleared a leftover polling interval before starting a new simulation.");
        }
        // --- End of FIX ---

        if (!validateInputs()) {
            return; // Stop if inputs are not valid
        }

        isSimulationActive = true; // Set flag immediately to prevent further clicks
        clearResultsDisplay(); // Clear previous results and progress
        showGlobalLoader(true);
        buttonText.textContent = "Starting simulation...";
        buttonSpinner.classList.remove("hidden");
        runSimulationButton.disabled = true; // Disable button immediately

        const formData = new FormData();
        if (fileInput.files[0]) {
            formData.append("file", fileInput.files[0]);
        } else {
            showGlobalLoader(false);
            // Re-enable button and reset flag if file is missing here
            isSimulationActive = false;
            buttonText.textContent = "Run Simulation";
            buttonSpinner.classList.add("hidden");
            runSimulationButton.disabled = false;
            showGeneralUploadFeedback("File is required for simulation.");
            return;
        }

        formData.append("productionBudget", parseFloat(document.getElementById("production-budget").value));
        formData.append("marketingBudget", parseFloat(document.getElementById("marketing-budget").value));
        formData.append("logisticsBudget", parseFloat(document.getElementById("logistics-budget").value));
        formData.append("discountBase", parseFloat(document.getElementById("discount_base").value));
        formData.append("shelfSpace", parseFloat(document.getElementById("space_storage").value));
        formData.append("chromosomeBits", parseInt(document.getElementById("bits_number").value));

        const columnMappings = getColumnMappings();
        formData.append("colName", columnMappings["colName"] || "");
        formData.append("colPrice", columnMappings["colPrice"] || "");
        formData.append("colCp", columnMappings["colCp"] || "");
        formData.append("colCm", columnMappings["colCm"] || "");
        formData.append("colCl", columnMappings["colCl"] || "");
        formData.append("colShelfCost", columnMappings["colShelfCost"] || "");
        formData.append("colAge", columnMappings["colAge"] || "");
        formData.append("colStock", columnMappings["colStock"] || "");
        formData.append("colShelf", columnMappings["colShelf"] || "");
        formData.append("colDemand", columnMappings["colDemand"] || "");

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            // Send the initial request to start the simulation
            const response = await fetch(`${API_URL}/simulate`, {
                method: "POST",
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            showGlobalLoader(false); // Hide global loader once simulation ID is received

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Server error response text:", errorText);

                let errorMessage = `Server error: ${response.status}`;
                try {
                    errorMessage = JSON.parse(errorText).message || JSON.parse(errorText).error || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            currentSimulationId = await response.text(); // Get the simulationId from the backend
            console.log("Simulation started with ID:", currentSimulationId);

            // Switch to results tab to show progress area
            navLinks.forEach(link => {
                if (link.dataset.section === "results") {
                    link.click();
                }
            });

            simulationProgressArea.classList.remove("hidden"); // Show the progress area
            overallStatusEl.textContent = "Running";
            overallStatusEl.classList.remove("pending");
            overallStatusEl.classList.add("running");
            showResultsMessage("Simulation is running...", "info"); // Show a general message too

            // Start polling for status updates
            statusPollingIntervalId = setInterval(() => pollSimulationStatus(currentSimulationId), STATUS_POLLING_INTERVAL);

        } catch (error) {
            console.error("Error during simulation setup:", error);
            showResultsMessage(`Error starting simulation: ${error.message}`, "error");

            // Clean up if an error occurred before polling could start
            if (statusPollingIntervalId) {
                clearInterval(statusPollingIntervalId);
                statusPollingIntervalId = null;
            }
            // Reset simulation active flag and re-enable button on setup error
            isSimulationActive = false;
            buttonText.textContent = "Run Simulation";
            buttonSpinner.classList.add("hidden");
            runSimulationButton.disabled = false;
        }
    });

    async function pollSimulationStatus(simId) {
        // FIX: If the simulation ID we are polling for is not the currently active one,
        // stop execution immediately. This prevents processing responses from old simulations.
        if (!currentSimulationId || simId !== currentSimulationId) {
            console.warn(`Polling aborted for obsolete simulation ID: ${simId}`);
            return;
        }

        let rawResponseText = ""; // Declare variable to store raw response

        try {
            const response = await fetch(`${API_URL}/simulate/status/${simId}`);

            // FIX: Add a second check. If the active simulation ID changed while this
            // network request was in-flight, abort processing the response.
            if (!currentSimulationId || simId !== currentSimulationId) {
                console.warn(`Polling aborted for obsolete simulation ID (post-fetch): ${simId}`);
                return;
            }


            // Capture raw response text, even if not ok, for better debugging
            rawResponseText = await response.text();
            console.log("Raw status response text:", rawResponseText); // Log raw response

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`Simulation ID ${simId} not found, stopping polling.`);
                    stopPolling(`Simulation ID ${simId} expired or not found.`, "error"); // Pass type for message
                    return; // Exit function if 404
                } else {
                    // Attempt to parse JSON even if !response.ok to get more details
                    let errorDetails = rawResponseText;
                    try {
                        const errorJson = JSON.parse(rawResponseText);
                        errorDetails = errorJson.message || errorJson.error || rawResponseText;
                    } catch (e) {
                        // Not JSON, use raw text
                    }
                    throw new Error(`Failed to fetch status: ${response.status} - ${errorDetails}`);
                }
            }

            let status;
            try {
                status = JSON.parse(rawResponseText); // Parse using raw text
                console.log("Parsed Simulation Status:", JSON.stringify(status, null, 2)); // Log parsed object
            } catch (jsonError) {
                console.error("JSON parsing error for status update:", jsonError);
                stopPolling(`Invalid JSON received from status endpoint: ${jsonError.message}. Raw: ${rawResponseText}`, "error"); // Stop on JSON error
                return;
            }

            // Update overall status display
            overallStatusEl.textContent = status.overallStatus || "Unknown";
            overallStatusEl.className = `status-text ${status.overallStatus ? status.overallStatus.toLowerCase() : 'unknown'}`;

            // Update GA progress
            if (status.gaProgress !== null && typeof status.gaProgress === 'number') {
                gaProgressBar.style.width = `${status.gaProgress}%`;
                gaProgressText.textContent = `${status.gaProgress.toFixed(1)}%`;
                gaEta.textContent = (status.gaEstimatedTimeRemaining !== null && typeof status.gaEstimatedTimeRemaining === 'number' && status.gaEstimatedTimeRemaining > 0) ?
                    `ETA: ${status.gaEstimatedTimeRemaining.toFixed(1)}s` : "ETA: Done";
            } else {
                gaProgressBar.style.width = `0%`;
                gaProgressText.textContent = `0%`;
                gaEta.textContent = "ETA: Calculating...";
            }

            // Update ACO progress
            if (status.acoProgress !== null && typeof status.acoProgress === 'number') {
                acoProgressBar.style.width = `${status.acoProgress}%`;
                acoProgressText.textContent = `${status.acoProgress.toFixed(1)}%`;
                acoEta.textContent = (status.acoEstimatedTimeRemaining !== null && typeof status.acoEstimatedTimeRemaining === 'number' && status.acoEstimatedTimeRemaining > 0) ?
                    `ETA: ${status.acoEstimatedTimeRemaining.toFixed(1)}s` : "ETA: Done";
            } else {
                acoProgressBar.style.width = `0%`;
                acoProgressText.textContent = `0%`;
                acoEta.textContent = "ETA: Calculating...";
            }

            // Handle individual algorithm errors if they occur
            if (status.gaHasError) {
                // Ensure error message is shown only once or accumulated properly
                if (!simulationErrorMessage.textContent.includes("Genetic Algorithm Error")) {
                    simulationErrorMessage.textContent += (simulationErrorMessage.textContent ? "\n" : "") + `Genetic Algorithm Error: ${status.errorMessage || "An unknown GA error occurred."}`;
                }
                simulationErrorMessage.classList.remove("hidden");
            }
            if (status.acoHasError) {
                // Ensure error message is shown only once or accumulated properly
                if (!simulationErrorMessage.textContent.includes("Ant Colony Optimization Error")) {
                    simulationErrorMessage.textContent += (simulationErrorMessage.textContent ? "\n" : "") + `Ant Colony Optimization Error: ${status.errorMessage || "An unknown ACO error occurred."}`;
                }
                simulationErrorMessage.classList.remove("hidden");
            }

            // Check if both algorithms have finished processing (either successfully or with error)
            if (status.gaFinished && status.acoFinished) {
                let finalMessage = `Simulation finished with overall status: ${status.overallStatus}`;
                let messageType = status.overallStatus.toLowerCase();

                // Handle special status cases
                if (status.overallStatus === "INVISIBLE_SOLUTION") {
                    finalMessage = "Invisible Solution - One or both algorithms returned zero or negative profit. This may indicate insufficient budget or unfavorable market conditions.";
                    messageType = "warning";
                } else if (status.overallStatus === "SHELF_SPACE_ERROR") {
                    finalMessage = status.errorMessage || "No Space in total shelf space - Required shelf space exceeds available capacity.";
                    messageType = "error";
                } else if (status.overallStatus === "VALIDATION_ERROR") {
                    finalMessage = status.errorMessage || "Validation error - Please check your input parameters.";
                    messageType = "error";
                } else if (status.overallStatus === "ERROR") {
                    finalMessage = status.errorMessage || "Simulation completed with errors. Please check the error details below.";
                    messageType = "error";
                } else if (status.overallStatus === "COMPLETED") {
                    finalMessage = "Simulation completed successfully! Results are displayed below.";
                    messageType = "success";
                }

                stopPolling(finalMessage, messageType);

                // Only try to update results if we have a successful completion or invisible solution
                if (status.overallStatus === "COMPLETED" || status.overallStatus === "INVISIBLE_SOLUTION") {
                    if (status.result) {
                        currentSimResults = status.result; // Store final combined results

                        // Update dashboard metrics with GA results (for backward compatibility)
                        dashboardProfitMetricEl.textContent = "$" + (currentSimResults.gaResult && currentSimResults.gaResult.totalProfit !== undefined ? currentSimResults.gaResult.totalProfit.toFixed(2) : "0.00");
                        dashboardProductsMetricEl.textContent = currentSimResults.gaResult && currentSimResults.gaResult.products ? currentSimResults.gaResult.products.length : 0;

                        // Update results for both algorithms (will handle null/empty internally)
                        updateGAResults(currentSimResults.gaResult || { products: [] });
                        updateACOResults(currentSimResults.antColonyResult || { products: [] });
                        updateComparisonResults(currentSimResults.gaResult || { products: [] }, currentSimResults.antColonyResult || { products: [] });

                        resultsContentWrapper.classList.remove("hidden"); // Show the results content
                        resultsMessageArea.classList.add("hidden"); // Hide the running message

                        // For Infeasible solution, show additional guidance
                        if (status.overallStatus === "INVISIBLE_SOLUTION") {
                            showResultsMessage("Infeasible Solution detected (zero or negative profit). Consider adjusting budget parameters or reviewing product data.", "warning");
                        }
                    } else {
                        // This case indicates a deeper issue if finished but no results object
                        console.error("Simulation finished but results object is null:", status);
                        showResultsMessage("Simulation finished, but no results data was received. Please check server logs for detailed errors.", "error");
                    }
                } else {
                    // For error cases, don't show results content
                    resultsContentWrapper.classList.add("hidden");
                    resultsMessageArea.classList.remove("hidden");
                }

                // Update chat data status if data sharing is enabled
                if (isChatDataSharingEnabled) {
                    updateChatDataStatus(true);
                }

            } else {
                // If not yet finished, show the running message with time estimates
                let runningMessage = "Simulation is running...";
                if (status.gaEstimatedTimeRemaining > 0 || status.acoEstimatedTimeRemaining > 0) {
                    const maxEta = Math.max(status.gaEstimatedTimeRemaining || 0, status.acoEstimatedTimeRemaining || 0);
                    if (maxEta > 0) {
                        runningMessage += ` Estimated time remaining: ${maxEta.toFixed(0)} seconds`;
                    }
                }
                showResultsMessage(runningMessage, "info");
            }

        } catch (error) {
            console.error("Error polling simulation status:", error);
            const displayMessage = typeof error.message === 'string' ? error.message : String(error);
            stopPolling(`Error fetching status: ${displayMessage}`, "error");
            simulationErrorMessage.textContent = `Error fetching status: ${displayMessage}`;
            simulationErrorMessage.classList.remove("hidden");
            showResultsMessage(`An error occurred during simulation status update.`, "error");
        }
    }

    function stopPolling(message, type = "info") {
        if (statusPollingIntervalId) {
            clearInterval(statusPollingIntervalId);
            statusPollingIntervalId = null;
        }

        // --- FIX: Add cleanup call ---
        if (currentSimulationId) {
            cleanupSimulation(currentSimulationId); // Call cleanup when polling stops
            currentSimulationId = null; // Clear the ID after cleanup
        }
        // --- End of FIX ---

        isSimulationActive = false; // Reset flag to allow new simulations
        buttonText.textContent = "Run Simulation";
        buttonSpinner.classList.add("hidden");
        runSimulationButton.disabled = false;
        console.log(`Polling stopped: ${message}`); // Log the message here
        // Update the main results message area with the final status message
        showResultsMessage(message, type);
    }

    /**
     * Sends a request to the backend to clean up a finished simulation.
     * @param {string} simId The ID of the simulation to clean up.
     */
    async function cleanupSimulation(simId) {
        if (!simId) return;
        console.log(`Requesting cleanup for simulation ID: ${simId}`);
        try {
            // Corrected the fetch URL to point to the right endpoint
            const response = await fetch(`/api/simulate/cleanup/${simId}`, {
                method: 'POST',
            });
            if (response.ok) {
                console.log(`Successfully cleaned up simulation ID: ${simId}`);
            } else {
                console.warn(`Failed to cleanup simulation ID: ${simId}. Status: ${response.status}`);
            }
        } catch (error) {
            console.error(`Error during cleanup for simulation ID: ${simId}`, error);
        }
    }

    // Initialize charts on page load
    initializeCharts();

    // Show initial results message
    showResultsMessage("Run a simulation to see results and analysis.", "info");

    // --- Enhanced Gemini Chat Feature ---
    const geminiChatNavButton = document.getElementById("gemini-chat-nav-button");
    const geminiChatOverlay = document.getElementById("gemini-chat-fullscreen-overlay");
    const geminiChatCloseButton = document.getElementById("gemini-chat-close-button");
    const geminiChatMessages = document.getElementById("gemini-chat-messages");
    const geminiChatInput = document.getElementById("gemini-chat-input");
    const geminiChatSendButton = document.getElementById("gemini-chat-send-button");
    const geminiChatDataButton = document.getElementById("gemini-chat-data-button");
    const geminiChatClearButton = document.getElementById("gemini-chat-clear-button");
    const geminiChatDataStatusText = document.getElementById("gemini-chat-data-status-text");

    // Gemini API configuration
    const GEMINI_API_KEY = "AIzaSyCqlGCUlq4P_yJL_oC3iD0Ih4kMmhVgeu4"; // User provided key
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Chat history and data sharing state
    let chatHistory = [];
    let isChatDataSharingEnabled = false;
    let chatSystemContext = "";

    // Initialize chat UI
    if (geminiChatNavButton && geminiChatOverlay && geminiChatCloseButton &&
        geminiChatMessages && geminiChatInput && geminiChatSendButton) {

        // Open chat overlay
        geminiChatNavButton.addEventListener("click", () => {
            geminiChatOverlay.classList.remove("hidden");
            appMainContent.classList.add("blurred");
            geminiChatInput.focus();
        });

        // Close chat overlay
        geminiChatCloseButton.addEventListener("click", () => {
            geminiChatOverlay.classList.add("hidden");
            appMainContent.classList.remove("blurred");
        });

        // Toggle data sharing
        geminiChatDataButton.addEventListener("click", () => {
            isChatDataSharingEnabled = !isChatDataSharingEnabled;
            geminiChatDataButton.classList.toggle("active", isChatDataSharingEnabled);
            updateChatDataStatus(isChatDataSharingEnabled);

            if (isChatDataSharingEnabled) {
                // Generate system context with current data
                generateSystemContext();

                // Add system message to inform user
                addChatMessage("assistant", "I now have access to your optimization data and results. Feel free to ask me questions about your simulation results, parameters, or recommendations for improving your fashion pricing strategy.");
            } else {
                // Clear system context
                chatSystemContext = "";

                // Add system message to inform user
                addChatMessage("assistant", "I no longer have access to your optimization data. I can still help with general questions about fashion pricing optimization.");
            }
        });

        // Clear chat history
        geminiChatClearButton.addEventListener("click", () => {
            // Clear chat UI
            geminiChatMessages.innerHTML = "";

            // Clear chat history
            chatHistory = [];

            // Add welcome message
            addChatMessage("assistant", "Chat history cleared. How can I help you today?");
        });

        // Send message on button click
        geminiChatSendButton.addEventListener("click", () => {
            sendChatMessage();
        });

        // Send message on Enter key (but allow Shift+Enter for new lines)
        geminiChatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }

            // Auto-resize textarea
            setTimeout(() => {
                geminiChatInput.style.height = "auto";
                geminiChatInput.style.height = Math.min(geminiChatInput.scrollHeight, 120) + "px";
            }, 0);
        });

        // Add welcome message
        addChatMessage("assistant", "Hello! I'm your Fashion Pricing Optimization assistant. How can I help you today? Click the database icon to share your optimization data with me for personalized insights.");
    }

    // Function to update chat data status
    function updateChatDataStatus(isEnabled) {
        if (isEnabled) {
            geminiChatDataStatusText.innerHTML = `<i class="fas fa-check-circle" style="color: var(--accent-color-primary);"></i> AI has access to your optimization data. Ask about your results!`;
            geminiChatDataStatusText.parentElement.classList.add("active");
        } else {
            geminiChatDataStatusText.innerHTML = `AI has no access to your data yet. Click <i class="fas fa-database"></i> to share.`;
            geminiChatDataStatusText.parentElement.classList.remove("active");
        }
    }

    // Function to generate system context from current data
    function generateSystemContext() {
        let context = "You are a Fashion Pricing Optimization assistant with access to the following data:\n\n";

        // Add input parameters if available
        context += "## Input Parameters\n";
        const productionBudget = document.getElementById("production-budget").value;
        const marketingBudget = document.getElementById("marketing-budget").value;
        const logisticsBudget = document.getElementById("logistics-budget").value;
        const discountBase = document.getElementById("discount_base").value;
        const shelfSpace = document.getElementById("space_storage").value;
        const chromosomeBits = document.getElementById("bits_number").value;

        if (productionBudget) context += `- Production Budget: $${productionBudget}\n`;
        if (marketingBudget) context += `- Marketing Budget: $${marketingBudget}\n`;
        if (logisticsBudget) context += `- Logistics Budget: $${logisticsBudget}\n`;
        if (discountBase) context += `- Discount Base: ${discountBase}%\n`;
        if (shelfSpace) context += `- Shelf Space Storage: ${shelfSpace} units\n`;
        if (chromosomeBits) context += `- Chromosome Bits: ${chromosomeBits}\n`;

        // Add uploaded data summary if available
        if (uploadedData && uploadedData.length > 0) {
            context += `\n## Uploaded Product Data\n`;
            context += `- Number of Products: ${uploadedData.length}\n`;

            // Add sample of product names if available
            const sampleSize = Math.min(5, uploadedData.length);
            const productNames = uploadedData.slice(0, sampleSize).map(p => {
                // Try to find product name in various possible column names
                // Using the specific column name from mapping for product_name
                const mappings = getColumnMappings();
                const productNameCol = mappings["colName"] || "Product Name"; // Fallback
                return p[productNameCol] || "Unknown Product";
            });

            if (productNames.length > 0) {
                context += `- Sample Products: ${productNames.join(", ")}${uploadedData.length > sampleSize ? ", ..." : ""}\n`;
            }
        }

        // Add optimization results if available
        if (currentSimResults) {
            // Add GA results
            if (currentSimResults.gaResult) {
                const ga = currentSimResults.gaResult;
                context += `\n## Genetic Algorithm Results\n`;
                context += `- Total Profit: $${ga.totalProfit !== undefined ? ga.totalProfit.toFixed(2) : "N/A"}\n`;
                context += `- Number of Products: ${ga.products ? ga.products.length : 0}\n`;

                if (ga.products && ga.products.length > 0) {
                    // Calculate total units and average profit
                    const totalUnits = ga.products.reduce((sum, p) => sum + p.quantity, 0);
                    const avgProfit = ga.products.length > 0 ? ga.totalProfit / ga.products.length : 0;

                    context += `- Total Units Produced: ${totalUnits}\n`;
                    context += `- Average Profit per Product: $${avgProfit.toFixed(2)}\n`;

                    // Find top products
                    const topProfitProduct = [...ga.products].sort((a, b) => b.totalProfit - a.totalProfit)[0];
                    const topQuantityProduct = [...ga.products].sort((a, b) => b.quantity - a.quantity)[0];

                    if (topProfitProduct) context += `- Top Product by Profit: ${topProfitProduct.name} ($${topProfitProduct.totalProfit.toFixed(2)})\n`;
                    if (topQuantityProduct) context += `- Top Product by Quantity: ${topQuantityProduct.name} (${topQuantityProduct.quantity} units)\n`;

                    // Add detailed product data (limited to top 5)
                    context += `\n### Top 5 GA Products by Profit\n`;
                    const top5Products = [...ga.products].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);
                    top5Products.forEach(p => {
                        context += `- ${p.name}: Quantity=${p.quantity}, Price=$${p.price.toFixed(2)}, Profit=$${p.totalProfit.toFixed(2)}\n`;
                    });
                }
            }

            // Add ACO results
            if (currentSimResults.antColonyResult) {
                const aco = currentSimResults.antColonyResult;
                context += `\n## Ant Colony Optimization Results\n`;
                context += `- Total Profit: $${aco.totalProfit !== undefined ? aco.totalProfit.toFixed(2) : "N/A"}\n`;
                context += `- Number of Products: ${aco.products ? aco.products.length : 0}\n`;

                if (aco.products && aco.products.length > 0) {
                    // Calculate total units and average profit
                    const totalUnits = aco.products.reduce((sum, p) => sum + p.quantity, 0);
                    const avgProfit = aco.products.length > 0 ? aco.totalProfit / aco.products.length : 0;

                    context += `- Total Units Produced: ${totalUnits}\n`;
                    context += `- Average Profit per Product: $${avgProfit.toFixed(2)}\n`;

                    // Find top products
                    const topProfitProduct = [...aco.products].sort((a, b) => b.totalProfit - a.totalProfit)[0];
                    const topQuantityProduct = [...aco.products].sort((a, b) => b.quantity - a.quantity)[0];

                    if (topProfitProduct) context += `- Top Product by Profit: ${topProfitProduct.name} ($${topProfitProduct.totalProfit.toFixed(2)})\n`;
                    if (topQuantityProduct) context += `- Top Product by Quantity: ${topQuantityProduct.name} (${topQuantityProduct.quantity} units)\n`;

                    // Add detailed product data (limited to top 5)
                    context += `\n### Top 5 ACO Products by Profit\n`;
                    const top5Products = [...aco.products].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5);
                    top5Products.forEach(p => {
                        context += `- ${p.name}: Quantity=${p.quantity}, Price=$${p.price.toFixed(2)}, Profit=$${p.totalProfit.toFixed(2)}\n`;
                    });
                }
            }

            // Add comparison if both results are available
            if (currentSimResults.gaResult && currentSimResults.antColonyResult) {
                const ga = currentSimResults.gaResult;
                const aco = currentSimResults.antColonyResult;

                context += `\n## Algorithm Comparison\n`;
                context += `- GA Total Profit: $${ga.totalProfit !== undefined ? ga.totalProfit.toFixed(2) : "N/A"}\n`;
                context += `- ACO Total Profit: $${aco.totalProfit !== undefined ? aco.totalProfit.toFixed(2) : "N/A"}\n`;

                if (ga.totalProfit !== undefined && aco.totalProfit !== undefined) {
                    const profitDiff = Math.abs(ga.totalProfit - aco.totalProfit);
                    const betterAlgo = ga.totalProfit > aco.totalProfit ? "Genetic Algorithm" :
                        (aco.totalProfit > ga.totalProfit ? "Ant Colony Optimization" : "Equal");

                    context += `- Profit Difference: $${profitDiff.toFixed(2)}\n`;
                    context += `- Better Algorithm: ${betterAlgo}\n`;
                }
            }
        }

        // Add instructions for the AI
        context += `\n## Instructions
- You are an expert in fashion pricing optimization and retail strategy
- Provide insights and analysis based on the data above
- Suggest improvements to the pricing strategy when asked
- Compare GA and ACO results when both are available
- Explain concepts in simple terms when needed
- Be concise but informative in your responses
- If asked about data not provided above, acknowledge the limitation and offer general advice instead`;

        chatSystemContext = context;
    }

    // Function to send chat message
    async function sendChatMessage() {
        const userMessage = geminiChatInput.value.trim();
        if (!userMessage) return;

        // Clear input and reset height
        geminiChatInput.value = "";
        geminiChatInput.style.height = "auto";

        // Add user message to chat
        addChatMessage("user", userMessage);

        // Show typing indicator
        const typingIndicator = document.createElement("div");
        typingIndicator.className = "chat-message assistant-message typing-indicator";
        typingIndicator.innerHTML = "<div class='typing-dots'><span></span><span></span><span></span></div>";
        geminiChatMessages.appendChild(typingIndicator);
        geminiChatMessages.scrollTop = geminiChatMessages.scrollHeight;

        try {
            // Prepare request payload
            let payload = {
                contents: [],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            };

            // Add system context if data sharing is enabled
            if (isChatDataSharingEnabled && chatSystemContext) {
                payload.contents.push({
                    role: "user",
                    parts: [{ text: chatSystemContext }]
                });

                payload.contents.push({
                    role: "model",
                    parts: [{ text: "I understand the fashion pricing optimization context and have access to the data you've shared. I'll use this information to provide insights and analysis." }]
                });
            }

            // Add chat history (limited to last 10 messages)
            const recentHistory = chatHistory.slice(-10);
            recentHistory.forEach(msg => {
                payload.contents.push(msg);
            });

            // Add current user message
            payload.contents.push({
                role: "user",
                parts: [{ text: userMessage }]
            });

            // Send request to Gemini API
            const response = await fetch(GEMINI_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            // Remove typing indicator
            geminiChatMessages.removeChild(typingIndicator);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to get response from Gemini");
            }

            const data = await response.json();
            const assistantMessage = data.candidates[0]?.content?.parts[0]?.text || "I'm sorry, I couldn't generate a response.";

            // Add assistant message to chat
            addChatMessage("assistant", assistantMessage);

            // Add messages to history
            chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
            chatHistory.push({ role: "model", parts: [{ text: assistantMessage }] });

        } catch (error) {
            console.error("Error in Gemini chat:", error);

            // Remove typing indicator if still present
            if (typingIndicator.parentNode) {
                geminiChatMessages.removeChild(typingIndicator);
            }

            // Add error message
            addChatMessage("assistant", "I'm sorry, there was an error processing your request. Please try again later or check your API key.");
        }
    }

    // Function to add message to chat UI
    function addChatMessage(role, message) {
        const messageElement = document.createElement("div");
        messageElement.className = `chat-message ${role}-message`;

        // Format message with markdown-like syntax
        const formattedMessage = formatChatMessage(message);

        messageElement.innerHTML = formattedMessage;
        geminiChatMessages.appendChild(messageElement);
        geminiChatMessages.scrollTop = geminiChatMessages.scrollHeight;
    }

    // Function to format chat message with basic markdown
    function formatChatMessage(message) {
        // Replace URLs with clickable links
        message = message.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

        // Replace ** for bold
        message = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Replace * for italic
        message = message.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Replace ` for code
        message = message.replace(/`(.*?)`/g, '<code>$1</code>');

        // Replace code blocks
        message = message.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Replace newlines with <br>
        message = message.replace(/\n/g, '<br>');

        return message;
    }

    // Auto-resize textarea on input
    geminiChatInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });
});
