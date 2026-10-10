const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const pages = [
    ['index.html', 'script.js', 'battle_events.csv', 5],
    ['gindex.html', 'gscript.js', 'gsheet_battle_events.csv', 5],
    ['gindex_v2.html', 'gscript_v2.js', 'gsheet_battle_events_v2.csv', 7]
];
const tick = () => new Promise(resolve => setTimeout(resolve, 20));

async function load(t, page, script, csv = 'battle_events.csv', query = '', fixtureText) {
    const errors = [];
    const dom = new JSDOM(fs.readFileSync(path.join(root, page), 'utf8'), {
        url: `https://battledb.test/${page}${query}`, runScripts: 'outside-only',
        virtualConsole: new VirtualConsole().on('jsdomError', error => errors.push(error))
    });
    t.after(() => dom.window.close());
    const { window } = dom;
    await new Promise(resolve => window.document.addEventListener('DOMContentLoaded', resolve));
    window.console = { log() {}, warn() {}, error(...args) { errors.push(args); } };
    let response = fixtureText ?? fs.readFileSync(path.join(root, 'data', csv), 'utf8');
    window.fetch = async url => ({ ok: true, text: async () => url === 'info.yml' ? '' : response });
    window.jsyaml = { load: () => ({ last_updated_time: '2026-10-01 12-00' }) };
    if (fs.existsSync(path.join(root, 'table_helpers.js'))) {
        vm.runInContext(fs.readFileSync(path.join(root, 'table_helpers.js'), 'utf8'), dom.getInternalVMContext());
    }
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), dom.getInternalVMContext());
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    await tick();
    return { window, document: window.document, errors, setResponse: text => { response = text; } };
}
function rows(document) { return [...document.querySelectorAll('#data-table tbody tr')]; }
function search(app, text) {
    const input = app.document.getElementById('searchBox');
    input.value = text;
    input.dispatchEvent(new app.window.Event('input'));
}
function rowFixture(v2, overrides = {}) {
    const values = { 'Name #1': 'Shizu', 'Name #2': 'Other', Event: 'Battle', Type: 'Accapella', Year: '2025', Channel: 'RAM', Uploaded: '2025-01-01', URL: 'https://www.youtube.com/watch?v=J0qDMBdgcGM', ID: 'J0qDMBdgcGM', Views: '100', ...overrides };
    const header = v2 ? ['Name #1','Name #2','Event','Location','Stadt','Type','Year','Channel','Uploaded','URL','Views','ID','hidden'] : ['Name #1','Name #2','Event','Type','Year','Channel','Uploaded','URL','ID','Views','Location','Stadt','Event 2'];
    return [header, header.map(key => values[key] || '')];
}

function csvFixture(v2, entries) {
    return [rowFixture(v2)[0], ...entries.map(entry => rowFixture(v2, entry)[1])]
        .map(row => row.join(',')).join('\n');
}

