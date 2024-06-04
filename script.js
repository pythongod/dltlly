let csvData = []; // Declare csvData to store the CSV data
let currentData = []; // Data currently displayed (filtered or full dataset)
const googleSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTQCuvOmXn1mJTpP8Xsxs_hQGuGvKgWuvbb_ZwvuM2rCb0hBmNUOEKiyk25-hy5ljG-4tCuLqVwrRx/pub?gid=1245526804&single=true&output=csv';
const localCSVURL = '/data/battle_events.csv';

// Function to parse CSV text into a 2D array
function parseCSV(text) {
    return text.split('\n').map(row => row.split(','));
}

// Function to populate the table with data
function populateTable(data, searchText = '', showAdditionalColumns = false) {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    let count = 0; // Initialize a counter for the number of rows
    data.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        count++; // Increment count for each row
        const tr = document.createElement('tr');
        row.forEach((cell, cellIndex) => {
            if (cellIndex === 8) return; // Skip the ID column

            const td = document.createElement('td');

            if (cellIndex === 9) { // Correct this to match the 'Views' column if indices changed
                td.textContent = parseInt(cell).toLocaleString();
            } else if (searchText && cell.toLowerCase().includes(searchText.toLowerCase())) {
                td.innerHTML = cell.replace(new RegExp(searchText, 'gi'), match => `<span class="highlight">${match}</span>`);
            } else {
                td.textContent = cell;
            }

            if (cellIndex === 7) { // Correct this if the indices shift due to column removal
                const URL = `${row[7]}`;
                const URLtext = 'Link';
                td.innerHTML = `<a href="${URL}" target="_blank">${URLtext}</a>`;
            }

            if (showAdditionalColumns && (cellIndex === 10 || cellIndex === 11 || cellIndex === 12)) {
                tr.appendChild(td);
            } else if (cellIndex < 10) {
                tr.appendChild(td);
            }
        });
        tableBody.appendChild(tr);
    });
    document.getElementById('search-results').textContent = `Search results: ${count}`;
}

// Function to sort data by uploaded date
function sortDataByUploaded(data) {
    return data.slice(1).sort((a, b) => {
        if (!a[6] || !b[6]) {
            return !a[6] ? 1 : -1;
        }
        const datePattern = /(\d{4}-\d{1,2}-\d{1,2})/;
        const dateStringA = (a[6].match(datePattern) || [])[1];
        const dateStringB = (b[6].match(datePattern) || [])[1];
        const dateA = dateStringA ? new Date(dateStringA) : new Date(0);
        const dateB = dateStringB ? new Date(dateStringB) : new Date(0);
        return dateB - dateA;
    });
}

// Function to sort data by views
function sortDataByViews(data, isAscending) {
    return data.slice(1).sort((a, b) => {
        const viewsA = parseInt(a[9]);
        const viewsB = parseInt(b[9]);

        if (isAscending) {
            return viewsA - viewsB; // For ascending order
        } else {
            return viewsB - viewsA; // For descending order
        }
    });
}

// Function to search within the table
function searchTable(data, showAdditionalColumns = false) {
    const searchText = document.getElementById('searchBox').value.toLowerCase();
    const filteredData = data.filter((row, index) => {
        if (index === 0) return true;
        return row.some((cell, cellIndex) => {
            if (!showAdditionalColumns && cellIndex >= 10) return false;
            return cell.toLowerCase().includes(searchText);
        });
    });
    currentData = filteredData;
    const numResults = filteredData.length - 1;
    document.getElementById('search-results').textContent = `Search results: ${numResults}`;
    populateTable(filteredData, searchText, showAdditionalColumns);
}

// Function to toggle dark mode
function toggleDarkMode(on) {
    const body = document.body;
    if (on) {
        body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    } else {
        body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
    }
}

// Function to fetch data from a given URL and populate the table
function fetchData(url, showAdditionalColumns = false) {
    fetch(url)
        .then(response => response.text())
        .then(text => {
            csvData = parseCSV(text);
            currentData = csvData;
            populateTable(csvData, '', showAdditionalColumns);
        })
        .catch(error => console.error('Error fetching the CSV file:', error));
}

document.getElementById('dark-mode-toggle').addEventListener('click', function() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
});

// Check local storage for theme preference and apply it
document.addEventListener('DOMContentLoaded', (event) => {
    // Retrieve the preferred theme from local storage
    const preferredTheme = localStorage.getItem("theme");
    
    // Apply dark mode only if the stored theme is 'dark'
    const isDarkMode = preferredTheme === "dark";
    toggleDarkMode(isDarkMode);
});

document.addEventListener('DOMContentLoaded', function() {
    const searchBox = document.getElementById('searchBox');

    document.getElementById('sort-uploaded').addEventListener('click', () => {
        const sortedData = sortDataByUploaded(csvData);
        populateTable([csvData[0], ...sortedData]);
    });

    document.getElementById('sort-views').addEventListener('click', () => {
        const header = document.getElementById('sort-views');
        const isAscending = header.classList.contains('asc');
        
        header.classList.toggle('asc', !isAscending);
        header.classList.toggle('desc', isAscending);

        const sortedData = sortDataByViews(currentData, isAscending);
        populateTable([currentData[0], ...sortedData]);
    });

    searchBox.addEventListener('input', () => searchTable(csvData));

    document.querySelectorAll('.data-source-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const source = this.getAttribute('data-source');
            if (source === 'google-sheet') {
                fetchData(googleSheetURL, true);
                updateTableHeaders(true);
                searchBox.removeEventListener('input', handleSearchLocal);
                searchBox.addEventListener('input', handleSearchGoogleSheet);
            } else if (source === 'local-csv') {
                fetchData(localCSVURL, false);
                updateTableHeaders(false);
                searchBox.removeEventListener('input', handleSearchGoogleSheet);
                searchBox.addEventListener('input', handleSearchLocal);
            }
        });
    });

    const handleSearchGoogleSheet = () => searchTable(csvData, true);
    const handleSearchLocal = () => searchTable(csvData, false);

    // Initial fetch from the local CSV file
    fetchData(localCSVURL, false);
    searchBox.addEventListener('input', handleSearchLocal);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            applyFilter(this.getAttribute('data-filter'));
        });
    });

    fetch('info.yml')
        .then(response => response.text())
        .then(yamlText => {
            const yamlData = jsyaml.load(yamlText);
            const lastUpdatedTime = yamlData.last_updated_time;
            const formattedDateTime = lastUpdatedTime.replace(/(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})/, '$1 $2:$3');
            document.getElementById('last-updated').textContent += formattedDateTime;
        })
        .catch(error => console.error('Error fetching or parsing the YAML file:', error));
});

function applyFilter(filter) {
    document.getElementById('searchBox').value = filter;
    const isGoogleSheet = document.querySelector('.data-source-btn[data-source="google-sheet"]').classList.contains('active');
    searchTable(csvData, isGoogleSheet);
}

// Function to update table headers based on the selected data source
function updateTableHeaders(showAdditionalColumns) {
    const thead = document.getElementById('data-table').getElementsByTagName('thead')[0];
    thead.innerHTML = `
        <tr>
            <th>MC Name #1</th>
            <th>MC Name #2</th>
            <th>Event / Ort</th>
            <th>Type</th>
            <th>Year</th>
            <th>League</th>
            <th id="sort-uploaded">Uploaded</th>
            <th>URL</th>
            <th id="sort-views" title="Click to sort by views">Views</th>
            ${showAdditionalColumns ? '<th>Location</th><th>Stadt</th><th>Event</th>' : ''}
        </tr>`;
}
