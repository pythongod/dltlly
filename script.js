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
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                if (searchText && cell.toLowerCase().includes(searchText.toLowerCase())) {
                    td.innerHTML = cell.replace(new RegExp(searchText, 'gi'), match => `<span class="highlight">${match}</span>`);
                } else {
                    td.textContent = cell;
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