for (const [page, script, csv, leagueIndex] of pages) {
    const v2 = script === 'gscript_v2.js';
    test(`${script}: committed CSV renders without blank rows or errors`, async t => {
        const app = await load(t, page, script, csv);
        assert.ok(rows(app.document).length > 0);
        assert.ok(rows(app.document).every(row => row.cells[0].textContent.trim() || row.cells[1].textContent.trim()));
        assert.deepEqual(app.errors, []);
    });
    test(`${script}: parser skips blank records`, async t => {
        const fixture = csvFixture(v2, [{}, { 'Name #1': 'Mikesh' }]) + '\n\n , \r\n';
        const app = await load(t, page, script, csv, '', fixture);
        assert.equal(app.window.parseCSV('a,b\n1,2\n\n , \r\n').length, 2);
        assert.equal(rows(app.document).length, 2);
    });
    test(`${script}: Uploaded keeps search and highlighting`, async t => {
        const fixture = csvFixture(v2, [
            { 'Name #2': 'Early', Uploaded: '2025-01-01' },
            { 'Name #1': 'Mikesh', Uploaded: '2025-03-01' },
            { 'Name #2': 'Late', Uploaded: '2025-02-01' }
        ]);
        const app = await load(t, page, script, csv, '', fixture);
        search(app, 'Shizu');
        const before = rows(app.document).map(row => row.textContent).sort();
        assert.equal(before.length, 2);
        app.document.getElementById('sort-uploaded').click();
        assert.deepEqual(rows(app.document).map(row => row.textContent).sort(), before);
        assert.deepEqual(rows(app.document).map(row => row.cells[1].textContent), ['Late', 'Early']);
        assert.ok(app.document.querySelector('.highlight'));
    });
    test(`${script}: theme toggle preserves search`, async t => {
        const app = await load(t, page, script, csv);
        search(app, 'Mikesh');
        const before = rows(app.document).map(row => row.textContent);
        app.document.getElementById('dark-mode-toggle').click();
        assert.equal(app.document.getElementById('searchBox').value, 'Mikesh');
        assert.deepEqual(rows(app.document).map(row => row.textContent), before);
        assert.ok(app.document.body.classList.contains('dark-mode'));
        assert.deepEqual(app.errors, []);
    });
    test(`${script}: league buttons match only Channel and Reset clears them`, async t => {
        const fixture = csvFixture(v2, [
            { Channel: 'RAM' },
            { 'Name #1': 'Mikesh', Channel: ' ram ' },
            { 'Name #1': 'Yarambo', Channel: 'DLTLLY' }
        ]);
        const app = await load(t, page, script, csv, '', fixture);
        app.document.querySelector('[data-filter="RAM"]').click();
        const data = app.window.eval('currentData');
        assert.equal(data.length - 1, 2);
        assert.ok(data.slice(1).every(row => row[leagueIndex].trim().toLowerCase() === 'ram'));
        assert.deepEqual(rows(app.document).map(row => row.cells[0].textContent), ['Shizu', 'Mikesh']);
        app.document.querySelector('[data-filter=""]').click();
        assert.equal(rows(app.document).length, 3);
    });
    test(`${script}: imported markup stays literal while highlighted`, async t => {
        const app = await load(t, page, script, csv);
        const payload = '<img src=x onerror="window.pwned=1">Shizu';
        const fixture = rowFixture(script === 'gscript_v2.js', { 'Name #1': payload });
        app.window.populateTable(fixture, 'Shizu');
        assert.equal(rows(app.document)[0].cells[0].textContent, payload);
        assert.equal(app.document.querySelectorAll('#data-table img, #data-table [onerror]').length, 0);
        assert.equal(app.document.querySelector('.highlight').textContent, 'Shizu');
    });
    test(`${script}: imported links reject unsafe protocols and attribute injection`, async t => {
        const app = await load(t, page, script, csv);
        for (const url of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'not a url', 'https://example.com/" onclick="alert(1)']) {
            app.window.populateTable(rowFixture(script === 'gscript_v2.js', { URL: url }));
            assert.equal(app.document.querySelectorAll('#data-table [onclick]').length, 0);
            for (const link of app.document.querySelectorAll('#data-table a')) assert.equal(new URL(link.href).protocol, 'https:');
            if (!url.startsWith('https:')) assert.equal(app.document.querySelectorAll('#data-table a').length, 0);
        }
        app.window.populateTable(rowFixture(script === 'gscript_v2.js'));
        assert.equal(app.document.querySelector('#data-table a').href, 'https://www.youtube.com/watch?v=J0qDMBdgcGM');
    });
    test(`${script}: thumbnail IDs cannot insert HTML`, async t => {
        const app = await load(t, page, script, csv);
        const url = 'https://www.youtube.com/watch?v=' + encodeURIComponent('x"><img src=x onerror=alert(1)>');
        app.window.populateTable(rowFixture(script === 'gscript_v2.js', { URL: url }));
        await tick();
        const link = app.document.querySelector('#data-table a');
        link.dispatchEvent(new app.window.MouseEvent('mouseover', { bubbles: true }));
        link.dispatchEvent(new app.window.MouseEvent('mouseenter'));
        assert.equal(app.document.querySelectorAll('#data-table img, #data-table [onerror]').length, 0);
        app.window.populateTable(rowFixture(script === 'gscript_v2.js'));
        await tick();
        const valid = app.document.querySelector('#data-table a');
        valid.dispatchEvent(new app.window.MouseEvent('mouseover', { bubbles: true }));
        valid.dispatchEvent(new app.window.MouseEvent('mouseenter'));
        assert.equal(app.document.querySelector('#data-table img')?.src, 'https://img.youtube.com/vi/J0qDMBdgcGM/maxresdefault.jpg');
    });
    if (script !== 'script.js') test(`${script}: refresh keeps typed search and selected league`, async t => {
        const app = await load(t, page, script, csv);
        app.document.querySelector('[data-filter="RAM"]').click();
        search(app, 'Shizu');
        const fixture = rowFixture(script === 'gscript_v2.js');
        const otherLeague = [...fixture[1]]; otherLeague[leagueIndex] = 'DLTLLY';
        const otherName = [...fixture[1]]; otherName[0] = 'Different';
        app.setResponse([fixture[0], fixture[1], otherLeague, otherName].map(row => row.join(',')).join('\n'));
        await app.window.fetchOnlineData();
        await tick();
        assert.equal(app.document.getElementById('searchBox').value, 'Shizu');
        assert.equal(rows(app.document).length, 1);
        assert.equal(app.window.eval('currentData')[1][leagueIndex], 'RAM');
    });
}

