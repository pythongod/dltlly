let csvData = []; // Declare csvData to store the CSV data
let currentData = []; // Data currently displayed (filtered or full dataset)
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
                td.innerHTML = `<a href="${URL}" target="_blank" class="tooltip">${URLtext}<div class="tooltiptext"></div></a>`;
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
function searchTable(data, searchText, showAdditionalColumns = false) {
    const filteredData = data.filter((row, index) => {
        if (index === 0) return true;
        return row.some((cell, cellIndex) => {
            return cell.toLowerCase().includes(searchText.toLowerCase());
        });
    });
    currentData = filteredData;
    const numResults = filteredData.length - 1;
    document.getElementById('search-results').textContent = `Search results: ${numResults}`;
    populateTable(filteredData, searchText, showAdditionalColumns);
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
function fetchData(url, showAdditionalColumns = false, searchText = '', updateTable = true) {
    return fetch(url)
        .then(response => response.text())
        .then(text => {
            const data = parseCSV(text);
            if (data.length > 1) {
                csvData = data;
                currentData = data;
                if (updateTable) {
                    if (searchText) {
                        searchTable(data, searchText, showAdditionalColumns);
                    } else {
                        populateTable(data, '', showAdditionalColumns);
                    }
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
    const searchText = getUrlParameter('search') || '';
    const initialSource = getUrlParameter('source') || 'local-csv';

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

    searchBox.addEventListener('input', () => {
        searchTable(csvData, searchBox.value, false);
    });

    document.querySelectorAll('.data-source-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const source = this.getAttribute('data-source');
            if (source === 'local-csv') {
                fetchData(localCSVURL, false, searchText)
                    .then(() => updateTableHeaders(false))
                    .catch(() => console.error('Failed to load local CSV data.'));
            }
            document.querySelectorAll('.data-source-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    const handleSearchLocal = () => searchTable(csvData, searchBox.value, false);

    // Update table headers before fetching data
    updateTableHeaders(false);

    // Initial fetch from the local CSV file based on the default or URL parameter
    fetchData(localCSVURL, false, searchText)
        .then(() => searchBox.addEventListener('input', handleSearchLocal))
        .catch(() => console.error('Failed to load local CSV data.'));

    document.querySelector(`.data-source-btn[data-source="${initialSource}"]`).classList.add('active');
    searchBox.value = searchText;

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

// Function to add YouTube thumbnails on hover
function addYouTubeThumbnails() {
    const youtubeLinks = document.querySelectorAll('td a[href*="youtube.com/watch"]');

    youtubeLinks.forEach(link => {
        const tooltip = link.querySelector('.tooltiptext');

        link.addEventListener('mouseover', function() {
            const videoId = new URLSearchParams(new URL(link.href).search).get('v');
            if (videoId) {
                const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                tooltip.innerHTML = `<img src="${thumbnailUrl}" alt="Thumbnail" style="width: 100%;">`;
            }
        });

        link.addEventListener('mouseleave', function() {
            tooltip.innerHTML = ''; // Clear the tooltip content
        });
    });
}

function applyFilter(filter) {
    document.getElementById('searchBox').value = filter;
    searchTable(csvData, filter, false);
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
        </tr>`;
}
