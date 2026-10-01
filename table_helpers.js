// Imported CSV values must stay text, including search highlights and URLs.
const BattleTable = {
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