test('v2: URL percent values are decoded once', async t => {
    const app = await load(t, 'gindex_v2.html', 'gscript_v2.js', 'gsheet_battle_events_v2.csv', '?search=100%25');
    assert.deepEqual(app.errors, []);
    assert.equal(app.document.getElementById('searchBox').value, '100%');
    assert.equal(rows(app.document).length, 0);
});
test('v2: refresh keeps column URL filters and edited search', async t => {
    const app = await load(t, 'gindex_v2.html', 'gscript_v2.js', 'gsheet_battle_events_v2.csv', '?Channel=DLTLLY&search=Mikesh');
    search(app, 'Shizu');
    await app.window.fetchOnlineData();
    await tick();
    assert.equal(app.document.getElementById('searchBox').value, 'Shizu');
    assert.ok(rows(app.document).length > 0);
    assert.ok(app.window.eval('currentData').slice(1).every(row => row[7] === 'DLTLLY' && row.some(cell => cell.toLowerCase().includes('shizu'))));
    assert.equal(rows(app.document).length, app.window.eval('currentData.length - 1'));
});

test('statistics: MC identity is case insensitive', async t => {
    const app = await load(t, 'most_viewed.html', 'most_viewed.js');
    const a = rowFixture(false, { 'Name #1': 'SSYNIC', Views: '100' })[1];
    const b = rowFixture(false, { 'Name #1': ' ssynic ', Views: '200' })[1];
    const stats = app.window.computeTopMCs([a,b]);
    const mc = stats.find(mc => mc.name.toLowerCase() === 'ssynic');
    assert.equal(mc.views, 300);
    assert.equal(mc.battles, 2);
    assert.equal(stats.length, 2);
});
test('statistics: standalone interviews and promotions excluded, combined videos retained', async t => {
    const app = await load(t, 'most_viewed.html', 'most_viewed.js');
    const events = ['Interview Berlin', 'Interview zum Title Match', 'TEASER LEVEL UP', 'Match-Teaser', 'Promo MAYhem', 'Trailer', 'Battle + Interview', '+ Interview Splash', 'International + Interview MAYhem', 'Battle'];
    const data = events.map(Event => rowFixture(false, { Event })[1]);
    assert.equal(app.window.computeTopMCs(data)[0].battles, 4);
    assert.deepEqual(Array.from(app.window.computeYearlyTopBattles(data)[0].battles, battle => battle.event), events.slice(6));
});
test('statistics: imported names and event fields stay literal and unsafe links are inert', async t => {
    const app = await load(t, 'most_viewed.html', 'most_viewed.js');
    const payload = '<img src=x onerror=alert(1)>';
    app.window.renderTopMCs([{ name: payload, views: 100, battles: 1 }]);
    assert.equal(app.document.querySelector('#top-mc-body tr').cells[1].textContent, payload);
    const row = app.window.createBattleRow({ mc1: payload, mc2: 'Other', event: payload, league: payload, views: 100, url: 'javascript:alert(1)' }, 1);
    assert.equal(row.cells[2].textContent, payload);
    assert.equal(row.querySelectorAll('img, [onerror], a').length, 0);
});

