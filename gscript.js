let csvData = []; // Declare csvData to store the CSV data
let currentData = []; // Data currently displayed (filtered or full dataset)
const googleSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTQCuvOmXn1mJTpP8Xsxs_hQGuGvKgWuvbb_ZwvuM2rCb0hBmNUOEKiyk25-hy5ljG-4tCuLqVwrRx/pub?gid=1245526804&single=true&output=csv';
const localGsheetCSVURL = '/data/gsheet_battle_events.csv';

// Function to parse CSV text into a 2D array
function parseCSV(text) {
    return text.split('\n').map(row => row.split(','));
}

// Function to populate the table with data
function populateTable(data, searchText = '') {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    let count = 0; // Initialize a counter for the number of rows
    data.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        count++; // Increment count for each row
        const tr = document.createElement('tr');
        
        // Define the order of columns we want
        const columnOrder = [0, 1, 12, 10, 11, 3, 4, 5, 6, 7, 9];
        
        columnOrder.forEach(cellIndex => {
            const td = document.createElement('td');
            let cellContent = row[cellIndex];

            // Special handling for Views column
            if (cellIndex === 9) {
                cellContent = parseInt(cellContent).toLocaleString();
            }

            // Special handling for URL column
            if (cellIndex === 7) {
                const URLtext = 'Link';
                td.innerHTML = `<a href="${cellContent}" target="_blank" class="tooltip">${URLtext}<div class="tooltiptext"></div></a>`;
            } else if (searchText && cellContent.toLowerCase().includes(searchText.toLowerCase())) {
                td.innerHTML = cellContent.replace(new RegExp(searchText, 'gi'), match => `<span class="highlight">${match}</span>`);
            } else {
                td.textContent = cellContent;
            }

            tr.appendChild(td);
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
function searchTable(data, searchText) {
    const filteredData = data.filter((row, index) => {
        if (index === 0) return true;
        return row.some(cell => cell.toLowerCase().includes(searchText.toLowerCase()));
    });
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
function fetchData(url, searchText = '') {
    return fetch(url)
        .then(response => response.text())
        .then(text => {
            csvData = parseCSV(text);
            currentData = csvData;
            if (searchText) {
                searchTable(csvData, searchText);
            } else {
                populateTable(csvData, searchText);
            }
        })
        .catch(error => console.error('Error fetching the CSV file:', error));
}

// Function to fetch the latest Google Sheet data
function fetchOnlineData() {
    fetchData(googleSheetURL)
        .then(() => {
            populateTable(csvData);
            console.log('Table updated with latest Google Sheets data.');
        })
        .catch(error => console.error('Failed to load Google Sheets data.', error));
}

document.getElementById('dark-mode-toggle').addEventListener('click', function() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
});

// Combined DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    const searchBox = document.getElementById('searchBox');
    const searchText = getUrlParameter('search') || '';

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
        searchTable(csvData, searchBox.value);
    });

    // Initial fetch from the local Google Sheet CSV file
    fetchData(localGsheetCSVURL, searchText);

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

    // Check local storage for theme preference and apply it
    const preferredTheme = localStorage.getItem("theme");
    const isDarkMode = preferredTheme === "dark";
    toggleDarkMode(isDarkMode);
});

// Function to add YouTube thumbnails on hover
function addYouTubeThumbnails() {
    document.querySelector('#data-table').addEventListener('mouseover', function(event) {
        const link = event.target.closest('a.tooltip[href*="youtube.com/watch"]');
        if (!link) return;

        const tooltip = link.nextElementSibling;
        if (!tooltip || !tooltip.classList.contains('tooltiptext')) {
            console.error('Tooltip element not found or incorrect');
            return;
        }

        link.addEventListener('mouseenter', function() {
            const videoId = new URLSearchParams(new URL(this.href).search).get('v');
            if (videoId) {
                const thumbnailQualities = [
                    'maxresdefault.jpg',
                    'sddefault.jpg',
                    'hqdefault.jpg',
                    'mqdefault.jpg',
                    'default.jpg'
                ];

                tooltip.innerHTML = '<div class="loading">Loading thumbnail...</div>';

                function tryNextThumbnail(index = 0) {
                    if (index >= thumbnailQualities.length) {
                        console.warn('No thumbnail found for video:', videoId);
                        tooltip.innerHTML = 'Thumbnail not available';
                        return;
                    }

                    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${thumbnailQualities[index]}`;
                    const img = new Image();
                    img.onload = function() {
                        tooltip.innerHTML = `<img src="${thumbnailUrl}" alt="Video Thumbnail" style="width: 100%;">`;
                    };
                    img.onerror = function() {
                        tryNextThumbnail(index + 1);
                    };
                    img.src = thumbnailUrl;
                }

                tryNextThumbnail();
            }
        });

        link.addEventListener('mouseleave', function() {
            tooltip.innerHTML = ''; // Clear the tooltip content
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Ensure thumbnails are added after the table is populated
    addYouTubeThumbnails();
});


function applyFilter(filter) {
    document.getElementById('searchBox').value = filter;
    searchTable(csvData, filter);
}