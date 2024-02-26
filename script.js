let csvData = []; // Declare csvData to store the CSV data
let currentData = []; // Data currently displayed (filtered or full dataset)


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
        row.forEach((cell, cellIndex) => {
            const td = document.createElement('td');

            if (cellIndex === 7) { // Format 'Views' column
                td.textContent = parseInt(cell).toLocaleString();
            } else if (searchText && cell.toLowerCase().includes(searchText.toLowerCase())) {
                td.innerHTML = cell.replace(new RegExp(searchText, 'gi'), match => `<span class="highlight">${match}</span>`);
            } else {
                td.textContent = cell;
            }

            if (cellIndex === 5) { // Link for 'League' column
                const searchQuery = `${row[0]} ${row[1]} ${row[2]} ${cell}`;
                const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
                td.innerHTML = `<a href="${youtubeUrl}" target="_blank">${cell}</a>`;
            }

            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
    document.getElementById('search-results').textContent = `Search results: ${count}`;
}

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

function sortDataByViews(data, isAscending) {
    return data.slice(1).sort((a, b) => {
        const viewsA = parseInt(a[7]);
        const viewsB = parseInt(b[7]);

        if (isAscending) {
            return viewsA - viewsB; // For ascending order
        } else {
            return viewsB - viewsA; // For descending order
        }
    });
}


function searchTable(data) {
    const searchText = document.getElementById('searchBox').value.toLowerCase();
    const filteredData = data.filter((row, index) => {
        if (index === 0) return true;
        return row.some(cell => cell.toLowerCase().includes(searchText));
    });
    currentData = filteredData;
    const numResults = filteredData.length - 1;
    document.getElementById('search-results').textContent = `Search results: ${numResults}`;
    populateTable(filteredData, searchText);
}

// Function to toggle dark mode
function toggleDarkMode(on) {
    const body = document.body;
    if(on) {
        body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    } else {
        body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
    }
}

document.getElementById('dark-mode-toggle').addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
});


// Event listeners for the theme toggle buttons
document.getElementById('dark-mode-btn').addEventListener('click', () => toggleDarkMode(true));
document.getElementById('light-mode-btn').addEventListener('click', () => toggleDarkMode(false));

// Check local storage for theme preference and apply it
document.addEventListener('DOMContentLoaded', (event) => {
    const preferredTheme = localStorage.getItem("theme");
    toggleDarkMode(preferredTheme === "dark");
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

    fetch('battle_events.csv')
        .then(response => response.text())
        .then(text => {
            csvData = parseCSV(text);
            currentData = csvData; 
            populateTable(csvData);
        })
        .catch(error => console.error('Error fetching the CSV file:', error));

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
    searchTable(csvData);
}
