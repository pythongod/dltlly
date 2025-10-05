# Rap Battle DB - Comprehensive Project Review & Improvement Roadmap

**Project:** battledb.xyz  
**Review Date:** October 5, 2025  
**Current Version:** Mixed (v1 and v2 in production)  
**Status:** ✅ Live & Functional, 🔧 Needs Optimization

---

## 📊 Executive Summary

**What This Project Is:**
A comprehensive German rap battle database website aggregating 1,400+ battle events from multiple leagues (DLTLLY, DUDL, SPOX, FOB, RAM). Features search, filtering, sorting, and direct YouTube integration with video thumbnails on hover.

**Health Score:** 6.5/10
- ✅ **Functionality:** 8/10 - Core features work well
- ⚠️ **Code Quality:** 4/10 - High duplication, poor maintainability
- ✅ **User Experience:** 7/10 - Good UI, responsive design
- ⚠️ **Performance:** 5/10 - No optimization for large datasets
- 🔴 **Documentation:** 3/10 - Minimal, incomplete
- ⚠️ **Reliability:** 5/10 - No error handling, brittle CSV parser

---

## 🎯 Current Status

### Live Deployments
- **Primary:** https://battledb.xyz/
- **Google Sheets Version:** https://googlesheets--glittering-praline-452e49.netlify.app/
- **Netlify:** https://glittering-praline-452e49.netlify.app/
- **Netlify Status:** [![Badge](https://api.netlify.com/api/v1/badges/e9642600-e89d-4aba-9029-191fd91ed8c6/deploy-status)](https://app.netlify.com/sites/glittering-praline-452e49/deploys)

### Technology Stack
- **Frontend:** Pure HTML, CSS, JavaScript (no framework)
- **Data Source:** CSV files + Google Sheets API
- **Hosting:** Netlify
- **Analytics:** Plausible Analytics
- **External Libraries:** 
  - js-yaml (4.1.0)
  - Google Fonts (Open Sans)

### Data Overview
- **Total Battles:** 1,400+ entries
- **Data Files:** 
  - `battle_events.csv` - Main dataset (1,400 rows)
  - `gsheet_battle_events.csv` - Google Sheets v1
  - `gsheet_battle_events_v2.csv` - Google Sheets v2
  - 764 CSV files in `/data/gsheet/`
  - 656 CSV files in `/data/history/`
  - 467 TXT files in `/data/raw/`
- **Leagues Covered:** DLTLLY, DUDL, SPOX, FOB, RAM
- **Date Range:** Historical to October 2025
- **Last Updated:** 2025-10-05 10:27

### Page Versions
1. **`index.html`** - Simple version (local CSV)
2. **`gindex.html`** - Google Sheets v1
3. **`gindex_v2.html`** - Google Sheets v2 (latest, recommended)
4. **`subpage.html`** - Information/About page
5. **`test.html`** - Development test file (should be removed)

---

## ✅ Working Features

### Core Functionality
- [x] Full-text search across all columns
- [x] Filter buttons for leagues (DLTLLY, DUDL, SPOX, FOB, RAM)
- [x] Special filters (🏆 Trophy, On Beat)
- [x] Dark mode with localStorage persistence
- [x] Sort by Views (ascending/descending)
- [x] Sort by Upload Date
- [x] YouTube thumbnail tooltips on hover
- [x] Responsive design for mobile devices
- [x] URL parameter-based filtering (v2 only)
- [x] Real-time Google Sheets data refresh
- [x] View count formatting (1,000 → 1,000)
- [x] Search result counter
- [x] Last updated timestamp display

### User Interface
- [x] Clean, modern design
- [x] Consistent branding (🎯 icon)
- [x] Hover effects on rows and buttons
- [x] Fixed-width table layout
- [x] Accessible link styling
- [x] Mobile-responsive table (horizontal scroll)

### Data Integration
- [x] Local CSV file support
- [x] Google Sheets public CSV export
- [x] Manual refresh button for online data
- [x] Multiple data source switching
- [x] Historical data preservation

---

## 🔴 Critical Issues

### 1. Broken CSV Parser

**Location:** All JavaScript files (script.js, gscript.js, gscript_v2.js)

**Current Code:**
```javascript
function parseCSV(text) {
    return text.split('\n').map(row => row.split(','));
}
```

**Problem:**
This naive parser will fail on:
- Commas within quoted fields: `"Event Name, Berlin"` → Splits incorrectly
- Newlines within quoted fields
- Special characters
- Escaped quotes

**Impact:** 🔴 HIGH
- Data corruption in display
- Incorrect column alignment
- Missing data for events with commas in names

**Example Failure:**
```csv
MC Name #1,MC Name #2,Event,Type
John Doe,Jane Smith,"Berlin Finals, 2025",Accapella
```
Would parse as 5 columns instead of 4.

---

### 2. Massive Code Duplication

**Files Affected:**
- `style.css` (271 lines)
- `gstyle.css` (304 lines)
- `gstyle_v2.css` (394 lines)
- `script.js` (237 lines)
- `gscript.js` (224 lines)
- `gscript_v2.js` (338 lines)

**Duplication Analysis:**
- ~80% of JavaScript code is duplicated
- ~90% of CSS code is duplicated
- Only minor variations between versions

**Impact:** 🟠 MEDIUM-HIGH
- Difficult to maintain
- Bug fixes need 3x work
- Inconsistent behavior across versions
- Larger file sizes

**Example:**
Dark mode toggle exists in 3 places with slightly different implementations:

```javascript
// Version 1 (script.js:96-106)
function toggleDarkMode(on) {
    const body = document.body;
    if (on) {
        body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    } else {
        body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
    }
}

// Version 2 (gscript.js:96-100)
function toggleDarkMode(on) {
    const body = document.body;
    body.classList.toggle("dark-mode", on);
    localStorage.setItem("theme", on ? "dark" : "light");
}
```

---

### 3. Memory Leak in Event Listeners

**Location:** `gscript_v2.js:296-332`

**Current Code:**
```javascript
function addYouTubeThumbnails() {
    document.querySelector('#data-table').addEventListener('mouseover', function(event) {
        const link = event.target.closest('a.tooltip[href*="youtube.com/watch"]');
        if (!link) return;

        link.addEventListener('mouseenter', function() { ... }); // NEW LISTENER EVERY HOVER
        link.addEventListener('mouseleave', function() { ... }); // NEW LISTENER EVERY HOVER
    });
}
```

**Problem:**
- Creates new event listeners every time you hover over the table
- Never removes old listeners
- Memory usage grows over time
- Performance degrades with use

**Impact:** 🟠 MEDIUM
- Memory bloat after extended use
- Slows down browser over time
- Multiple tooltips may appear
- Battery drain on mobile

---

### 4. No Error Handling

**Missing Error Handling:**
1. CSV fetch failures
2. Malformed CSV data
3. Empty search results
4. Invalid YouTube URLs
5. Network errors
6. CORS issues with Google Sheets

**Current Behavior:**
```javascript
fetch(url)
    .then(response => response.text())
    .then(text => {
        const data = parseCSV(text);
        populateTable(data);
    })
    .catch(error => {
        console.error('Error fetching the CSV file:', error); // ONLY LOGS TO CONSOLE
    });
```

**Impact:** 🟠 MEDIUM
- Users see blank page on errors
- No feedback when searches fail
- Confusing when data doesn't load
- Hard to debug user issues

---

### 5. Duplicate Event Listeners

**Location:** `gscript_v2.js:217-263`

**Problem:**
Two event listeners attached to the same element:

```javascript
document.addEventListener('DOMContentLoaded', function() {
    searchBox.addEventListener('input', () => {  // LINE 219
        const searchTerm = searchBox.value.toLowerCase();
        const filteredData = currentData.filter(row => 
            row.some(cell => cell.toLowerCase().includes(searchTerm))
        );
        populateTable(filteredData);
    });

    // ... 30 lines later ...

    searchBox.addEventListener('input', () => {  // LINE 251 - DUPLICATE!
        const globalSearchTerm = searchBox.value;
        const columnSearches = parseURLParams();
        // Different logic...
    });
});
```

**Impact:** 🟡 LOW-MEDIUM
- Search runs twice per keystroke
- Performance degradation
- Confusing behavior
- Harder to debug

---

### 6. Inconsistent Column Display

**Location:** `gscript_v2.js:23-50`

**Current Code:**
```javascript
// Comment says 13 columns:
// Name #1,Name #2,Event,Location,Stadt,Type,Year,Channel,Uploaded,URL,Views,ID,hidden
const columnOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
```

**Problem:**
- Displays ID column (should be hidden)
- Displays hidden column (should be hidden)
- Column count doesn't match HTML table headers (11 headers, 13 columns)
- Will cause misalignment

**Impact:** 🟡 LOW-MEDIUM
- Ugly table display
- Confusing to users
- Data may be cut off

---

## 🎯 Improvement Plan

### Priority 1: Critical Fixes (Week 1)

---

## 📋 PRIORITY 1: Critical Fixes (Week 1, ~8-12 hours)

### ✅ **Fix 1.1: Replace CSV Parser**

**Timeline:** 2 hours  
**Difficulty:** Easy  
**Impact:** HIGH - Prevents data corruption

#### Current State
```javascript
function parseCSV(text) {
    return text.split('\n').map(row => row.split(','));
}
```

#### Implementation Steps

**Step 1: Choose Parser Library**
- **Option A: PapaParse** (Recommended)
  - Pros: Battle-tested, 8k+ GitHub stars, handles edge cases
  - Cons: 125KB (gzipped: 42KB)
  - CDN: `https://cdn.jsdelivr.net/npm/papaparse@5/papaparse.min.js`

- **Option B: CSV.js**
  - Pros: Lighter weight (12KB)
  - Cons: Less features, less maintained

**Recommendation:** Use PapaParse

**Step 2: Add Library to HTML**
```html
<!-- Add before your script tags -->
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
```

**Step 3: Replace Parser Function**
```javascript
// OLD VERSION
function parseCSV(text) {
    return text.split('\n').map(row => row.split(','));
}

// NEW VERSION
function parseCSV(text) {
    const result = Papa.parse(text, {
        header: false,           // We handle headers manually
        skipEmptyLines: true,    // Ignore blank lines
        dynamicTyping: false,    // Keep all as strings
        trimHeaders: true,       // Remove whitespace from headers
        trimFields: true,        // Remove whitespace from fields
        delimiter: ',',          // Explicit comma delimiter
        newline: '',            // Auto-detect line endings
        quoteChar: '"',         // Standard CSV quotes
        escapeChar: '"',        // Standard CSV escape
        comments: false,        // No comment support needed
        error: function(error) {
            console.error('CSV Parsing Error:', error);
        }
    });
    
    // Handle parsing errors
    if (result.errors.length > 0) {
        console.warn('CSV Warnings:', result.errors);
    }
    
    return result.data;
}
```

**Step 4: Add Error Handling**
```javascript
function fetchData(url) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(text => {
            if (!text || text.trim().length === 0) {
                throw new Error('CSV file is empty');
            }
            
            try {
                csvData = parseCSV(text);
                
                if (csvData.length < 2) {
                    throw new Error('CSV file has no data rows');
                }
                
                console.log(`✅ Loaded ${csvData.length - 1} battles`);
                applyInitialFilters();
                
            } catch (parseError) {
                throw new Error(`CSV parsing failed: ${parseError.message}`);
            }
        })
        .catch(error => {
            console.error('❌ Data Loading Error:', error);
            displayErrorMessage(error.message);
        });
}

function displayErrorMessage(message) {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = `
        <tr>
            <td colspan="11" style="text-align: center; padding: 40px;">
                <div style="font-size: 18px; color: #e74c3c; margin-bottom: 10px;">
                    ⚠️ Error Loading Data
                </div>
                <div style="color: #666;">
                    ${message}
                </div>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">
                    Retry
                </button>
            </td>
        </tr>
    `;
    document.getElementById('search-results').textContent = 'Error loading data';
}
```

**Step 5: Testing Checklist**
- [ ] Test with commas in event names: `"Berlin Finals, 2025"`
- [ ] Test with quotes in MC names: `MC "The King" Smith`
- [ ] Test with newlines in data
- [ ] Test with empty CSV file
- [ ] Test with malformed CSV
- [ ] Test with special characters: äöüß
- [ ] Test with very long strings
- [ ] Test with missing columns

**Step 6: Update All Files**
Files to update:
- [ ] `index.html` - Add PapaParse CDN
- [ ] `gindex.html` - Add PapaParse CDN
- [ ] `gindex_v2.html` - Add PapaParse CDN
- [ ] `script.js` - Replace parseCSV function
- [ ] `gscript.js` - Replace parseCSV function
- [ ] `gscript_v2.js` - Replace parseCSV function

---

### ✅ **Fix 1.2: Fix Memory Leaks**

**Timeline:** 2 hours  
**Difficulty:** Medium  
**Impact:** MEDIUM - Prevents performance degradation

#### Current Problem
```javascript
// Creates new listeners on EVERY table hover
function addYouTubeThumbnails() {
    document.querySelector('#data-table').addEventListener('mouseover', function(event) {
        link.addEventListener('mouseenter', function() { ... });
        link.addEventListener('mouseleave', function() { ... });
    });
}
```

#### Implementation Steps

**Step 1: Use Event Delegation Properly**
```javascript
// NEW VERSION - Single listener, no leaks
function addYouTubeThumbnails() {
    const table = document.querySelector('#data-table tbody');
    if (!table) {
        console.error('Table body not found');
        return;
    }
    
    // Store currently active tooltip
    let currentTooltip = null;
    
    // Single event listener using delegation
    table.addEventListener('mouseover', function(event) {
        const link = event.target.closest('a.tooltip[href*="youtube.com/watch"]');
        
        // Not hovering over a YouTube link
        if (!link) {
            clearCurrentTooltip();
            return;
        }
        
        // Already showing this tooltip
        if (currentTooltip === link) {
            return;
        }
        
        // Clear previous tooltip
        clearCurrentTooltip();
        
        // Show new tooltip
        showThumbnail(link);
        currentTooltip = link;
    });
    
    // Clear tooltip when mouse leaves table
    table.addEventListener('mouseleave', function() {
        clearCurrentTooltip();
    });
    
    function clearCurrentTooltip() {
        if (currentTooltip) {
            const tooltip = currentTooltip.querySelector('.tooltiptext');
            if (tooltip) {
                tooltip.innerHTML = '';
            }
            currentTooltip = null;
        }
    }
    
    function showThumbnail(link) {
        const tooltip = link.querySelector('.tooltiptext');
        if (!tooltip) {
            console.error('Tooltip element not found');
            return;
        }
        
        const videoId = new URLSearchParams(new URL(link.href).search).get('v');
        if (!videoId) {
            tooltip.innerHTML = '<div style="padding: 10px;">Invalid YouTube URL</div>';
            return;
        }
        
        // Try maxresdefault first
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        const fallbackUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        
        const img = new Image();
        img.onload = function() {
            // Check if image is valid (maxresdefault returns 120x90 gray image if not available)
            if (img.naturalWidth === 120 && img.naturalHeight === 90) {
                img.src = fallbackUrl;
            } else {
                tooltip.innerHTML = `<img src="${thumbnailUrl}" alt="Video Thumbnail" style="width: 100%; height: auto; display: block;">`;
            }
        };
        img.onerror = function() {
            // Fallback to hqdefault
            tooltip.innerHTML = `<img src="${fallbackUrl}" alt="Video Thumbnail" style="width: 100%; height: auto; display: block;">`;
        };
        img.src = thumbnailUrl;
    }
}
```

**Step 2: Initialize Once**
```javascript
document.addEventListener('DOMContentLoaded', function() {
    // ... other initialization ...
    
    // Call ONCE on page load
    addYouTubeThumbnails();
    
    // Don't call again after populateTable()
});
```

**Step 3: Remove Old Calls**
Search for and remove these lines:
```javascript
// REMOVE THESE:
addYouTubeThumbnails(); // After populateTable()
setTimeout(() => { addYouTubeThumbnails(); }, 10); // After populateTable()
```

**Step 4: Testing**
- [ ] Hover over multiple links rapidly
- [ ] Open browser DevTools → Performance tab
- [ ] Record while hovering for 30 seconds
- [ ] Check Event Listeners count doesn't grow
- [ ] Verify memory usage stays stable
- [ ] Test on mobile devices

---

### ✅ **Fix 1.3: Remove Duplicate Event Listeners**

**Timeline:** 1 hour  
**Difficulty:** Easy  
**Impact:** LOW-MEDIUM - Improves performance

#### Problem Location
`gscript_v2.js` has duplicate search input handlers.

#### Implementation Steps

**Step 1: Consolidate Logic**
```javascript
document.addEventListener('DOMContentLoaded', function() {
    const searchBox = document.getElementById('searchBox');
    
    // SINGLE search handler with all logic
    searchBox.addEventListener('input', function() {
        const globalSearchTerm = searchBox.value;
        
        // Check if we have URL parameters for column-specific filtering
        const columnSearches = parseURLParams();
        
        // Start with full dataset or column-filtered data
        let filteredData = columnSearches && Object.keys(columnSearches).length > 0
            ? searchTableByColumn(csvData, columnSearches)
            : csvData;
        
        // Apply global search on top
        if (globalSearchTerm.trim().length > 0) {
            filteredData = filteredData.filter((row, index) => {
                if (index === 0) return true; // Keep header
                return row.some(cell => 
                    cell && cell.toLowerCase().includes(globalSearchTerm.toLowerCase())
                );
            });
        }
        
        currentData = filteredData;
        populateTable(filteredData, globalSearchTerm);
        
        // Update UI with applied filters
        updateUIWithAppliedFilters({
            ...columnSearches,
            ...(globalSearchTerm ? { 'Search': globalSearchTerm } : {})
        });
    });
    
    // ... rest of initialization ...
});
```

**Step 2: Find and Remove Duplicates**
Search all JavaScript files for:
```javascript
searchBox.addEventListener('input'
```

Keep only ONE per file.

**Step 3: Test Search**
- [ ] Type in search box
- [ ] Verify results update correctly
- [ ] Check console for errors
- [ ] Verify no duplicate requests
- [ ] Test with special characters
- [ ] Test with empty search

---

### ✅ **Fix 1.4: Add Comprehensive Error Handling**

**Timeline:** 3 hours  
**Difficulty:** Medium  
**Impact:** MEDIUM - Better user experience

#### Implementation Steps

**Step 1: Create Error Display Component**
```javascript
// Add to beginning of each JS file
const ErrorHandler = {
    // Show error in table
    showTableError: function(message, actionButton = null) {
        const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
        
        let actionHTML = '';
        if (actionButton) {
            actionHTML = `
                <button onclick="${actionButton.action}" 
                        style="margin-top: 20px; padding: 10px 20px; 
                               background: #3498db; color: white; border: none; 
                               border-radius: 4px; cursor: pointer;">
                    ${actionButton.text}
                </button>
            `;
        }
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 20px; font-weight: 600; color: #e74c3c; margin-bottom: 10px;">
                        Error Loading Data
                    </div>
                    <div style="color: #666; margin-bottom: 20px; max-width: 500px; margin-left: auto; margin-right: auto;">
                        ${message}
                    </div>
                    ${actionHTML}
                </td>
            </tr>
        `;
    },
    
    // Show empty state
    showEmptyState: function(searchTerm = '') {
        const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                    <div style="font-size: 18px; color: #666; margin-bottom: 10px;">
                        No battles found
                    </div>
                    <div style="color: #999;">
                        ${searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
                    </div>
                </td>
            </tr>
        `;
    },
    
    // Show loading state
    showLoading: function() {
        const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px;">
                    <div class="loading-spinner" style="
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #3498db;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    "></div>
                    <div style="color: #666;">Loading battles...</div>
                </td>
            </tr>
        `;
    },
    
    // Log error to console with context
    logError: function(context, error, data = {}) {
        console.error(`❌ [${context}]`, {
            message: error.message,
            stack: error.stack,
            ...data,
            timestamp: new Date().toISOString()
        });
    }
};

// Add CSS animation for loading spinner
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
```

**Step 2: Update fetchData Function**
```javascript
function fetchData(url) {
    ErrorHandler.showLoading();
    
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/csv') && !contentType.includes('text/plain')) {
                console.warn('Unexpected content type:', contentType);
            }
            
            return response.text();
        })
        .then(text => {
            if (!text || text.trim().length === 0) {
                throw new Error('The CSV file is empty. Please check the data source.');
            }
            
            try {
                csvData = parseCSV(text);
                
                if (!csvData || csvData.length === 0) {
                    throw new Error('Failed to parse CSV data. The file may be corrupted.');
                }
                
                if (csvData.length < 2) {
                    throw new Error('CSV file has no data rows, only headers.');
                }
                
                const headers = csvData[0];
                const expectedColumns = ['Name #1', 'Name #2', 'Event'];
                const hasRequiredColumns = expectedColumns.every(col => 
                    headers.some(h => h && h.trim().toLowerCase().includes(col.toLowerCase()))
                );
                
                if (!hasRequiredColumns) {
                    console.warn('CSV headers may be incorrect:', headers);
                }
                
                console.log(`✅ Successfully loaded ${csvData.length - 1} battles`);
                applyInitialFilters();
                
            } catch (parseError) {
                ErrorHandler.logError('CSV Parsing', parseError, { url });
                throw new Error(`Failed to parse CSV: ${parseError.message}`);
            }
        })
        .catch(error => {
            ErrorHandler.logError('Data Fetch', error, { url });
            
            let userMessage = 'Failed to load battle data. ';
            
            if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                userMessage += 'Please check your internet connection.';
            } else if (error.message.includes('404')) {
                userMessage += 'The data file was not found.';
            } else if (error.message.includes('CORS')) {
                userMessage += 'Access to data was blocked by security policy.';
            } else {
                userMessage += error.message;
            }
            
            ErrorHandler.showTableError(userMessage, {
                text: 'Retry',
                action: 'location.reload()'
            });
            
            document.getElementById('search-results').textContent = 'Error';
        });
}
```

**Step 3: Update populateTable with Empty State**
```javascript
function populateTable(data, searchText = '') {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    
    // Skip header row
    const dataRows = data.slice(1);
    
    // Check for empty results
    if (dataRows.length === 0) {
        ErrorHandler.showEmptyState(searchText);
        document.getElementById('search-results').textContent = 'Search results: 0';
        return;
    }
    
    let count = 0;
    
    try {
        dataRows.forEach((row, index) => {
            count++;
            const tr = document.createElement('tr');
            
            // ... rest of populateTable logic ...
            
            tableBody.appendChild(tr);
        });
        
        document.getElementById('search-results').textContent = `Search results: ${count}`;
        
    } catch (error) {
        ErrorHandler.logError('Table Population', error, { rowCount: data.length });
        ErrorHandler.showTableError(
            'An error occurred while displaying the data. Some battles may be missing.',
            { text: 'Reload Page', action: 'location.reload()' }
        );
    }
}
```

**Step 4: Add Network Status Detection**
```javascript
// Add to DOMContentLoaded
window.addEventListener('online', function() {
    console.log('✅ Back online');
    if (!csvData || csvData.length === 0) {
        location.reload();
    }
});

