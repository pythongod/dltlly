let csvData = []; // Declare csvData to store the CSV data
let currentData = []; // Data currently displayed (filtered or full dataset)
let activeLeague = new URLSearchParams(location.search).get('league') || '';
const localCSVURL = '/data/battle_events.csv';

// Function to parse CSV text into a 2D array
function parseCSV(text) {
    return BattleTable.parseCSV(text);
}

// 0 Name #1, 1 Name #2,2 Event,3 Type, 4Year, 5 Channel, 6 Uploaded, 7 URL, 8 ID, 9 Views
// Function to populate the table with data
function populateTable(data, searchText = '') {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    let count = 0; // Initialize a counter for the number of rows
    data.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        count++; // Increment count for each row
        const tr = document.createElement('tr');
        row.slice(0, 10).forEach((cell, cellIndex) => {
            if (cellIndex === 8) return; // Skip the ID column

            const td = document.createElement('td');
            const cellValue = cell == null ? '' : String(cell);

            if (cellIndex === 7) { // Correct this if the indices shift due to column removal
                BattleTable.appendLink(td, row[7], 'Link', true);
            } else if (cellIndex === 9) { // Views column
                const parsedViews = parseInt(cellValue, 10);
                td.textContent = Number.isNaN(parsedViews) ? cellValue : parsedViews.toLocaleString();
            } else {
                BattleTable.highlight(td, cellValue, searchText);
            }

            tr.appendChild(td);
        });
        BattleTable.categoryBadge(row, data[0], tr.cells[3]);
        tableBody.appendChild(tr);
        BattleTable.labelCells(tr);
    });
    document.getElementById('search-results').textContent = `Search results: ${count}`;
    BattleTable.emptyState(count);
    addYouTubeThumbnails(); // Add YouTube thumbnails after populating the table
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
function searchTable(data, searchText) {
    let filteredData = BattleTable.filterCategory(BattleTable.filterLeague(data, activeLeague)).filter((row, index) => {
        if (index === 0) return true;
        return BattleTable.matches(row, searchText);
    });
    filteredData = BattleTable.sorted(filteredData);
    BattleTable.saveState(searchText, activeLeague);
    currentData = filteredData;
    const numResults = filteredData.length - 1;
    document.getElementById('search-results').textContent = `Search results: ${numResults}`;
    populateTable(filteredData, searchText);
}

// Function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
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
function fetchData(url, searchText = '', updateTable = true) {
    return fetch(url)
        .then(response => response.text())
        .then(text => {
            const data = parseCSV(text);
            if (data.length > 1) {
                csvData = data;
                currentData = data;
                if (updateTable) {
                    searchTable(data, document.getElementById('searchBox').value);
                }
            } else {
                throw new Error('No data found');
            }
        })
        .catch(error => {
            console.error('Error fetching the CSV file:', error);
            throw error;
        });
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
    BattleTable.restoreControls();
    const searchText = getUrlParameter('search') || '';
    const initialSource = getUrlParameter('source') || 'local-csv';

    BattleTable.bindSort(() => searchTable(csvData, searchBox.value));

    document.querySelectorAll('.data-source-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const source = this.getAttribute('data-source');
            if (source === 'local-csv') {
                fetchData(localCSVURL, searchText)
                    .catch(() => console.error('Failed to load local CSV data.'));
            }
            document.querySelectorAll('.data-source-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const handleSearchLocal = () => searchTable(csvData, searchBox.value);
    document.getElementById('content-category').addEventListener('change', handleSearchLocal);

    // Initial fetch from the local CSV file based on the default or URL parameter
    fetchData(localCSVURL, searchText)
        .then(() => searchBox.addEventListener('input', handleSearchLocal))
        .catch(() => console.error('Failed to load local CSV data.'));

    searchBox.value = searchText;

    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', function() {
            applyFilter(this.getAttribute('data-filter'), this.getAttribute('data-filter-column'));
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

// Function to add YouTube thumbnails on hover
function addYouTubeThumbnails() {
    BattleTable.addThumbnails(document.getElementById('data-table'));
}

function applyFilter(filter, column) {
    const searchBox = document.getElementById('searchBox');
    if (!filter) {
        history.replaceState(null, '', location.pathname);
        document.getElementById('content-category').value = 'battle';
        document.getElementById('sort-order').value = 'uploaded';
    }
    if (column === 'Channel') {
        activeLeague = filter;
    } else {
        activeLeague = '';
        searchBox.value = filter;
    }
    searchTable(csvData, searchBox.value);
}