for (const [page, script, csv] of [...pages, ['most_viewed.html', 'most_viewed.js', 'battle_events.csv']]) {
    test(`${script}: CSV quotes preserve commas, line breaks and literal double quotes`, async t => {
        const app = await load(t, page, script, csv);
        const parsed = app.window.parseCSV('\uFEFFName,Event,Views\r\n"Artist, One","Berlin\r\nThe ""Final""",12\r\nPlain,"single\nline",0\r\n\r\n , , \r\n');
        assert.deepEqual(Array.from(parsed, row => Array.from(row)), [
            ['Name', 'Event', 'Views'],
            ['Artist, One', 'Berlin\r\nThe "Final"', '12'],
            ['Plain', 'single\nline', '0']
        ]);
        assert.deepEqual(Array.from(app.window.parseCSV('a,b\r1,2\r'), row => Array.from(row)), [['a', 'b'], ['1', '2']]);
    });
}

test('primary: appended ingestion metadata does not add table cells', async t => {
    const header = 'Name #1,Name #2,Event,Type,Year,Channel,Uploaded,URL,ID,Views,Content category,Availability';
    const fixture = header + '\n"Artist, One",Other,"Berlin\nFinal",Accapella,2026,DLTLLY,2026-01-01,https://www.youtube.com/watch?v=J0qDMBdgcGM,J0qDMBdgcGM,1234,battle,available\n';
    const app = await load(t, 'index.html', 'script.js', 'battle_events.csv', '', fixture);
    const rendered = rows(app.document);
    assert.equal(rendered.length, 1);
    assert.equal(rendered[0].cells.length, 9);
    assert.equal(rendered[0].cells[0].textContent, 'Artist, One');
    assert.equal(rendered[0].cells[2].textContent, 'Berlin\nFinal');
    assert.equal(rendered[0].cells[8].textContent, (1234).toLocaleString());
    assert.equal(rendered[0].cells[7].querySelector('a').href, 'https://www.youtube.com/watch?v=J0qDMBdgcGM');
});

test('statistics: explicit content categories determine eligibility before legacy event heuristics', async t => {
    const app = await load(t, 'most_viewed.html', 'most_viewed.js');
    const entries = [
        ['battle', 'Interview Arena', true],
        ['interview', 'Berlin', false],
        ['promo', 'Berlin', false],
        ['other', 'Berlin', false],
        [' Battle ', 'Trailer Event', true],
        ['Berlin', 'Battle', true],
        ['Berlin', 'Interview', false]
    ];
    const data = entries.map(([category, Event, expected]) => {
        const row = rowFixture(false, { Event })[1];
        row[10] = category;
        assert.equal(app.window.isBattle(row), expected);
        return row;
    });
    assert.equal(app.window.computeTopMCs(data)[0].battles, 3);
    assert.equal(app.window.computeYearlyTopBattles(data)[0].battles.length, 3);
});