window.addEventListener('offline', function() {
    console.log('⚠️ Connection lost');
    ErrorHandler.showTableError(
        'You are currently offline. Data may be outdated.',
        null
    );
});
```

**Step 5: Testing Checklist**
- [ ] Test with invalid URL
- [ ] Test with 404 error
- [ ] Test with empty CSV
- [ ] Test with malformed CSV
- [ ] Test with network offline
- [ ] Test with CORS error (if applicable)
- [ ] Test empty search results
- [ ] Test error retry button

---

### ✅ **Fix 1.5: Fix Column Display Issues**

**Timeline:** 1 hour  
**Difficulty:** Easy  
**Impact:** LOW-MEDIUM - Better table display

#### Problem
Column count mismatch causes display issues.

#### Implementation Steps

**Step 1: Document CSV Schema**
Create `data/schema.json`:
```json
{
  "version": "2.0",
  "description": "Rap Battle Database CSV Schema",
  "columns": [
    {
      "index": 0,
      "name": "Name #1",
      "type": "string",
      "required": true,
      "display": true,
      "description": "First MC/Rapper name"
    },
    {
      "index": 1,
      "name": "Name #2",
      "type": "string",
      "required": true,
      "display": true,
      "description": "Second MC/Rapper name"
    },
    {
      "index": 2,
      "name": "Event",
      "type": "string",
      "required": true,
      "display": true,
      "description": "Event or battle name"
    },
    {
      "index": 3,
      "name": "Location",
      "type": "string",
      "required": false,
      "display": true,
      "description": "Event location/venue"
    },
    {
      "index": 4,
      "name": "Stadt",
      "type": "string",
      "required": false,
      "display": true,
      "description": "City (German: Stadt)"
    },
    {
      "index": 5,
      "name": "Type",
      "type": "string",
      "required": true,
      "display": true,
      "description": "Battle type (Accapella, On Beat, etc.)"
    },
    {
      "index": 6,
      "name": "Year",
      "type": "number",
      "required": true,
      "display": true,
      "description": "Year of battle"
    },
    {
      "index": 7,
      "name": "League",
      "type": "string",
      "required": true,
      "display": true,
      "description": "League name (DLTLLY, FOB, etc.)"
    },
    {
      "index": 8,
      "name": "Uploaded",
      "type": "date",
      "required": true,
      "display": true,
      "format": "YYYY-MM-DD",
      "description": "Upload date to YouTube"
    },
    {
      "index": 9,
      "name": "URL",
      "type": "url",
      "required": true,
      "display": true,
      "description": "YouTube video URL"
    },
    {
      "index": 10,
      "name": "Views",
      "type": "number",
      "required": true,
      "display": true,
      "description": "YouTube view count"
    },
    {
      "index": 11,
      "name": "ID",
      "type": "string",
      "required": true,
      "display": false,
      "description": "YouTube video ID"
    },
    {
      "index": 12,
      "name": "hidden",
      "type": "boolean",
      "required": false,
      "display": false,
      "description": "Hidden flag for filtering"
    }
  ]
}
```

**Step 2: Update populateTable to Use Schema**
```javascript
// Define display columns at top of file
const DISPLAY_COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// Excludes: 11 (ID), 12 (hidden)

