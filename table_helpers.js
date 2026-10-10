// Imported CSV values must stay text, including search highlights and URLs.
const BattleTable = {
    onBeat: new URLSearchParams(location.search).get('onBeat') === '1',
    titleMatch: new URLSearchParams(location.search).get('titleMatch') === '1',

    filterFormats(data) {
        const headers = data[0] || [];
        return data.filter((row, index) => index === 0 ||
            (!this.onBeat || /\bon[\s-]*beat\b/i.test(String(row[headers.indexOf('Type')] || ''))) &&
            (!this.titleMatch || /🏆|\btitle[\s-]*match\b/i.test(String(row[headers.indexOf('Event')] || ''))));
    },
    restoreControls() {
        const params = new URLSearchParams(location.search);
        const category = document.getElementById('content-category');
        if (category && ['battle','faceoff','interview','promo','other','all'].includes(params.get('category'))) category.value = params.get('category');
        const sort = document.getElementById('sort-order');
        if (sort && ['uploaded','views-desc','views-asc'].includes(params.get('sort'))) sort.value = params.get('sort');
    },

    saveState(search, league) {
        const url = new URL(location.href);
        const values = {search, league, onBeat: this.onBeat ? '1' : '', titleMatch: this.titleMatch ? '1' : '', category: document.getElementById('content-category').value, sort: document.getElementById('sort-order').value};
        for (const [key, value] of Object.entries(values)) {
            if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
        }
        history.replaceState(null, '', url);
        document.querySelectorAll('a[data-navigation]').forEach(link => {
            link.href = this.navigationURL(link.dataset.navigation);
        });
        document.querySelectorAll('[data-filter]').forEach(button => {
            if (button.dataset.filter === 'On Beat') button.setAttribute('aria-pressed', String(this.onBeat));
            if (button.dataset.filter === '🏆') button.setAttribute('aria-pressed', String(this.titleMatch));
        });
        document.querySelectorAll('[data-filter-column="Channel"]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.filter === league));
        });
    },

    sorted(data) {
        const sort = document.getElementById('sort-order')?.value || 'uploaded';
        const column = data[0]?.indexOf(sort === 'uploaded' ? 'Uploaded' : 'Views');
        return [data[0], ...data.slice(1).sort((a, b) => {
            if (sort === 'uploaded') return String(b[column] || '').localeCompare(String(a[column] || ''));
            const x = Number.parseInt(a[column], 10), y = Number.parseInt(b[column], 10);
            if (!Number.isFinite(x)) return Number.isFinite(y) ? 1 : 0;
            if (!Number.isFinite(y)) return -1;
            return sort === 'views-asc' ? x-y : y-x;
        })];
    },

    navigationURL(page) {
        const url = new URL(page, location.href);
        url.search = location.search;
        if (['most_viewed.html','subpage.html'].includes(page)) {
            url.searchParams.set('returnTo', location.pathname.endsWith('gindex_v2.html') ? 'gindex_v2.html' : 'index.html');
        } else url.searchParams.delete('returnTo');
        return url.href;
    },

    navigate(page) { location.href = this.navigationURL(page); },

    returnToDatabase() {
        const params = new URLSearchParams(location.search);
        this.navigate(params.get('returnTo') === 'gindex_v2.html' ? 'gindex_v2.html' : 'index.html');
    },

    bindSort(refresh) {
        const select = document.getElementById('sort-order');
        select.addEventListener('change', refresh);
        document.getElementById('sort-uploaded').addEventListener('click', () => { select.value = 'uploaded'; refresh(); });
        document.getElementById('sort-views').addEventListener('click', () => { select.value = select.value === 'views-desc' ? 'views-asc' : 'views-desc'; refresh(); });
    },

    category(row, headers) {
        const value = String(row[headers.indexOf('Content category')] || '').trim().toLowerCase();
        const event = String(row[headers.indexOf('Event')] || '');
        // Old imports called face-offs battles. Correct the displayed category only.
        if (!['interview', 'promo', 'other', 'faceoff'].includes(value) && /\bface[\s‐‑–-]*off\b/i.test(event)) return 'faceoff';
        if (['battle', 'faceoff', 'interview', 'promo', 'other'].includes(value)) return value;
        if (/\b(teaser|promo|trailer)\b/i.test(event)) return 'promo';
        if (/\binterview\b/i.test(event) && !/(?:\+|&|\band\b|\bund\b)\s*interview\b/i.test(event)) return 'interview';
        return 'battle';
    },

    filterCategory(data) {
        const selected = document.getElementById('content-category')?.value || 'all';
        return data.filter((row, index) => index === 0 || selected === 'all' || this.category(row, data[0]) === selected);
    },

    categoryBadge(row, headers, target) {
        const badge = document.createElement('span');
        badge.className = 'content-badge';
        const category = this.category(row, headers);
        badge.textContent = category === 'faceoff' ? 'Face-off' : category[0].toUpperCase() + category.slice(1);
        target.appendChild(badge);
    },

    enrichCurated(data, imported) {
        if (!data.length || !imported.length) return data;
        const headers = [...data[0]];
        let categoryIndex = headers.indexOf('Content category');
        if (categoryIndex < 0) categoryIndex = headers.push('Content category') - 1;
        const importedById = new Map(imported.slice(1).filter(row => row[imported[0].indexOf('ID')]).map(row => [row[imported[0].indexOf('ID')], row]));
        return [headers, ...data.slice(1).map(original => {
            const row = [...original];
            const source = importedById.get(row[headers.indexOf('ID')]);
            if (!row[categoryIndex] && source) row[categoryIndex] = this.category(source, imported[0]);
            const eventIndex = headers.indexOf('Event');
            if (eventIndex >= 0 && !String(row[eventIndex] || '').trim() && source) {
                row[eventIndex] = source[imported[0].indexOf('Event')] || '';
                row.importedEvent = Boolean(row[eventIndex]);
            }
            return row;
        })];
    },

    matches(row, query) {
        const terms = String(query).toLowerCase().split(/\s+/).filter(term => term && !/^vs\.?$/.test(term));
        return terms.every(term => row.some(cell => String(cell ?? '').toLowerCase().includes(term)));
    },

    emptyState(count) {
        const notice = document.getElementById('empty-results');
        if (notice) notice.hidden = count !== 0;
    },

    labelCells(row) {
        const headers = document.querySelectorAll('#data-table th');
        [...row.cells].forEach((cell, index) => {
            cell.dataset.label = headers[index]?.textContent || '';
        });
    },

    parseCSV(text) {
        const rows = [];
        let row = [];
        let cell = '';
        let quoted = false;
        const source = String(text).replace(/^\uFEFF/, '');
        const finishRow = () => {
            row.push(cell);
            if (row.some(value => value.trim())) rows.push(row);
            row = [];
            cell = '';
        };
        for (let index = 0; index < source.length; index++) {
            const char = source[index];
            if (quoted) {
                if (char === '"' && source[index + 1] === '"') {
                    cell += '"';
                    index++;
                } else if (char === '"') {
                    quoted = false;
                } else {
                    cell += char;
                }
            } else if (char === '"' && cell === '') {
                quoted = true;
            } else if (char === ',') {
                row.push(cell);
                cell = '';
            } else if (char === '\r' || char === '\n') {
                finishRow();
                if (char === '\r' && source[index + 1] === '\n') index++;
            } else {
                cell += char;
            }
        }
        finishRow();
        return rows;
    },

    highlight(element, value, searchText = '') {
        const text = String(value ?? '');
        if (!searchText) {
            element.textContent = text;
            return;
        }
        const pattern = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let offset = 0;
        for (const match of text.matchAll(pattern)) {
            element.appendChild(document.createTextNode(text.slice(offset, match.index)));
            const span = document.createElement('span');
            span.className = 'highlight';
            span.textContent = match[0];
            element.appendChild(span);
            offset = match.index + match[0].length;
        }
        element.appendChild(document.createTextNode(text.slice(offset)));
    },

    appendLink(element, value, label = 'Link', tooltip = false) {
        let url;
        try {
            url = new URL(value);
        } catch {
            return;
        }
        if (url.protocol !== 'https:') return;
        const link = document.createElement('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label;
        if (tooltip) {
            link.className = 'tooltip';
            const preview = document.createElement('div');
            preview.className = 'tooltiptext';
            link.appendChild(preview);
        }
        element.appendChild(link);
    },

    addThumbnails(table) {
        if (table.dataset.thumbnailsBound) return;
        table.dataset.thumbnailsBound = 'true';
        table.addEventListener('mouseover', event => {
            const link = event.target.closest('a.tooltip');
            if (!link || !table.contains(link)) return;
            const tooltip = link.querySelector('.tooltiptext');
            if (!tooltip || tooltip.childElementCount) return;
            const url = new URL(link.href);
            if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) return;
            const videoId = url.searchParams.get('v') || '';
            if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;
            const image = document.createElement('img');
            image.alt = 'Video Thumbnail';
            image.style.width = '100%';
            image.style.height = 'auto';
            image.onerror = () => {
                image.onerror = null;
                image.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            };
            image.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            tooltip.replaceChildren(image);
        });
        table.addEventListener('mouseout', event => {
            const link = event.target.closest('a.tooltip');
            if (link && !link.contains(event.relatedTarget)) {
                link.querySelector('.tooltiptext')?.replaceChildren();
            }
        });
    },

    filterLeague(data, league) {
        if (!league) return data;
        const column = (data[0] || []).findIndex(header => /^(channel|league)$/i.test(header.trim()));
        return data.filter((row, index) => index === 0 ||
            String(row[column] ?? '').trim().toLowerCase() === league.trim().toLowerCase());
    }
};
