let swots = [];
let currentEditId = null;
let currentLang = localStorage.getItem('swotLang') || 'cs';

function init() {
    const savedData = localStorage.getItem('swotsData');
    if (savedData) {
        swots = JSON.parse(savedData);
    }
    updateTranslations();
    renderDashboard();
}

function saveToStorage() {
    localStorage.setItem('swotsData', JSON.stringify(swots));
}

function renderDashboard() {
    const dashboard = document.getElementById('dashboard');
    dashboard.innerHTML = ''; 

    const addCard = document.createElement('div');
    addCard.className = 'card card-add';
    addCard.onclick = openNewEditor;
    addCard.innerHTML = `<div class="add-icon"></div>`;
    dashboard.appendChild(addCard);

    swots.forEach(swot => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${swot.title || translations[currentLang].untitled}</h3>
            <div class="swot-mini" onclick="openEditor(${swot.id})">
                <div class="mini-s">S</div>
                <div class="mini-w">W</div>
                <div class="mini-o">O</div>
                <div class="mini-t">T</div>
            </div>
            <div class="card-actions">
                <button class="icon-btn delete" onclick="deleteSwot(${swot.id}, event)" title="Smazat">🗑️</button>
                <button class="icon-btn" onclick="openEditor(${swot.id})" title="Upravit">✏️</button>
            </div>
        `;
        dashboard.appendChild(card);
    });
}

// --- LIST MANAGEMENT ---
function addListItem(containerId, placeholderText = "", value = "", focus = true) {
    const container = document.getElementById(containerId);
    
    // Resolve placeholder by container type if not provided
    if (!placeholderText) {
        const type = containerId.replace('list', '').toLowerCase();
        placeholderText = translations[currentLang][type + 'Placeholder'];
    }
    
    const div = document.createElement('div');
    div.className = 'swot-item';
    
    div.draggable = true;
    div.ondragstart = function(event) {
        const textarea = div.querySelector('textarea');
        let text = textarea.value.trim();
        if (!text) {
            event.preventDefault();
            return;
        }
        const type = containerId.replace('list', ''); 
        currentDraggedType = type;
        event.dataTransfer.setData('application/json', JSON.stringify({ type: type, text: text }));
        event.dataTransfer.effectAllowed = 'copy';
        setTimeout(() => div.classList.add('dragging'), 0);
    };
    div.ondragend = function() {
        div.classList.remove('dragging');
        currentDraggedType = null;
        document.querySelectorAll('.drag-over-valid').forEach(el => el.classList.remove('drag-over-valid'));
    };

    div.ondragover = function(event) {
        event.preventDefault(); 
    };

    div.ondragenter = function(event) {
        event.preventDefault();
        const targetType = containerId.replace('list', '');
        if (getStrategyType(currentDraggedType, targetType)) {
            div.classList.add('drag-over-valid');
        }
    };

    div.ondragleave = function(event) {
        // Prevent flickering randomly when dragging over inner text
        if (!event.relatedTarget || !div.contains(event.relatedTarget)) {
            div.classList.remove('drag-over-valid');
        }
    };

    div.ondrop = function(event) {
        event.preventDefault();
        event.stopPropagation();
        div.classList.remove('drag-over-valid');
        
        const data = event.dataTransfer.getData('application/json');
        if (!data) return;
        
        try {
            const sourcePayload = JSON.parse(data);
            const targetType = containerId.replace('list', '');
            const strategyType = getStrategyType(sourcePayload.type, targetType);
            
            if (strategyType) {
                const targetText = div.querySelector('textarea').value.trim();
                const targetPayload = { type: targetType, text: targetText };
                
                addStrategyItem(`list${strategyType}`, [sourcePayload, targetPayload], "");
                
                // Highlight matrix area briefly
                const strategyBox = document.querySelector(`.box-${strategyType.toLowerCase()}`);
                if (strategyBox) {
                    strategyBox.style.outline = '3px solid var(--primary)';
                    strategyBox.style.outlineOffset = '2px';
                    setTimeout(() => strategyBox.style.outline = 'none', 1000);
                }
            } else if (sourcePayload.type === targetType) {
                 // reordering could be handled here
            }
        } catch(e) {}
    };
    
    div.innerHTML = `
        <textarea placeholder="${placeholderText}" oninput="autoResize(this)"></textarea>
        <div class="item-controls">
            <button class="ctrl-btn" onclick="moveItemUp(this)" title="Posunout nahoru">↑</button>
            <button class="ctrl-btn" onclick="moveItemDown(this)" title="Posunout dolů">↓</button>
            <button class="ctrl-btn danger" onclick="deleteItem(this)" title="Smazat">✖</button>
        </div>
    `;
    
    const textarea = div.querySelector('textarea');
    textarea.value = value;
    
    container.appendChild(div);
    autoResize(textarea); // Initial resize for loaded data

    if (focus) {
        textarea.focus();
    }
}

function moveItemUp(btn) {
    const item = btn.closest('.swot-item');
    const prev = item.previousElementSibling;
    if (prev) {
        item.parentNode.insertBefore(item, prev);
    }
}

function moveItemDown(btn) {
    const item = btn.closest('.swot-item');
    const next = item.nextElementSibling;
    if (next) {
        item.parentNode.insertBefore(next, item); 
    }
}

function deleteItem(btn) {
    const item = btn.closest('.swot-item') || btn.closest('.strategy-item');
    if (item) item.remove();
}

function getListData(containerId) {
    const container = document.getElementById(containerId);
    const textareas = container.querySelectorAll('textarea');
    const values = Array.from(textareas)
        .map(ta => ta.value.trim())
        .filter(val => val !== '');
    return values.join('\n');
}

function populateList(containerId, textData, defaultPlaceholder) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 

    if (textData && textData.trim() !== '') {
        const items = textData.split('\n');
        items.forEach(text => {
            addListItem(containerId, defaultPlaceholder, text, false);
        });
    } else {
        addListItem(containerId, defaultPlaceholder, "", false);
    }
}

function toggleExpand(btn) {
    const box = btn.closest('.swot-box');
    const isExpanded = box.classList.toggle('is-expanded');

    if (isExpanded) {
        btn.innerHTML = '⤡ Skrýt posuvník';
    } else {
        btn.innerHTML = '⤢ Zobrazit vše';
    }
}

function autoResize(textarea) {
    const isStrategy = textarea.closest('.strategy-item');
    
    if (isStrategy) {
        // Logic for strategies: grow up to ~4-5 lines, then scroll
        textarea.style.height = 'auto';
        let contentHeight = textarea.scrollHeight;
        if (contentHeight > 120) {
            textarea.style.height = '120px';
            textarea.style.overflowY = 'auto';
        } else {
            textarea.style.height = Math.max(38, contentHeight) + 'px';
            textarea.style.overflowY = 'hidden';
        }
    } else {
        // Original logic for SWOT points (S,W,O,T) to maintain row height
        textarea.style.height = '22px'; 
        if (textarea.scrollHeight > 22) {
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    }
}

function resizeAllTextareas() {
    document.querySelectorAll('.swot-item textarea, .strategy-item textarea').forEach(ta => autoResize(ta));
}

function resetToggles() {
    document.querySelectorAll('.swot-box').forEach(box => {
        box.classList.remove('is-expanded');
        const btn = box.querySelector('.toggle-btn');
        if (btn) btn.innerHTML = translations[currentLang].expandBtn;
    });
}

function openNewEditor() {
    currentEditId = null;
    document.getElementById('swotTitle').value = '';
    
    populateList('listS', '');
    populateList('listW', '');
    populateList('listO', '');
    populateList('listT', '');
    
    populateStrategies('listSO', []);
    populateStrategies('listWO', []);
    populateStrategies('listST', []);
    populateStrategies('listWT', []);
    
    showEditor();
    resetToggles();
}

function openEditor(id) {
    currentEditId = id;
    const swot = swots.find(s => s.id === id);
    
    if (swot) {
        document.getElementById('swotTitle').value = swot.title;
        
        populateList('listS', swot.s);
        populateList('listW', swot.w);
        populateList('listO', swot.o);
        populateList('listT', swot.t);
        
        populateStrategies('listSO', swot.so || []);
        populateStrategies('listWO', swot.wo || []);
        populateStrategies('listST', swot.st || []);
        populateStrategies('listWT', swot.wt || []);
        
        showEditor();
        resetToggles();
        setTimeout(resizeAllTextareas, 10); 
    }
}

function saveSwot() {
    const title = document.getElementById('swotTitle').value.trim();
    if (!title) {
        alert(translations[currentLang].alertNoTitle);
        return;
    }

    const swotData = {
        title: title,
        s: getListData('listS'),
        w: getListData('listW'),
        o: getListData('listO'),
        t: getListData('listT'),
        so: getStrategyData('listSO'),
        wo: getStrategyData('listWO'),
        st: getStrategyData('listST'),
        wt: getStrategyData('listWT'),
    };

    if (currentEditId) {
        const index = swots.findIndex(s => s.id === currentEditId);
        swots[index] = { ...swots[index], ...swotData };
    } else {
        swotData.id = Date.now();
        swots.push(swotData);
    }

    saveToStorage();
    closeEditor();
}

function deleteSwot(id, event) {
    event.stopPropagation(); 
    if (confirm(translations[currentLang].confirmDelete)) {
        swots = swots.filter(s => s.id !== id);
        saveToStorage();
        renderDashboard();
    }
}

function showEditor() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('headerActions').style.display = 'none';
    document.getElementById('editor').style.display = 'flex';
    document.getElementById('mainTitle').innerText = translations[currentLang].editorTitle;
}

function closeEditor() {
    currentEditId = null;
    document.getElementById('dashboard').style.display = 'grid';
    document.getElementById('headerActions').style.display = 'flex';
    document.getElementById('editor').style.display = 'none';
    document.getElementById('mainTitle').innerText = translations[currentLang].appTitle;
    renderDashboard();
}

// --- STRATEGY LOGIC & DRAG & DROP ---

function getStrategyType(type1, type2) {
    if ((type1 === 'S' && type2 === 'O') || (type1 === 'O' && type2 === 'S')) return 'SO';
    if ((type1 === 'W' && type2 === 'O') || (type1 === 'O' && type2 === 'W')) return 'WO';
    if ((type1 === 'S' && type2 === 'T') || (type1 === 'T' && type2 === 'S')) return 'ST';
    if ((type1 === 'W' && type2 === 'T') || (type1 === 'T' && type2 === 'W')) return 'WT';
    return null;
}

function allowDrop(event) {
    event.preventDefault();
}

function dropNewStrategy(event, targetType) {
    event.preventDefault();
    
    if (event.target.closest('.strategy-tags')) return;
    
    const data = event.dataTransfer.getData('application/json');
    if (!data) return;
    
    try {
        const payload = JSON.parse(data);
        if (targetType.includes(payload.type)) {
             addStrategyItem(`list${targetType}`, [payload], "");
        } else {
             let msg = translations[currentLang].validityAlert.replace('${type}', payload.type).replace('${target}', targetType);
             alert(msg);
        }
    } catch(e) {}
}

function dropOnItem(event, itemDiv, targetType) {
    event.preventDefault();
    event.stopPropagation();
    
    const data = event.dataTransfer.getData('application/json');
    if (!data) return;
    
    try {
        const payload = JSON.parse(data);
        if (targetType.includes(payload.type)) {
             addTagToStrategy(itemDiv.querySelector('.strategy-tags'), payload);
        } else {
             let msg = translations[currentLang].validityAlert.replace('${type}', payload.type).replace('${target}', targetType);
             alert(msg);
        }
    } catch(e) {}
}

function addStrategyItem(containerId, tags = [], text = "") {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    const targetType = containerId.replace('list', '');
    
    div.className = 'strategy-item';
    div.ondragover = allowDrop;
    div.ondrop = function(e) { dropOnItem(e, div, targetType); };
    
    div.innerHTML = `
        <div class="strategy-tags"></div>
        <textarea placeholder="Co z toho vyplývá za strategii?, např. Investovat do..." oninput="autoResize(this)"></textarea>
        <div class="item-controls" style="align-self: flex-end; margin-top: 4px;">
            <button class="ctrl-btn danger" onclick="deleteItem(this)" title="Smazat">✖</button>
        </div>
    `;
    
    const tagsContainer = div.querySelector('.strategy-tags');
    if (tags && tags.length > 0) {
        tags.forEach(tag => addTagToStrategy(tagsContainer, tag));
    } else {
        tagsContainer.innerHTML = `<span class="empty-tags-hint">${translations[currentLang].emptyTagsHint}</span>`;
    }
    
    const textarea = div.querySelector('textarea');
    textarea.value = text;
    
    container.appendChild(div);
    autoResize(textarea);
}

function addTagToStrategy(tagsContainer, tagData) {
    const hint = tagsContainer.querySelector('.empty-tags-hint');
    if (hint) hint.remove();

    const span = document.createElement('span');
    span.className = `strategy-tag tag-${tagData.type.toLowerCase()}`;
    span.dataset.type = tagData.type;
    span.dataset.fulltext = tagData.text;
    
    const trunText = tagData.text.length > 35 ? tagData.text.substring(0, 35) + '...' : tagData.text;
    span.innerHTML = `<strong>${tagData.type}:</strong> <span class="tag-text">${trunText}</span> <span class="remove-tag" onclick="removeTag(this)">✖</span>`;
    
    tagsContainer.appendChild(span);
}

function removeTag(btn) {
    const tagsContainer = btn.closest('.strategy-tags');
    btn.closest('.strategy-tag').remove();
    if (tagsContainer.children.length === 0) {
        tagsContainer.innerHTML = `<span class="empty-tags-hint">${translations[currentLang].emptyTagsHint}</span>`;
    }
}

function getStrategyData(containerId) {
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll('.strategy-item');
    const data = [];
    
    items.forEach(item => {
        const text = item.querySelector('textarea').value.trim();
        const tagElements = item.querySelectorAll('.strategy-tag');
        const tags = Array.from(tagElements).map(el => ({
            type: el.dataset.type,
            text: el.dataset.fulltext
        }));
        
        if (text !== '' || tags.length > 0) {
            data.push({ text, tags });
        }
    });
    
    return data;
}

function populateStrategies(containerId, strategiesData) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (strategiesData && Array.isArray(strategiesData)) {
        strategiesData.forEach(strat => {
            addStrategyItem(containerId, strat.tags, strat.text);
        });
    }
}

// --- EXPORT & IMPORT ---

function exportData() {
    if (swots.length === 0) {
        alert(translations[currentLang].noDataExport);
        return;
    }
    const dataStr = JSON.stringify(swots, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'swot_data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function triggerImport() {
    document.getElementById('importFile').click();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedSwots = JSON.parse(e.target.result);
            if (Array.isArray(importedSwots)) {
                if (confirm(translations[currentLang].confirmImport)) {
                    swots = importedSwots;
                    saveToStorage();
                    renderDashboard();
                    alert(translations[currentLang].importSuccess);
                }
            } else {
                alert(translations[currentLang].importTypeError);
            }
        } catch (error) {
            alert(translations[currentLang].importError + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset inputu
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('swotLang', lang);
    updateTranslations();
    renderDashboard();
    
    // Refresh editor ONLY if it is currently visible
    if (document.getElementById('editor').style.display === 'flex') {
        if (currentEditId) {
            openEditor(currentEditId);
        } else {
            openNewEditor();
        }
    }
}

function updateTranslations() {
    const lang = translations[currentLang];
    
    // Update texts
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang[key]) el.innerHTML = lang[key];
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (lang[key]) el.placeholder = lang[key];
    });

    // Toggle active button
    document.getElementById('lang-cs').classList.toggle('active', currentLang === 'cs');
    document.getElementById('lang-en').classList.toggle('active', currentLang === 'en');
}

window.onload = init;