function populateTable(data, searchText = '') {
    const tableBody = document.getElementById('data-table').getElementsByTagName('tbody')[0];
    tableBody.innerHTML = '';
    
    const dataRows = data.slice(1);
    
    if (dataRows.length === 0) {
        ErrorHandler.showEmptyState(searchText);
        document.getElementById('search-results').textContent = 'Search results: 0';
        return;
    }
    
    let count = 0;
    
    dataRows.forEach((row) => {
        count++;
        const tr = document.createElement('tr');
        
        // Only display columns defined in DISPLAY_COLUMNS
        DISPLAY_COLUMNS.forEach(columnIndex => {
            const td = document.createElement('td');
            let cellContent = row[columnIndex] || '';
            
            // Special handling by column index
            if (columnIndex === 10) {
                // Views column - format number
                const views = parseInt(cellContent);
                cellContent = isNaN(views) ? '0' : views.toLocaleString();
            } else if (columnIndex === 9) {
                // URL column - create link
                const URLtext = 'Link';
                td.innerHTML = `<a href="${cellContent}" target="_blank" rel="noopener noreferrer" class="tooltip">
                    ${URLtext}
                    <div class="tooltiptext"></div>
                </a>`;
                tr.appendChild(td);
                return;
            } else if (searchText && cellContent.toLowerCase().includes(searchText.toLowerCase())) {
                // Highlight search term
                td.innerHTML = cellContent.replace(
                    new RegExp(searchText, 'gi'), 
                    match => `<span class="highlight">${match}</span>`
                );
                tr.appendChild(td);
                return;
            }
            
            td.textContent = cellContent;
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });
    
    document.getElementById('search-results').textContent = `Search results: ${count}`;
}
```

**Step 3: Verify HTML Table Headers Match**
```html
<!-- gindex_v2.html - Verify these match DISPLAY_COLUMNS -->
<thead>
    <tr>
        <th>MC Name #1</th>     <!-- Column 0 -->
        <th>MC Name #2</th>     <!-- Column 1 -->
        <th>Event</th>          <!-- Column 2 -->
        <th>Location</th>       <!-- Column 3 -->
        <th>Stadt</th>          <!-- Column 4 -->
        <th>Type</th>           <!-- Column 5 -->
        <th>Year</th>           <!-- Column 6 -->
        <th>League</th>         <!-- Column 7 -->
        <th id="sort-uploaded">Uploaded</th>  <!-- Column 8 -->
        <th>URL</th>            <!-- Column 9 -->
        <th id="sort-views" title="Click to sort by views">Views</th>  <!-- Column 10 -->
    </tr>
</thead>
```

**Step 4: Add Column Validation**
```javascript
function validateCSVStructure(data) {
    if (!data || data.length === 0) {
        return { valid: false, error: 'CSV is empty' };
    }
    
    const headers = data[0];
    const expectedColumnCount = 13;
    
    if (headers.length < expectedColumnCount) {
        return { 
            valid: false, 
            error: `Expected ${expectedColumnCount} columns, found ${headers.length}` 
        };
    }
    
    // Check a sample row
    if (data.length > 1) {
        const sampleRow = data[1];
        if (sampleRow.length !== headers.length) {
            console.warn('Column count mismatch detected in data rows');
        }
    }
    
    return { valid: true };
}

// Call in fetchData after parsing
const validation = validateCSVStructure(csvData);
if (!validation.valid) {
    throw new Error(`CSV validation failed: ${validation.error}`);
}
```

**Step 5: Testing**
- [ ] Verify all 11 columns display correctly
- [ ] Verify ID column is hidden
- [ ] Verify hidden column is hidden
- [ ] Check column alignment
- [ ] Test with different screen sizes
- [ ] Verify no horizontal scroll needed (except mobile)

---

### ✅ **Fix 1.6: Remove Test File**

**Timeline:** 5 minutes  
**Difficulty:** Easy  
**Impact:** LOW - Cleanup

#### Implementation Steps

**Step 1: Verify File is Not Referenced**
```bash
# Search for references to test.html
grep -r "test.html" .
```

**Step 2: Delete File**
Delete `test.html`

**Step 3: Update .gitignore if Needed**
```gitignore
# Add to .gitignore
test.html
test_*.html
*_test.html
```

---

## 📋 PRIORITY 2: Code Consolidation (Week 2, ~12-16 hours)

### ✅ **Fix 2.1: Consolidate CSS Files**

**Timeline:** 4 hours  
**Difficulty:** Medium  
**Impact:** HIGH - Reduces maintenance burden

#### Current State
- `style.css` (271 lines)
- `gstyle.css` (304 lines) - 90% duplicate
- `gstyle_v2.css` (394 lines) - 90% duplicate

#### Implementation Steps

**Step 1: Analyze Differences**
Create a comparison document:
```bash
# Use diff to find unique styles
diff style.css gstyle.css > css_diff_v1.txt
diff gstyle.css gstyle_v2.css > css_diff_v2.txt
```

**Step 2: Create Unified CSS Structure**
```
styles/
├── base.css          # Core styles used by all pages
├── components.css    # Reusable components (buttons, table, etc.)
├── themes.css        # Light/dark mode
├── pages.css         # Page-specific overrides
└── responsive.css    # Media queries
```

**Step 3: Create `styles/base.css`**
```css
/**
 * Base Styles - Rap Battle DB
 * Version: 2.0
 * Last Updated: 2025-10-05
 */

/* ============================================
   CSS Variables for Easy Theming
   ============================================ */
:root {
    /* Colors - Light Mode */
    --bg-primary: #f9f9f9;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f4f4f4;
    
    --text-primary: #333;
    --text-secondary: #666;
    --text-tertiary: #999;
    
    --border-color: #ddd;
    --border-color-hover: #ccc;
    
    --shadow-sm: 0px 0px 8px rgba(0, 0, 0, 0.1);
    --shadow-md: 0px 2px 12px rgba(0, 0, 0, 0.15);
    
    --accent-primary: #3498db;
    --accent-hover: #2980b9;
    --accent-danger: #e74c3c;
    
    --row-hover: #f1f1f1;
    --row-even: #f9f9f9;
    
    /* Spacing */
    --spacing-xs: 5px;
    --spacing-sm: 10px;
    --spacing-md: 20px;
    --spacing-lg: 40px;
    
    /* Typography */
    --font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-size-base: 16px;
    --font-size-sm: 14px;
    --font-size-xs: 12px;
    --font-size-lg: 18px;
    --font-size-xl: 20px;
    
    /* Layout */
    --container-max-width: 1600px;
    --container-padding: 20px;
    
    /* Transitions */
    --transition-fast: 0.2s ease;
    --transition-normal: 0.3s ease;
}

/* Dark Mode Variables */
body.dark-mode {
    --bg-primary: #121212;
    --bg-secondary: #1e1e1e;
    --bg-tertiary: #333;
    
    --text-primary: #ffffff;
    --text-secondary: #cccccc;
    --text-tertiary: #999999;
    
    --border-color: #444;
    --border-color-hover: #555;
    
    --shadow-sm: 0px 0px 8px rgba(255, 255, 255, 0.1);
    --shadow-md: 0px 2px 12px rgba(255, 255, 255, 0.15);
    
    --row-hover: #2a2a2a;
    --row-even: #1e1e1e;
}

/* ============================================
   Base Styles
   ============================================ */
* {
    box-sizing: border-box;
}

body {
    font-family: var(--font-family);
    background-color: var(--bg-primary);
    color: var(--text-primary);
    margin: 0;
    padding: 0;
    font-size: var(--font-size-base);
    line-height: 1.6;
    transition: background-color var(--transition-normal), 
                color var(--transition-normal);
}

/* ============================================
   Layout
   ============================================ */
.container {
    width: 90%;
    max-width: var(--container-max-width);
    margin: 0 auto;
    padding: var(--container-padding);
}

/* ============================================
   Links
   ============================================ */
a {
    color: var(--accent-primary);
    text-decoration: none;
    transition: color var(--transition-fast);
}

a:hover {
    color: var(--accent-hover);
}

body.dark-mode a {
    color: #a9ecf5;
    text-decoration: underline;
    text-decoration-style: dotted;
}

body.dark-mode a:hover {
    color: #ffffff;
    background-color: #555555;
}

body.dark-mode a:visited {
    color: #c7a2ff;
}

/* ============================================
   Typography
   ============================================ */
.highlight {
    font-weight: 600;
    background-color: yellow;
    padding: 2px 4px;
    border-radius: 2px;
}

body.dark-mode .highlight {
    background-color: #ffc107;
    color: #000;
}
```

**Step 4: Create `styles/components.css`**
```css
/**
 * Component Styles - Rap Battle DB
 */

/* ============================================
   Buttons
   ============================================ */
.filter-btn,
.data-source-btn {
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--font-size-xs);
    border-radius: 4px;
    transition: background-color var(--transition-normal), 
                border-color var(--transition-normal),
                transform var(--transition-fast);
    font-family: var(--font-family);
}

.filter-btn:hover,
.data-source-btn:hover {
    background-color: var(--border-color);
    transform: translateY(-1px);
}

.filter-btn:active,
.data-source-btn:active {
    transform: translateY(0);
}

.filter-btn.active {
    background-color: var(--accent-primary);
    color: white;
    border-color: var(--accent-primary);
}

/* ============================================
   Filters Container
   ============================================ */
#filters {
    margin-top: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
}

