document.addEventListener('DOMContentLoaded', function() {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    const searchBox = document.getElementById('searchBox');

    function parseCSV(text) {
        return text.split('\n').map(row => row.split(','));
    }

    function populateTable(data) {
        tableBody.innerHTML = '';
        data.forEach((row, index) => {
            if (index === 0) return; // Skip header row
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
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
        populateTable(filteredData);
    }

    //fetch('data.csv')
    fetch('battle_events.csv')
        .then(response => response.text())
        .then(text => {
            const data = parseCSV(text);
            populateTable(data);

            searchBox.addEventListener('keyup', () => searchTable(data));
        })
        .catch(error => console.error('Error fetching the CSV file:', error));
});

