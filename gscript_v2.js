    let csvData = []; // Declare csvData to store the CSV data
    let currentData = []; // Data currently displayed (filtered or full dataset)
    let activeLeague = new URLSearchParams(location.search).get('league') || '';
    let importedData = [];
    // The premise is that your Google Sheet is published publicly. This is not intuitive for many folks. (Choose File -> Publish to Web...) Datei -> freigeben
    const googleSheetURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCSU0I6H0UdK-smWWr5t1X97dnYMst2HXJ10UFLEzwt0_EnfAwGlxHhhhRbVYsZNUV7O98tBi5_vZT/pub?gid=1245526804&single=true&output=csv';
    const localGsheetCSVURL = '/data/gsheet_battle_events_v2.csv';

    // Function to parse CSV text into a 2D array
    function parseCSV(text) {
        return BattleTable.parseCSV(text);
    }

    function populateTable(data, searchText = '') {
        try {
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
                    const rawValue = row[cellIndex] == null ? '' : String(row[cellIndex]);
                    let cellContent = rawValue;

                    if (cellIndex === 10) {
                        const parsedViews = parseInt(rawValue, 10);
                        cellContent = Number.isNaN(parsedViews) ? rawValue : parsedViews.toLocaleString();
                    }

                    if (cellIndex === 9) {
                        BattleTable.appendLink(td, cellContent, 'Link', true);
                    } else {
                        BattleTable.highlight(td, cellContent, searchText);
                    }

                    if (cellIndex === 2 && row.importedEvent) {
                        const note = document.createElement('small');
                        note.className = 'imported-event';
                        note.textContent = 'From video title';
                        td.appendChild(note);
                    }
                    tr.appendChild(td);
                });

                BattleTable.categoryBadge(row, data[0], tr.cells[5]);
                tableBody.appendChild(tr);
                BattleTable.labelCells(tr);
            });
            document.getElementById('search-results').textContent = `Search results: ${count}`;
            BattleTable.emptyState(count);
            addYouTubeThumbnails();
        }
        catch (error) {
            handleTableError(error);
        }
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
            return BattleTable.matches(row, searchText);
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

    // Function to fetch the latest Google Sheet data
    function fetchOnlineData() {
        return fetchData(googleSheetURL)
            .then(() => {
                console.log('Table updated with latest Google Sheets data.');
            })
            .catch(error => console.error('Failed to load Google Sheets data.', error));
    }

    function parseURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const searchParams = {};
        for (const [key, value] of urlParams) {
            searchParams[key] = value;
        }
        return searchParams;
    }

    function searchTableByColumn(data, columnSearches) {
        return data.filter((row, index) => {
            if (index === 0) return true; // Keep the header row
            return Object.entries(columnSearches).every(([column, searchText]) => {
                const columnIndex = data[0].findIndex(header => 
                    header && header.toLowerCase().trim() === column.toLowerCase().trim());
                if (columnIndex === -1) {
                    console.warn(`Column "${column}" not found. Ignoring this search criterion.`);
                    return true; // Column not found, ignore this search
                }
                return row[columnIndex] && row[columnIndex].toLowerCase().trim().includes(searchText.toLowerCase().trim());
            });
        });
    }

    function getColumnSearchesFromURL() {
        const params = parseURLParams();
        const headerRow = csvData[0] || [];
        const normalizedHeaders = headerRow.map(header =>
            header ? header.toLowerCase().trim() : ''
        );

        return Object.entries(params).reduce((acc, [key, value]) => {
            if (key.toLowerCase().trim() === 'search') {
                return acc;
            }
            const normalizedKey = key.toLowerCase().trim();
            if (normalizedHeaders.includes(normalizedKey)) {
                acc[key] = value;
            }
            return acc;
        }, {});
    }

    function getGlobalSearchFromURL() {
        const params = parseURLParams();
        return params.search || '';
    }

    function filterData(columnSearches, globalSearchTerm = '') {
        let filteredData = Object.keys(columnSearches).length > 0
            ? searchTableByColumn(csvData, columnSearches)
            : csvData;

        if (globalSearchTerm) {
            const normalizedTerm = globalSearchTerm.toLowerCase();
            filteredData = filteredData.filter((row, index) => {
                if (index === 0) return true;
                return BattleTable.matches(row, normalizedTerm);
            });
        }

        return BattleTable.filterFormats(BattleTable.filterCategory(BattleTable.filterLeague(filteredData, activeLeague)));
    }

    function applyFilters(globalSearchTerm = '') {
        const columnSearches = getColumnSearchesFromURL();
        const filteredData = BattleTable.sorted(filterData(columnSearches, globalSearchTerm));
        BattleTable.saveState(globalSearchTerm, activeLeague);
        currentData = filteredData;
        populateTable(filteredData, globalSearchTerm);
        updateUIWithAppliedFilters({
            ...columnSearches,
            ...(activeLeague ? { League: activeLeague } : {}),
            ...(BattleTable.onBeat ? { Format: 'On Beat' } : {}),
            ...(BattleTable.titleMatch ? { Match: 'Title match' } : {}),
            ...(globalSearchTerm ? { Global: globalSearchTerm } : {})
        });
    }

    function handleTableError(error) {
        console.error('Error populating table:', error);
        const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '<tr><td colspan="13">Error displaying data. Please try again later.</td></tr>';
    }

    // Reapply the active search and column filters after loading fresh data.
    function fetchData(url) {
        return fetch(url)
            .then(response => response.text())
            .then(text => {
                csvData = BattleTable.enrichCurated(parseCSV(text), importedData);
                console.log('CSV Headers:', csvData[0]);
                console.log('CSV Data loaded:', csvData.length, 'rows');
                applyFilters(document.getElementById('searchBox').value);
            })
            .catch(error => {
                console.error('Error fetching the CSV file:', error);
                document.getElementById('data-table').innerHTML = '<tr><td>Error loading data. Please try again later.</td></tr>';
            });
    }
    

    function updateUIWithAppliedFilters(filters) {
        const filterDisplay = document.getElementById('applied-filters');
        if (!filterDisplay) {
            return;
        }
        const activeFilters = Object.entries(filters).filter(([, value]) => value);
        if (activeFilters.length > 0) {
            filterDisplay.textContent = 'Applied Filters: ' + 
                activeFilters.map(([column, value]) => `${column}: ${value}`).join(', ');
            filterDisplay.style.display = 'block';
        } else {
            filterDisplay.textContent = '';
            filterDisplay.style.display = 'none';
        }
    }

    function createFilterDisplay() {
        const filterDisplay = document.createElement('div');
        filterDisplay.id = 'applied-filters';
        filterDisplay.style.marginBottom = '10px';
        document.querySelector('.info-container').appendChild(filterDisplay);
        return filterDisplay;
    }

    console.log('CSV Headers:', csvData[0]);



    document.getElementById('dark-mode-toggle').addEventListener('click', function() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    });

    // Combined DOMContentLoaded event listener
    document.addEventListener('DOMContentLoaded', function() {
        const searchBox = document.getElementById('searchBox');
        BattleTable.restoreControls();
        if (searchBox) {
            searchBox.value = getGlobalSearchFromURL();
            document.getElementById('content-category').addEventListener('change', () => applyFilters(searchBox.value));
            searchBox.addEventListener('input', () => {
                applyFilters(searchBox.value);
            });
        }

        // Ensure the applied-filters element exists
        if (!document.getElementById('applied-filters')) {
            const filterDisplay = document.createElement('div');
            filterDisplay.id = 'applied-filters';
            filterDisplay.className = 'info-text';
            document.querySelector('.info-container').insertBefore(filterDisplay, document.getElementById('search-results'));
        }
    
        BattleTable.bindSort(() => applyFilters(searchBox.value));
    
        // Initial fetch from the local Google Sheet CSV file
        fetch('/data/battle_events.csv')
            .then(response => {
                if (!response.ok) throw new Error('Metadata unavailable');
                return response.text();
            })
            .then(text => { importedData = parseCSV(text); })
            .catch(error => console.warn(error))
            .then(() => fetchData(localGsheetCSVURL));


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

        // Check local storage for theme preference and apply it
        const preferredTheme = localStorage.getItem("theme");
        toggleDarkMode(preferredTheme === "dark");

        // Ensure thumbnails are added after the table is populated
        addYouTubeThumbnails();
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
            activeLeague = '';
            searchBox.value = '';
            BattleTable.onBeat = false;
            BattleTable.titleMatch = false;
        } else if (column === 'Channel') {
            activeLeague = activeLeague === filter ? '' : filter;
        } else if (filter === 'On Beat') {
            BattleTable.onBeat = !BattleTable.onBeat;
        } else if (filter === '🏆') {
            BattleTable.titleMatch = !BattleTable.titleMatch;
        }
        applyFilters(searchBox.value);
    }