/* ============================================
   Search Box
   ============================================ */
input#searchBox {
    width: 100%;
    padding: 10px 15px;
    margin-bottom: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: var(--shadow-sm);
    font-size: var(--font-size-base);
    font-family: var(--font-family);
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    transition: border-color var(--transition-fast),
                box-shadow var(--transition-fast);
}

input#searchBox:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

/* ============================================
   Info Container
   ============================================ */
.info-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
}

.info-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: var(--spacing-xs) 0;
}

#search-results {
    text-align: left;
    font-weight: 600;
}

#last-updated {
    text-align: right;
}

#applied-filters {
    flex: 1 1 100%;
    text-align: center;
    font-style: italic;
    color: var(--accent-primary);
}

/* ============================================
   Table
   ============================================ */
#data-table {
    width: 100%;
    border-collapse: collapse;
    box-shadow: var(--shadow-sm);
    table-layout: fixed;
    background-color: var(--bg-secondary);
}

th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    word-wrap: break-word;
}

th {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
}

tr:nth-child(even) {
    background-color: var(--row-even);
}

tr:hover {
    background-color: var(--row-hover);
}

/* Sortable columns */
th[id^="sort-"] {
    cursor: pointer;
    user-select: none;
    position: relative;
    padding-right: 30px;
}

