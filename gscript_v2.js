let csvData = []; // Declare csvData to store the CSV data
let currentData = []; // Data currently displayed (filtered or full dataset)
// The premise is that your Google Sheet is published publicly. This is not intuitive for many folks. (Choose File -> Publish to Web...) Datei -> freigeben
const googleSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCSU0I6H0UdK-smWWr5t1X97dnYMst2HXJ10UFLEzwt0_EnfAwGlxHhhhRbVYsZNUV7O98tBi5_vZT/pub?gid=1245526804&single=true&output=csv';
const localGsheetCSVURL = '/data/gsheet_battle_events_v2.csv';

// Function to parse CSV text into a 2D array
function parseCSV(text) {
    return text.split('\n').map(row => row.split(','));
}

function populateTable(data, searchText = '') {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    let count = 0; // Initialize a counter for the number of rows
    data.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        count++; // Increment count for each row
        const tr = document.createElement('tr');
        
        // Define the order of columns we want
        // Name #1,Name #2,Event,Location,Stadt,Type,Year,Channel,Uploaded,URL,Views,ID,hidden
        // 0 Name #1	1 Name #2	2 Event	3 Location	4 Stadt	5 Type	6 Year	7 Channel	8 Uploaded	9 URL	10 Views 11 ID 12 hidden
        const columnOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        
        columnOrder.forEach(cellIndex => {
            const td = document.createElement('td');
            let cellContent = row[cellIndex];

            // Special handling for Views column
            if (cellIndex === 10) {
                cellContent = parseInt(cellContent).toLocaleString();
            }

            // Special handling for URL column
            if (cellIndex === 9) {
                // console.log("URL content:", cellContent);
                const URLtext = 'Link';
                // console.log("Setting link text to:", URLtext);
                td.innerHTML = `<a href="${cellContent}" target="_blank" class="tooltip">${URLtext}<div class="tooltiptext"></div></a>`;
                // console.log("Resulting innerHTML:", td.innerHTML);
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
    setTimeout(() => {
        addYouTubeThumbnails();
    }, 10);
}

// Function to sort data by uploaded date
function sortDataByUploaded(data) {
    return data.slice(1).sort((a, b) => {
        if (!a[8] || !b[8]) {
            return !a[8] ? 1 : -1;
        }
        const datePattern = /(\d{4}-\d{1,2}-\d{1,2})/;
        const dateStringA = (a[8].match(datePattern) || [])[1];
        const dateStringB = (b[8].match(datePattern) || [])[1];
        const dateA = dateStringA ? new Date(dateStringA) : new Date(0);
        const dateB = dateStringB ? new Date(dateStringB) : new Date(0);
        return dateB - dateA;
    });
}

// Function to sort data by views
function sortDataByViews(data, isAscending) {
    return data.slice(1).sort((a, b) => {
        const viewsA = parseInt(a[10]);
        const viewsB = parseInt(b[10]);

        return isAscending ? viewsA - viewsB : viewsB - viewsA; // For ascending or descending order
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
    body.classList.toggle("dark-mode", on);
    localStorage.setItem("theme", on ? "dark" : "light");
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

function parseURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParams = {};
    for (const [key, value] of urlParams) {
        searchParams[key.toLowerCase()] = value;
    }
    return searchParams;
}

function searchTableByColumn(data, columnSearches) {
    return data.filter((row, index) => {
        if (index === 0) return true; // Keep the header row
        return Object.entries(columnSearches).every(([column, searchText]) => {
            const columnIndex = data[0].findIndex(header => 
                header.toLowerCase() === column.toLowerCase());
            if (columnIndex === -1) {
                console.warn(`Column "${column}" not found. Ignoring this search criterion.`);
                return true; // Column not found, ignore this search
            }
            return row[columnIndex].toLowerCase().includes(searchText.toLowerCase());
        });
    });
}

function updateUIWithAppliedFilters(filters) {
    const filterDisplay = document.getElementById('applied-filters') || createFilterDisplay();
    filterDisplay.innerHTML = 'Applied Filters: ' + 
        Object.entries(filters).map(([column, value]) => `${column}: ${value}`).join(', ');
}

function createFilterDisplay() {
    const filterDisplay = document.createElement('div');
    filterDisplay.id = 'applied-filters';
    filterDisplay.style.marginBottom = '10px';
    document.querySelector('.info-container').appendChild(filterDisplay);
    return filterDisplay;
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

    const searchParams = parseURLParams();
    if (Object.keys(searchParams).length > 0) {
        const filteredData = searchTableByColumn(csvData, searchParams);
        populateTable(filteredData);
        // Update the search box to reflect the search
        const searchBox = document.getElementById('searchBox');
        searchBox.value = Object.values(searchParams).join(' ');
        // Trigger the search
        searchTable(csvData, searchBox.value);
        // Update UI with applied filters
        updateUIWithAppliedFilters(searchParams);
    }
    // Modify your existing search event listener to combine global and column-specific search
    searchBox.addEventListener('input', () => {
        const globalSearchTerm = searchBox.value;
        const columnSearches = parseURLParams();
        let filteredData = searchTableByColumn(csvData, columnSearches);
        filteredData = filteredData.filter(row => 
            row.some(cell => cell.toLowerCase().includes(globalSearchTerm.toLowerCase()))
        );
        populateTable(filteredData);
        updateUIWithAppliedFilters({...columnSearches, 'Global': globalSearchTerm});
    });

    document.getElementById('sort-views').addEventListener('click', () => {
        const header = document.getElementById('sort-views');
        const isAscending = header.classList.contains('asc');
        
        header.classList.toggle('asc', !isAscending);
        header.classList.toggle('desc', isAscending);

        const sortedData = sortDataByViews(currentData, isAscending);
        populateTable([currentData[0], ...sortedData]);
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
    toggleDarkMode(preferredTheme === "dark");

    // Ensure thumbnails are added after the table is populated
    addYouTubeThumbnails();
});

// Function to add YouTube thumbnails on hover
function addYouTubeThumbnails() {
    document.querySelector('#data-table').addEventListener('mouseover', function(event) {
        const link = event.target.closest('a.tooltip[href*="youtube.com/watch"]');
        if (!link) return;

        if (link.dataset.thumbnailAdded) return;
        link.dataset.thumbnailAdded = 'true';

        const tooltip = link.querySelector('.tooltiptext');
        if (!tooltip) {
            console.error('Tooltip element not found or incorrect for link:', link);
            return;
        }

        link.addEventListener('mouseenter', function() {
            const videoId = new URLSearchParams(new URL(this.href).search).get('v');
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            
            const img = new Image();
            img.onload = function() {
                // console.log('Thumbnail loaded');
                tooltip.innerHTML = `<img src="${thumbnailUrl}" alt="Video Thumbnail" style="width: 100%; height: auto;">`;
            };
            img.onerror = function() {
                console.log('Thumbnail load failed, trying hqdefault');
                // Fallback to hqdefault if maxresdefault is not available
                const fallbackUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                tooltip.innerHTML = `<img src="${fallbackUrl}" alt="Video Thumbnail" style="width: 100%; height: auto;">`;
            };
            img.src = thumbnailUrl;
        });

        link.addEventListener('mouseleave', function() {
            this.querySelector('.tooltiptext').innerHTML = '';
        });
    });
}


function applyFilter(filter) {
    document.getElementById('searchBox').value = filter;
    searchTable(csvData, filter);
}