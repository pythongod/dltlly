document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const searchBox = document.getElementById('searchBox');

    searchBox.addEventListener('input', () => searchTable(data));

    function parseCSV(text) {
        return text.split('\n').map(row => row.split(','));
    }

    function populateTable(data, searchText = '') {
        tableBody.innerHTML = '';
        data.forEach((row, index) => {
            if (index === 0) return; // Skip header row
                // Create data rows
                const tr = document.createElement('tr');
                row.forEach((cell, cellIndex) => {
                    const td = document.createElement('td');
                    if (searchText && cell.toLowerCase().includes(searchText.toLowerCase())) {
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
        const data = parseCSV(text);
        csvData = data; // Update the csvData variable with the loaded data
        populateTable(data); // Populate the table with initial data

        // Update the initial search results count
        const initialCount = data.length - 1; // Subtract 1 for the header row
        document.getElementById('search-results').textContent = `Search results: ${initialCount}`;
    })
    .catch(error => console.error('Error fetching the CSV file:', error));

    // Update the event listener to use csvData
    searchBox.addEventListener('input', () => searchTable(csvData));

});