th[id^="sort-"]:hover {
    background-color: var(--border-color);
}

/* Sort indicators */
th.asc::after {
    content: '';
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-bottom: 5px solid var(--text-primary);
}

th.desc::after {
    content: '';
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid var(--text-primary);
}

/* ============================================
   Tooltips
   ============================================ */
.tooltip {
    position: relative;
    display: inline-block;
}

.tooltip .tooltiptext {
    visibility: hidden;
    width: 640px;
    max-width: 90vw;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-md);
    text-align: center;
    padding: var(--spacing-xs);
    border-radius: 4px;
    position: absolute;
    z-index: 1000;
    bottom: 125%;
    left: 50%;
    margin-left: -320px;
    opacity: 0;
    transition: opacity var(--transition-normal), 
                visibility var(--transition-normal);
    pointer-events: none;
}

.tooltip:hover .tooltiptext {
    visibility: visible;
    opacity: 1;
}

.tooltip .tooltiptext img {
    max-width: 100%;
    height: auto;
    display: block;
    border-radius: 2px;
}

/* ============================================
   Footer
   ============================================ */
footer {
    text-align: center;
    background-color: var(--bg-tertiary);
    padding: var(--spacing-md);
    margin-top: var(--spacing-lg);
}

.footer-link {
    color: var(--accent-primary);
    font-weight: 600;
}

.footer-link:hover {
    text-decoration: underline;
}
```

**Step 5: Create `styles/responsive.css`**
```css
/**
 * Responsive Styles - Rap Battle DB
 */

/* ============================================
   Mobile Phones (< 600px)
   ============================================ */
@media screen and (max-width: 600px) {
    .container {
        width: 95%;
        padding: 10px;
    }
    
    #filters {
        gap: 5px;
    }
    
    .filter-btn,
    .data-source-btn {
        font-size: 11px;
        padding: 6px 10px;
    }
    
    input#searchBox {
        font-size: 16px; /* Prevent zoom on iOS */
    }
    
    .info-container {
        flex-direction: column;
        align-items: flex-start;
    }
    
    #data-table {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    th, td {
        white-space: nowrap;
        font-size: var(--font-size-sm);
        padding: 8px 10px;
    }
    
    .tooltip .tooltiptext {
        width: 320px;
        margin-left: -160px;
    }
    
    footer {
        padding: 15px;
        font-size: var(--font-size-sm);
    }
}

/* ============================================
   Tablets (600px - 900px)
   ============================================ */
@media screen and (min-width: 601px) and (max-width: 900px) {
    .container {
        width: 95%;
    }
    
    th, td {
        padding: 10px 12px;
    }
}

/* ============================================
   Large Screens (> 1600px)
   ============================================ */
@media screen and (min-width: 1601px) {
    .container {
        max-width: 1800px;
    }
    
    th, td {
        padding: 14px 18px;
    }
}

