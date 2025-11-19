const DATA_URL = '/data/battle_events.csv';
const MC1_INDEX = 0;
const MC2_INDEX = 1;
const EVENT_INDEX = 2;
const YEAR_INDEX = 4;
const LEAGUE_INDEX = 5;
const UPLOADED_INDEX = 6;
const URL_INDEX = 7;
const VIEWS_INDEX = 9;
const START_YEAR = 2010;

function parseCSV(text) {
    return text
        .trim()
        .split('\n')
        .map(row => row.split(','));
}

function formatNumber(num) {
    return num.toLocaleString();
}

function computeTopMCs(rows) {
    const totals = new Map();

    rows.forEach(row => {
        const views = parseInt(row[VIEWS_INDEX], 10);
        if (Number.isNaN(views)) {
            return;
        }
        [row[MC1_INDEX], row[MC2_INDEX]].forEach(name => {
            if (!name) {
                return;
            }
            const trimmed = name.trim();
            if (!trimmed) {
                return;
            }
            const entry = totals.get(trimmed) || { name: trimmed, views: 0, battles: 0 };
            entry.views += views;
            entry.battles += 1;
            totals.set(trimmed, entry);
        });
    });

    return Array.from(totals.values())
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
}

function computeYearlyTopBattles(rows) {
    const byYear = new Map();

    rows.forEach(row => {
        const year = parseInt(row[YEAR_INDEX], 10);
        const views = parseInt(row[VIEWS_INDEX], 10);
        if (Number.isNaN(year) || Number.isNaN(views) || year < START_YEAR) {
            return;
        }

        if (!byYear.has(year)) {
            byYear.set(year, []);
        }

        byYear.get(year).push({
            mc1: row[MC1_INDEX],
            mc2: row[MC2_INDEX],
            event: row[EVENT_INDEX],
            league: row[LEAGUE_INDEX],
            uploaded: row[UPLOADED_INDEX],
            url: row[URL_INDEX],
            views
        });
    });

    const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);

    return sortedYears.map(year => ({
        year,
        battles: byYear.get(year)
            .sort((a, b) => b.views - a.views)
            .slice(0, 10)
    }));
}

function renderTopMCs(mcs) {
    const tbody = document.getElementById('top-mc-body');
    tbody.innerHTML = '';

    if (!mcs.length) {
        tbody.innerHTML = '<tr><td colspan="4">No MC data available.</td></tr>';
        return;
    }

    mcs.forEach((mc, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${mc.name}</td>
            <td>${formatNumber(mc.views)}</td>
            <td>${mc.battles}</td>
        `;
        tbody.appendChild(tr);
    });
}

function createBattleRow(battle, rank) {
    const tr = document.createElement('tr');
    const matchup = `${battle.mc1} vs ${battle.mc2}`;
    tr.innerHTML = `
        <td>${rank}</td>
        <td>${matchup}</td>
        <td>${battle.event || ''}</td>
        <td>${battle.league || ''}</td>
        <td>${formatNumber(battle.views)}</td>
        <td class="battle-link"><a href="${battle.url}" target="_blank" rel="noopener">Watch</a></td>
    `;
    return tr;
}

function renderYearlyBattles(yearlyData) {
    const container = document.getElementById('yearly-sections');
    container.innerHTML = '';

    if (!yearlyData.length) {
        container.innerHTML = '<p>No battles available after 2010.</p>';
        return;
    }

    yearlyData.forEach(({ year, battles }) => {
        const section = document.createElement('div');
        section.className = 'year-section';

        const heading = document.createElement('h3');
        heading.textContent = year;
        section.appendChild(heading);

        if (!battles.length) {
            section.innerHTML += '<p>No battle data.</p>';
            container.appendChild(section);
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>#</th>
                <th>Matchup</th>
                <th>Event</th>
                <th>League</th>
                <th>Views</th>
                <th>Link</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        battles.forEach((battle, idx) => {
            tbody.appendChild(createBattleRow(battle, idx + 1));
        });
        table.appendChild(tbody);
        section.appendChild(table);
        container.appendChild(section);
    });
}

function handleError(message) {
    const mcBody = document.getElementById('top-mc-body');
    const yearlyContainer = document.getElementById('yearly-sections');
    mcBody.innerHTML = `<tr><td colspan="4">${message}</td></tr>`;
    yearlyContainer.innerHTML = `<p>${message}</p>`;
}

function init() {
    fetch(DATA_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load data');
            }
            return response.text();
        })
        .then(text => {
            const rows = parseCSV(text);
            if (!rows.length) {
                throw new Error('Battle data is empty');
            }
            const dataRows = rows.slice(1); // skip headers
            renderTopMCs(computeTopMCs(dataRows));
            renderYearlyBattles(computeYearlyTopBattles(dataRows));
        })
        .catch(err => {
            console.error(err);
            handleError('Unable to load battle data. Please try again later.');
        });
}

document.addEventListener('DOMContentLoaded', init);
