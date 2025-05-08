document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const API_URL = 'http://localhost:8080/api/simulate'; // Adjust if backend runs on a different host/port
    const FETCH_TIMEOUT =    // SPA Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
                document.getElementById(link.dataset.section).classList.add('active');
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

    // File Handling
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    let uploadedData = [];
    let columnMappings = {};

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFile);
    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, highlight, false));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, unhighlight, false));
    dropZone.addEventListener('drop', handleDrop, false);

    function highlight(e) {
        e.preventDefault();
        dropZone.style.backgroundColor = 'var(--hover-color)';
    }

    function unhighlight(e) {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
    }

    function handleDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length) handleFile({ target: { files } });
    }

    function handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('filename').textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            processFile(file, data);
        };
        reader.readAsArrayBuffer(file);
    }

    function processFile(file, data) {
        if (file.name.endsWith('.xlsx')) {
            processExcel(data);
        } else if (file.name.endsWith('.csv')) {
            processCSV(new TextDecoder().decode(data));
        } else {
            alert('Unsupported file format. Please upload CSV or XLSX.');
        }
    }

    function processExcel(data) {
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        uploadedData = XLSX.utils.sheet_to_json(worksheet);
        updateFileInfo();
        createColumnMapping(XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0]);
    }

    function processCSV(csvData) {
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        const headers = rows[0].split(',').map(h => h.trim());
        uploadedData = rows.slice(1).map(row => {
            const values = row.split(',').map(v => v.trim());
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || '';
                return obj;
            }, {});
        });
        updateFileInfo();
        createColumnMapping(headers);
    }

    function updateFileInfo() {
        document.getElementById('row-count').textContent = uploadedData.length;
    }

    function createColumnMapping(headers) {
        const mappingDiv = document.getElementById('column-mapping');
        mappingDiv.innerHTML = '<h3>Map Columns to Parameters</h3>';
        headers.forEach(header => {
            const div = document.createElement('div');
            div.className = 'mapping-group';
            div.innerHTML = `
                <label>${header}:</label>
                <select class="param-select" data-column="${header}">
                    <option value="">Ignore</option>
                    <option value="product_name">Product Name</option>
                    <option value="production_cost">Production Cost</option>
                    <option value="marketing_cost">Marketing Cost</option>
                    <option value="demand">Demand</option>
                    <option value="price">Price</option>
                    <option value="shelf_space">Shelf Space</option>
                </select>
            `;
            mappingDiv.appendChild(div);
        });
    }

    // Chart Initialization
    let productionChart;
    const ctx = document.getElementById('productionChart').getContext('2d');
    function initializeChart() {
        productionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Optimal Production',
                    data: [],
                    backgroundColor: 'rgba(255, 77, 109, 0.8)'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#fff' } },
                    x: { ticks: { color: '#fff' } }
                }
            }
        });
    }
    initializeChart();

    // Validation
    function validateInputs() {
        const inputs = [
            { id: 'production-budget', label: 'Production Budget' },
            { id: 'marketing-budget', label: 'Marketing Budget' },
            { id: 'logistics-budget', label: 'Logistics Budget' },
            { id: 'discount_base', label: 'Discount Base' },
            { id: 'space_storage', label: 'Shelf Space' },
            { id: 'bits_number', label: 'Chromosome Bits' }
        ];
        let valid = true;

        inputs.forEach(({ id, label }) => {
            const input = document.getElementById(id);
            if (!input.value || isNaN(input.value) || parseFloat(input.value) < 0) {
                input.style.borderColor = 'red';
                alert(`Please enter a valid ${label}.`);
                valid = false;
            } else {
                input.style.borderColor = 'var(--accent-color)';
            }
        });

        if (!fileInput.files[0]) {
            alert('Please upload a CSV or XLSX file.');
            valid = false;
        }

        return valid;
    }

    // Simulation Logic
    document.getElementById('run-simulation').addEventListener('click', async () => {
        if (!validateInputs()) return;

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        formData.append('productionBudget', document.getElementById('production-budget').value);
        formData.append('marketingBudget', document.getElementById('marketing-budget').value);
        formData.append('logisticsBudget', document.getElementById('logistics-budget').value);
        formData.append('discountBase', document.getElementById('discount_base').value);
        formData.append('shelfSpace', document.getElementById('space_storage').value);
        formData.append('chromosomeBits', document.getElementById('bits_number').value);

        try {
            console.log('Sending request to:', API_URL);
            console.log('FormData contents:', [...formData.entries()]);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Simulation failed: Server responded with status ${response.status}: ${errorText}`);
            }

            const results = await response.json();
            console.log('Received results:', results);

            // Validate response
            if (!results || typeof results.totalProfit !== 'number' || !Array.isArray(results.products)) {
                throw new Error('Invalid response format: Missing or invalid totalProfit or products');
            }

            updateResults(results);
        } catch (error) {
            console.error('Fetch error:', error);
            let errorMessage = `Simulation failed: ${error.message}.`;
            if (error.name === 'AbortError') {
                errorMessage += ' Request timed out after 30 seconds.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage += ' Ensure the backend server is running on ' + API_URL + '.';
            }
            alert(errorMessage + ' Check the console for details.');
        }
    });

    function updateResults(results) {
        // Update dashboard metrics
        document.getElementById('profit-metric').textContent = results.totalProfit
            ? `$${results.totalProfit.toFixed(2)}`
            : '$0.00';
        document.getElementById('products-metric').textContent = results.products
            ? results.products.length
            : 0;

        // Update results section metrics
        document.getElementById('total-profit').textContent = results.totalProfit
            ? `$${results.totalProfit.toFixed(2)}`
            : '$0.00';
        document.getElementById('products-count').textContent = results.products
            ? results.products.length
            : 0;

        // Update chart
        productionChart.data.labels = results.products
            ? results.products.map(p => p.name)
            : [];
        productionChart.data.datasets[0].data = results.products
            ? results.products.map(p => p.quantity)
            : [];
        productionChart.update();

        // Update table
        const tableHtml = results.products && results.products.length
            ? `
            <table class="result-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Unit Cost</th>
                        <th>Profit/Unit</th>
                        <th>Total Profit</th>
                        <th>Total Cost</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.products.map(p => `
                        <tr>
                            <td>${p.name || 'N/A'}</td>
                            <td>${p.quantity ?? 0}</td>
                            <td>$${p.price ? p.price.toFixed(2) : '0.00'}</td>
                            <td>$${p.unitCost ? p.unitCost.toFixed(2) : '0.00'}</td>
                            <td>$${p.profitPerUnit ? p.profitPerUnit.toFixed(2) : '0.00'}</td>
                            <td>$${p.totalProfit ? p.totalProfit.toFixed(2) : '0.00'}</td>
                            <td>$${p.totalCost ? p.totalCost.toFixed(2) : '0.00'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `
            : '<p>No results available.</p>';
        document.getElementById('results-table').innerHTML = tableHtml;

        // Switch to results section
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.getElementById('results').classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-section="results"]').classList.add('active');
    }
});