/* ============================================
   Print Styles
   ============================================ */
@media print {
    body {
        background: white;
        color: black;
    }
    
    #filters,
    #searchBox,
    footer,
    .data-source-btn {
        display: none;
    }
    
    #data-table {
        box-shadow: none;
    }
    
    a {
        color: black;
        text-decoration: underline;
    }
    
    a[href]:after {
        content: " (" attr(href) ")";
        font-size: 11px;
    }
}

/* ============================================
   Accessibility
   ============================================ */

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    :root {
        --border-color: #000;
        --shadow-sm: none;
        --shadow-md: none;
    }
    
    body.dark-mode {
        --border-color: #fff;
    }
    
    button,
    input {
        border-width: 2px;
    }
}

/* Focus visible for keyboard navigation */
:focus-visible {
    outline: 3px solid var(--accent-primary);
    outline-offset: 2px;
}

button:focus-visible,
a:focus-visible {
    outline: 3px solid var(--accent-primary);
    outline-offset: 2px;
}
```

**Step 6: Update HTML Files**
```html
<!-- Replace old CSS imports with new consolidated ones -->
<head>
    <meta charset="UTF-8">
    <title>Rap Battle DB</title>
    
    <!-- Consolidated CSS -->
    <link rel="stylesheet" href="styles/base.css">
    <link rel="stylesheet" href="styles/components.css">
    <link rel="stylesheet" href="styles/responsive.css">
    
    <!-- External fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
</head>
```

**Step 7: Create Migration Guide**
Document in `docs/CSS_MIGRATION.md`:
```markdown
# CSS Migration Guide

## Changes from v1 to v2

### File Structure
- **Old:** `style.css`, `gstyle.css`, `gstyle_v2.css`
- **New:** `styles/base.css`, `styles/components.css`, `styles/responsive.css`

### CSS Variables
All colors, spacing, and fonts are now CSS variables:
```css
/* Example usage */
.my-element {
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: var(--spacing-md);
}
```

### Breaking Changes
None - all existing HTML should work without modification.

### Migration Steps
1. Update `<link>` tags in HTML
2. Test all pages in light mode
3. Test all pages in dark mode
4. Test responsive behavior
5. Delete old CSS files
```

**Step 8: Testing Checklist**
- [ ] All pages load correctly
- [ ] Dark mode works on all pages
- [ ] All buttons styled correctly
- [ ] Table displays properly
- [ ] Responsive breakpoints work
- [ ] Tooltips appear correctly
- [ ] No visual regressions
- [ ] CSS validates (W3C CSS Validator)
- [ ] File size reduction achieved

---

### ✅ **Fix 2.2: Consolidate JavaScript Files**

**Timeline:** 6 hours  
**Difficulty:** Hard  
**Impact:** HIGH - Massive maintenance improvement

#### Current State
- `script.js` (237 lines)
- `gscript.js` (224 lines)
- `gscript_v2.js` (338 lines)

Total: ~800 lines with 80% duplication

#### Implementation Steps

**Step 1: Create Modular Structure**
```
js/
├── core/
│   ├── csv-parser.js       # CSV parsing logic
│   ├── data-manager.js     # Data fetching and caching
│   └── error-handler.js    # Error handling utilities
├── ui/
│   ├── table-manager.js    # Table population and updates
│   ├── search.js           # Search functionality
│   ├── filters.js          # Filter logic
│   ├── sort.js             # Sorting logic
│   └── tooltips.js         # YouTube thumbnail tooltips
├── features/
│   ├── dark-mode.js        # Theme switching
│   └── url-params.js       # URL parameter handling
└── main.js                 # Main entry point and initialization
```

**Step 2: Create `js/core/csv-parser.js`**
```javascript
/**
 * CSV Parser Module
 * Uses PapaParse for robust CSV parsing
 */

const CSVParser = {
    /**
     * Parse CSV text into 2D array
     * @param {string} text - CSV text content
     * @param {object} options - Parser options
     * @returns {Array<Array<string>>} Parsed data
     */
    parse(text, options = {}) {
        const defaultOptions = {
            header: false,
            skipEmptyLines: true,
            dynamicTyping: false,
            trimHeaders: true,
            trimFields: true,
            delimiter: ',',
            quoteChar: '"',
            escapeChar: '"',
            comments: false,
            ...options
        };
        
        const result = Papa.parse(text, defaultOptions);
        
        if (result.errors.length > 0) {
            console.warn('CSV Parsing Warnings:', result.errors);
            
            // Filter out non-critical errors
            const criticalErrors = result.errors.filter(err => 
                err.type === 'Delimiter' || err.type === 'Quotes'
            );
            
            if (criticalErrors.length > 0) {
                throw new Error(`CSV Parsing failed: ${criticalErrors[0].message}`);
            }
        }
        
        return result.data;
    },
    
    /**
     * Validate CSV structure
     * @param {Array<Array<string>>} data - Parsed CSV data
     * @param {number} expectedColumns - Expected column count
     * @returns {object} Validation result
     */
    validate(data, expectedColumns = null) {
        if (!data || data.length === 0) {
            return { valid: false, error: 'CSV is empty' };
        }
        
        const headers = data[0];
        
        if (expectedColumns && headers.length !== expectedColumns) {
            return {
                valid: false,
                error: `Expected ${expectedColumns} columns, found ${headers.length}`
            };
        }
        
        // Check for consistent column counts
        const columnCounts = data.slice(1).map(row => row.length);
        const inconsistentRows = columnCounts.filter(count => count !== headers.length);
        
        if (inconsistentRows.length > 0) {
            console.warn(`${inconsistentRows.length} rows have inconsistent column counts`);
        }
        
        return { valid: true, headers: headers, rowCount: data.length - 1 };
    },
    
    /**
     * Convert CSV to objects with headers as keys
     * @param {Array<Array<string>>} data - Parsed CSV data
     * @returns {Array<object>} Array of objects
     */
    toObjects(data) {
        if (data.length < 2) {
            return [];
        }
        
        const headers = data[0];
        return data.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        });
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVParser;
}
```

**Step 3: Create `js/core/data-manager.js`**
```javascript
/**
 * Data Manager Module
 * Handles data fetching, caching, and management
 */

