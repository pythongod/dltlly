document.addEventListener('DOMContentLoaded', function() {
    let csvData = []; // Declare csvData to store the CSV data
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const searchBox = document.getElementById('searchBox');

    function parseCSV(text) {
        return text.split('\n').map(row => row.split(','));
    }

    document.getElementById('sort-uploaded').addEventListener('click', () => {
        const sortedData = sortDataByUploaded(csvData); // Use csvData
        populateTable([csvData[0], ...sortedData]); // Re-populate the table with sorted data
    });

    document.getElementById('sort-views').addEventListener('click', () => {
        const sortedData = sortDataByViews(csvData); // Assuming csvData holds your table data
        populateTable([csvData[0], ...sortedData]); // Re-populate the table with sorted data
    });
    


    function populateTable(data, searchText = '') {
        tableBody.innerHTML = '';
        data.forEach((row, index) => {
            if (index === 0) return; // Skip header row
    
            const tr = document.createElement('tr');
            row.forEach((cell, cellIndex) => {
                const td = document.createElement('td');
    
                // Format views
                if (cellIndex === 7) { // Assuming 'Views' is the 8th column (index 7)
                    td.textContent = parseInt(cell).toLocaleString();
                } else if (searchText && cell.toLowerCase().includes(searchText.toLowerCase())) {
                    td.innerHTML = cell.replace(new RegExp(searchText, 'gi'), match => `<span class="highlight">${match}</span>`);
                } else {
                    td.textContent = cell;
                }
    
                    // Check if the cell is for the League column
                    if (cellIndex === 5) { // Assuming league is in the 6th column (index 5)
                        const searchQuery = `${row[0]} ${row[1]} ${row[2]} ${cell}`; // Name #1, Name #2, Event, League
                        const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
                        td.innerHTML = `<a href="${youtubeUrl}" target="_blank">${cell}</a>`;
                    }
    
                    tr.appendChild(td);
                });
                tableBody.appendChild(tr);
        });
    }
    
    function sortDataByUploaded(data) {
        // Assuming the 'Uploaded' column is the last one
        return data.slice(1).sort((a, b) => {
            // Extract dates from the 'Uploaded' column (last column in each row)
            const datePattern = /(\d{4}-\d{1,2}-\d{1,2})/;
            const dateStringA = (a[a.length - 1].match(datePattern) || [])[1];
            const dateStringB = (b[b.length - 1].match(datePattern) || [])[1];
    
            // Parse the dates
            const dateA = dateStringA ? new Date(dateStringA) : new Date(0); // Fallback to epoch date if invalid
            const dateB = dateStringB ? new Date(dateStringB) : new Date(0); // Fallback to epoch date if invalid
    
            // Compare the dates
            return dateB - dateA;
        });
    }

    function sortDataByViews(data) {
        // Assuming the 'Views' column is the 8th one
        return data.slice(1).sort((a, b) => {
            const viewsA = parseInt(a[7]);
            const viewsB = parseInt(b[7]);
            return viewsB - viewsA;
        });
    }
    

    function searchTable(data) {
        const searchText = searchBox.value.toLowerCase();
        const filteredData = data.filter((row, index) => {
            if (index === 0) return true; // Always include header row
            return row.some(cell => cell.toLowerCase().includes(searchText));
        });
    
        // Update the number of search results
        const numResults = filteredData.length - 1; // Subtract 1 for header row
        document.getElementById('search-results').textContent = `Search results: ${numResults}`;
    
        populateTable(filteredData, searchBox.value); // Pass the current search text
    }

    //fetch('data.csv')
    fetch('battle_events.csv')
    .then(response => response.text())
    .then(text => {
        csvData = parseCSV(text); // Update csvData with the parsed data
        populateTable(csvData); // Populate the table with initial data

        // Update the initial search results count
        const initialCount = csvData.length - 1; // Use csvData for count
        document.getElementById('search-results').textContent = `Search results: ${initialCount}`;
    })
    .catch(error => console.error('Error fetching the CSV file:', error));

    searchBox.addEventListener('input', () => searchTable(csvData)); // Corrected event listener
});