const DataManager = {
    csvData: [],
    currentData: [],
    dataSource: 'local',
    
    // Data sources configuration
    sources: {
        local: '/data/battle_events.csv',
        gsheet_v1: '/data/gsheet_battle_events.csv',
        gsheet_v2: '/data/gsheet_battle_events_v2.csv',
        online_v1: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTQCuvOmXn1mJTpP8Xsxs_hQGuGvKgWuvbb_ZwvuM2rCb0hBmNUOEKiyk25-hy5ljG-4tCuLqVwrRx/pub?gid=1245526804&single=true&output=csv',
        online_v2: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSCSU0I6H0UdK-smWWr5t1X97dnYMst2HXJ10UFLEzwt0_EnfAwGlxHhhhRbVYsZNUV7O98tBi5_vZT/pub?gid=1245526804&single=true&output=csv'
    },
    
    /**
     * Fetch data from URL
     * @param {string} source - Data source key or URL
     * @returns {Promise<Array>} Parsed CSV data
     */
    async fetchData(source) {
        const url = this.sources[source] || source;
        this.dataSource = source;
        
        ErrorHandler.showLoading();
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            
            if (!text || text.trim().length === 0) {
                throw new Error('CSV file is empty');
            }
            
            // Parse CSV
            const parsed = CSVParser.parse(text);
            
            // Validate structure
            const validation = CSVParser.validate(parsed, 13);
            if (!validation.valid) {
                throw new Error(`CSV validation failed: ${validation.error}`);
            }
            
            this.csvData = parsed;
            this.currentData = parsed;
            
            // Cache data
            this.cacheData(source, parsed);
            
            console.log(`✅ Loaded ${validation.rowCount} battles from ${source}`);
            
            return parsed;
            
        } catch (error) {
            ErrorHandler.logError('Data Fetch', error, { source, url });
            
            // Try to load from cache
            const cached = this.loadCachedData(source);
            if (cached) {
                console.log('⚠️ Loaded from cache due to fetch error');
                this.csvData = cached;
                this.currentData = cached;
                return cached;
            }
            
            throw error;
        }
    },
    
    /**
     * Cache data to localStorage
     * @param {string} key - Cache key
     * @param {Array} data - Data to cache
     */
    cacheData(key, data) {
        try {
            const cacheObj = {
                data: data,
                timestamp: Date.now(),
                version: '2.0'
            };
            localStorage.setItem(`cache_${key}`, JSON.stringify(cacheObj));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    },
    
    /**
     * Load cached data from localStorage
     * @param {string} key - Cache key
     * @returns {Array|null} Cached data or null
     */
    loadCachedData(key) {
        try {
            const cached = localStorage.getItem(`cache_${key}`);
            if (!cached) return null;
            
            const cacheObj = JSON.parse(cached);
            
            // Check if cache is less than 24 hours old
            const age = Date.now() - cacheObj.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (age > maxAge) {
                console.log('Cache expired');
                return null;
            }
            
            return cacheObj.data;
            
        } catch (error) {
            console.warn('Failed to load cached data:', error);
            return null;
        }
    },
    
    /**
     * Clear all cached data
     */
    clearCache() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('Cache cleared');
    },
    
    /**
     * Get current data
     * @returns {Array} Current data
     */
    getData() {
        return this.csvData;
    },
    
    /**
     * Get filtered/current data
     * @returns {Array} Current filtered data
     */
    getCurrentData() {
        return this.currentData;
    },
    
    /**
     * Set current data (for filtering)
     * @param {Array} data - Filtered data
     */
    setCurrentData(data) {
        this.currentData = data;
    },
    
    /**
     * Reset to full dataset
     */
    reset() {
        this.currentData = this.csvData;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
```

**Step 4: Create `js/core/error-handler.js`**
```javascript
/**
 * Error Handler Module
 * Centralized error handling and user feedback
 */

const ErrorHandler = {
    /**
     * Show error in table
     * @param {string} message - Error message
     * @param {object} action - Optional action button {text, callback}
     */
    showTableError(message, action = null) {
        const tableBody = document.getElementById('data-table')?.getElementsByTagName('tbody')[0];
        if (!tableBody) return;
        
        let actionHTML = '';
        if (action) {
            actionHTML = `
                <button onclick="${action.callback}" 
                        style="margin-top: 20px; padding: 10px 20px; 
                               background: var(--accent-primary); color: white; 
                               border: none; border-radius: 4px; cursor: pointer;
                               font-family: var(--font-family);">
                    ${action.text}
                </button>
            `;
        }
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 20px; font-weight: 600; 
                                color: var(--accent-danger); margin-bottom: 10px;">
                        Error Loading Data
                    </div>
                    <div style="color: var(--text-secondary); margin-bottom: 20px; 
                                max-width: 500px; margin-left: auto; margin-right: auto;">
                        ${message}
                    </div>
                    ${actionHTML}
                </td>
            </tr>
        `;
    },
    
    /**
     * Show empty state
     * @param {string} searchTerm - Search term (if applicable)
     */
    showEmptyState(searchTerm = '') {
        const tableBody = document.getElementById('data-table')?.getElementsByTagName('tbody')[0];
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
                    <div style="font-size: 18px; color: var(--text-secondary); margin-bottom: 10px;">
                        No battles found
                    </div>
                    <div style="color: var(--text-tertiary);">
                        ${searchTerm ? `No results for "<strong>${searchTerm}</strong>"` : 'Try adjusting your filters'}
                    </div>
                </td>
            </tr>
        `;
    },
    
    /**
     * Show loading state
     */
    showLoading() {
        const tableBody = document.getElementById('data-table')?.getElementsByTagName('tbody')[0];
        if (!tableBody) return;
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 60px 20px;">
                    <div class="loading-spinner"></div>
                    <div style="color: var(--text-secondary); margin-top: 20px;">
                        Loading battles...
                    </div>
                </td>
            </tr>
        `;
    },
    
    /**
     * Log error with context
     * @param {string} context - Error context
     * @param {Error} error - Error object
     * @param {object} data - Additional data
     */
    logError(context, error, data = {}) {
        console.error(`❌ [${context}]`, {
            message: error.message,
            stack: error.stack,
            ...data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    },
    
    /**
     * Show toast notification
     * @param {string} message - Notification message
     * @param {string} type - Type: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: var(--shadow-md);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
};

// Add CSS for loading spinner and toasts
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        border: 4px solid var(--border-color);
        border-top: 4px solid var(--accent-primary);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
```

**Step 5: Create Main Entry Point**
`js/main.js`:
```javascript
/**
 * Rap Battle DB - Main Entry Point
 * Version: 2.0
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        dataSource: 'gsheet_v2', // Default data source
        enableCache: true,
        enableAnalytics: true
    };
    
    // Initialize app
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🎯 Initializing Rap Battle DB v2.0');
        
        try {
            // Initialize dark mode
            DarkMode.init();
            
            // Get URL parameters
            const urlParams = URLParams.getAll();
            const searchText = urlParams.search || '';
            const dataSource = urlParams.source || CONFIG.dataSource;
            
            // Initialize UI components
            initializeEventListeners();
            
            // Fetch initial data
            await DataManager.fetchData(dataSource);
            
            // Apply filters and display
            Filters.applyInitialFilters(urlParams);
            
            // Initialize features
            Tooltips.init();
            
            // Load last updated info
            loadLastUpdated();
            
            console.log('✅ Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError('Initialization', error);
            ErrorHandler.showTableError(
                'Failed to initialize application. Please refresh the page.',
                { text: 'Refresh', callback: 'location.reload()' }
            );
        }
    });
    
    /**
     * Initialize all event listeners
     */
    function initializeEventListeners() {
        const searchBox = document.getElementById('searchBox');
        const sortUploadedBtn = document.getElementById('sort-uploaded');
        const sortViewsBtn = document.getElementById('sort-views');
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        
        // Search
        if (searchBox) {
            searchBox.addEventListener('input', Search.handleSearch);
        }
        
        // Sort buttons
        if (sortUploadedBtn) {
            sortUploadedBtn.addEventListener('click', () => Sort.byUploaded());
        }
        
        if (sortViewsBtn) {
            sortViewsBtn.addEventListener('click', () => Sort.byViews());
        }
        
        // Dark mode
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', DarkMode.toggle);
        }
        
        // Filter buttons
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                Filters.apply(this.getAttribute('data-filter'));
            });
        });
        
        // Network status
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    }
    
    /**
     * Load last updated timestamp
     */
    async function loadLastUpdated() {
        try {
            const response = await fetch('info.yml');
            const yamlText = await response.text();
            const yamlData = jsyaml.load(yamlText);
            const lastUpdatedTime = yamlData.last_updated_time;
            const formattedDateTime = lastUpdatedTime.replace(
                /(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})/, 
                '$1 $2:$3'
            );
            document.getElementById('last-updated').textContent = 
                `Last updated: ${formattedDateTime}`;
        } catch (error) {
            console.warn('Failed to load last updated time:', error);
        }
    }
    
    /**
     * Handle online event
     */
    function handleOnline() {
        console.log('✅ Back online');
        ErrorHandler.showToast('Connection restored', 'success');
        
        const data = DataManager.getData();
        if (!data || data.length === 0) {
            location.reload();
        }
    }
    
    /**
     * Handle offline event
     */
    function handleOffline() {
        console.log('⚠️ Connection lost');
        ErrorHandler.showToast('You are offline. Data may be outdated.', 'warning', 5000);
    }
    
})();
```

**Step 6: Update HTML Files**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Rap Battle DB</title>
    
    <!-- Analytics -->
    <script defer data-domain="battledb.xyz" src="https://plausible.jkl.ink/js/script.js"></script>
    
    <!-- External Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js"></script>
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    
    <!-- Styles -->
    <link rel="stylesheet" href="styles/base.css">
    <link rel="stylesheet" href="styles/components.css">
    <link rel="stylesheet" href="styles/responsive.css">
    
    <!-- Icon -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎯</text></svg>">
</head>
<body>
    <!-- ... HTML content ... -->
    
    <!-- Scripts - Order matters -->
    <script src="js/core/csv-parser.js"></script>
    <script src="js/core/error-handler.js"></script>
    <script src="js/core/data-manager.js"></script>
    <script src="js/ui/table-manager.js"></script>
    <script src="js/ui/search.js"></script>
    <script src="js/ui/filters.js"></script>
    <script src="js/ui/sort.js"></script>
    <script src="js/ui/tooltips.js"></script>
    <script src="js/features/dark-mode.js"></script>
    <script src="js/features/url-params.js"></script>
    <script src="js/main.js"></script>
</body>
</html>
```

**Step 7: Testing**
- [ ] All pages work with new structure
- [ ] No JavaScript errors in console
- [ ] All features work (search, filter, sort)
- [ ] Dark mode works
- [ ] Tooltips work
- [ ] Error handling works
- [ ] Performance is same or better
- [ ] File size reduced

**Step 8: Documentation**
Create `docs/JS_ARCHITECTURE.md` documenting the new structure.

---

### ✅ **Fix 2.3: Create Build Process**

**Timeline:** 2 hours  
**Difficulty:** Medium  
**Impact:** MEDIUM - Better developer experience

#### Implementation Steps

**Step 1: Create `package.json`**
```json
{
  "name": "rap-battle-db",
  "version": "2.0.0",
  "description": "German Rap Battle Database - battledb.xyz",
  "main": "index.html",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint:css": "stylelint '**/*.css'",
    "lint:js": "eslint 'js/**/*.js'",
    "validate:data": "node scripts/validate-csv.js",
    "deploy": "npm run build && netlify deploy --prod"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/dltlly.git"
  },
  "keywords": [
    "rap-battle",
    "database",
    "german-rap",
    "dltlly"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "vite": "^5.0.0",
    "eslint": "^8.55.0",
    "stylelint": "^16.0.0",
    "stylelint-config-standard": "^36.0.0"
  },
  "dependencies": {}
}
```

**Step 2: Create `vite.config.js`**
```javascript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        gindex: resolve(__dirname, 'gindex_v2.html'),
        subpage: resolve(__dirname, 'subpage.html')
      }
    }
  },
  
  server: {
    port: 3000,
    open: true
  },
  
  preview: {
    port: 8080
  }
});
```

**Step 3: Create `.eslintrc.json`**
```json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off",
    "semi": ["error", "always"],
    "quotes": ["error", "single"]
  },
  "globals": {
    "Papa": "readonly",
    "jsyaml": "readonly"
  }
}
```

**Step 4: Create `.stylelintrc.json`**
```json
{
  "extends": "stylelint-config-standard",
  "rules": {
    "color-hex-length": "short",
    "declaration-no-important": true,
    "max-nesting-depth": 3
  }
}
```

**Step 5: Create `scripts/validate-csv.js`**
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../data/battle_events.csv');

function validateCSV() {
    console.log('🔍 Validating CSV file...\n');
    
    if (!fs.existsSync(CSV_PATH)) {
        console.error('❌ CSV file not found:', CSV_PATH);
        process.exit(1);
    }
    
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    console.log(`📊 Total rows: ${lines.length}`);
    console.log(`📊 Data rows: ${lines.length - 1}\n`);
    
    // Check headers
    const headers = lines[0].split(',');
    const expectedHeaders = [
        'Name #1', 'Name #2', 'Event', 'Type', 'Year', 
        'Channel', 'Uploaded', 'URL', 'ID', 'Views'
    ];
    
    const headerCheck = expectedHeaders.every(h => 
        headers.some(header => header.trim() === h)
    );
    
    if (!headerCheck) {
        console.warn('⚠️  Headers may be incorrect');
        console.log('Expected:', expectedHeaders.join(', '));
        console.log('Got:', headers.join(', '));
    } else {
        console.log('✅ Headers are correct');
    }
    
    // Check for inconsistent column counts
    const headerCount = headers.length;
    let inconsistentRows = 0;
    
    lines.slice(1).forEach((line, index) => {
        const columns = line.split(',').length;
        if (columns !== headerCount) {
            inconsistentRows++;
            if (inconsistentRows <= 5) {
                console.warn(`⚠️  Row ${index + 2}: ${columns} columns (expected ${headerCount})`);
            }
        }
    });
    
    if (inconsistentRows > 5) {
        console.warn(`⚠️  ... and ${inconsistentRows - 5} more rows with issues`);
    }
    
    if (inconsistentRows === 0) {
        console.log('✅ All rows have consistent column counts');
    }
    
    console.log('\n✅ Validation complete');
}

validateCSV();
```

**Step 6: Create `netlify.toml`**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

**Step 7: Usage**
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint CSS
npm run lint:css

# Lint JavaScript
npm run lint:js

# Validate CSV data
npm run validate:data

# Deploy to Netlify
npm run deploy
```

---

## 📋 PRIORITY 3: Feature Enhancements (Week 3-4, ~16-20 hours)

### ✅ **Feature 3.1: Advanced Search & Filters**

**Timeline:** 6 hours  
**Difficulty:** Medium  
**Impact:** HIGH - Much requested feature

### ✅ **Feature 3.2: Performance Optimization**

**Timeline:** 4 hours  
**Difficulty:** Medium  
**Impact:** MEDIUM - Better UX

### ✅ **Feature 3.3: Analytics Dashboard**

**Timeline:** 6 hours  
**Difficulty:** Medium  
**Impact:** MEDIUM - User insights

---

## 📋 PRIORITY 4: Documentation & Polish (Week 5, ~8-10 hours)

### ✅ **Doc 4.1: Complete README**

**Timeline:** 2 hours  

### ✅ **Doc 4.2: Contributing Guidelines**

**Timeline:** 2 hours  

### ✅ **Doc 4.3: Data Update Process**

**Timeline:** 2 hours  

### ✅ **Doc 4.4: API Documentation**

**Timeline:** 2 hours  

---

## 📊 Success Metrics

### Performance Targets
- **Page Load:** < 2 seconds
- **Search Response:** < 100ms
- **File Size Reduction:** 30%+
- **Code Duplication:** < 10%

### Quality Targets
- **W3C Validation:** Pass
- **Lighthouse Score:** 90+
- **Accessibility Score:** 90+
- **Test Coverage:** 60%+

---

## 🗓️ Implementation Roadmap

### Week 1: Critical Fixes
- [Priority 1] All critical bug fixes
- **Deliverable:** Stable, bug-free application

### Week 2: Code Consolidation
- [Priority 2] CSS/JS consolidation
- [Priority 2] Build process
- **Deliverable:** Maintainable codebase

### Week 3-4: Features
- [Priority 3] Advanced filters
- [Priority 3] Performance optimization
- [Priority 3] Analytics
- **Deliverable:** Enhanced user experience

### Week 5: Documentation
- [Priority 4] All documentation
- **Deliverable:** Production-ready project

---

## 🎯 Quick Wins (< 2 hours each)

1. ✅ Fix CSV parser (2 hours)
2. ✅ Remove test.html (5 min)
3. ✅ Fix duplicate event listeners (1 hour)
4. ✅ Add error messages (1 hour)
5. ✅ Fix column display (1 hour)

---

## 📝 Notes & Considerations

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ features used
- No IE11 support needed

### Deployment
- Netlify hosting
- Automatic deployments from main branch
- Preview deployments for PRs

### Future Considerations
- Backend API for better data management
- User accounts & favorites
- Mobile app
- Battle predictions/rankings

---

## 📚 Resources

### Documentation
- [PapaParse Docs](https://www.papaparse.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)
- [Netlify Docs](https://docs.netlify.com/)

### Tools
- [W3C CSS Validator](https://jigsaw.w3.org/css-validator/)
- [W3C HTML Validator](https://validator.w3.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

---

**Document Version:** 1.0  
**Last Updated:** October 5, 2025  
**Maintained By:** Development Team

