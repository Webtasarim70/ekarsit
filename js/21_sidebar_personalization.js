/* ============================================================
   Sidebar kişiselleştirme
   Tercihler seçili kullanıcı klasörüne göre localStorage'da saklanır.
   ============================================================ */
(function(){
  const STORAGE_PREFIX = 'ekarsit-sidebar-preferences-v1:';
  let settingsOpen = false;
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const currentUserKey = () => {
    try {
      const folder = typeof userStore !== 'undefined' ? userStore.directoryHandle?.name : '';
      const user = typeof userStore !== 'undefined' ? userStore.info?.kullanici : '';
      return STORAGE_PREFIX + (folder || user || 'default');
    } catch (e) {
      return STORAGE_PREFIX + 'default';
    }
  };
  const readPreferences = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(currentUserKey()) || '{}');
      return {
        order: Array.isArray(parsed.order) ? parsed.order : [],
        hiddenGroups: Array.isArray(parsed.hiddenGroups) ? parsed.hiddenGroups : [],
        hiddenItems: Array.isArray(parsed.hiddenItems) ? parsed.hiddenItems : []
      };
    } catch (e) {
      return { order: [], hiddenGroups: [], hiddenItems: [] };
    }
  };
  const savePreferences = prefs => {
    try { localStorage.setItem(currentUserKey(), JSON.stringify(prefs)); }
    catch (e) { alert('Menü tercihleri bu tarayıcıda kaydedilemedi.'); }
  };
  const make = (tag, text, style) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (style) node.style.cssText = style;
    return node;
  };
  const itemLabel = item => {
    const children = Array.from(item.children || []);
    const labelNode = children.find(child => !child.classList.contains('num') && !child.id?.includes('badge'));
    return normalize(labelNode?.textContent || item.textContent);
  };
  const getGroups = nav => Array.from(nav.children).filter(node => !node.classList.contains('sidebar-personalize-toolbar'));
  const groupLabel = group => {
    const first = group.querySelector('.nav-item');
    return first ? itemLabel(first) : '';
  };
  const itemKey = (groupId, item) => groupId + '::' + itemLabel(item);

  function applyPreferencesAndToolbar(){
    const nav = document.getElementById('step-nav');
    if (!nav) return;
    nav.querySelector('.sidebar-personalize-toolbar')?.remove();
    const prefs = readPreferences();
    const groups = getGroups(nav);
    const ids = groups.map(groupLabel);
    const currentOrder = [...prefs.order.filter(id => ids.includes(id)), ...ids.filter(id => !prefs.order.includes(id))];
    currentOrder.forEach(id => {
      const group = groups.find(node => groupLabel(node) === id);
      if (group) nav.appendChild(group);
    });
    const reorderedGroups = getGroups(nav);
    reorderedGroups.forEach(group => {
      const id = groupLabel(group);
      group.style.display = prefs.hiddenGroups.includes(id) ? 'none' : '';
      const items = Array.from(group.querySelectorAll('.nav-item'));
      const hasChildren = items.length > 1;
      items.forEach((item, index) => {
        // Alt menü bağlantıları gizlenebilir; grup başlığı ayrı bir görünürlük ayarına sahiptir.
        if (hasChildren && index === 0) return;
        item.style.display = prefs.hiddenItems.includes(itemKey(id, item)) ? 'none' : '';
      });
    });

    const toolbar = make('div', undefined, 'position:sticky;top:0;z-index:5;padding:8px 8px 10px;background:var(--panel);border-bottom:1px solid var(--border);');
    toolbar.className = 'sidebar-personalize-toolbar';
    const toggle = make('button', settingsOpen ? '× Menü Ayarlarını Kapat' : '⚙ Menüyü Kişiselleştir');
    toggle.type = 'button';
    toggle.title = settingsOpen ? 'Menü ayarlarını kapat' : 'Menüyü kişiselleştir';
    toggle.setAttribute('aria-expanded', String(settingsOpen));
    toggle.style.cssText = 'width:100%;padding:9px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font:inherit;font-weight:700;cursor:pointer;';
    toggle.addEventListener('click', () => { settingsOpen = !settingsOpen; window.renderNav(); });
    toolbar.appendChild(toggle);

    if (settingsOpen) {
      const panel = make('div', undefined, 'margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);');
      panel.appendChild(make('div', 'Menü düzeni', 'font-weight:700;margin-bottom:4px;'));
      panel.appendChild(make('p', 'Bölümleri oklarla sıralayın; kullanmadığınız bölüm veya bağlantıları gizleyin. Alt bağlantı ayarları için ilgili menü bölümünü önce genişletin.', 'font-size:12px;line-height:1.45;color:var(--muted);margin:0 0 10px;'));
      const list = make('div', undefined, 'display:flex;flex-direction:column;gap:8px;');
      const liveGroups = getGroups(nav);
      liveGroups.forEach((group, index) => {
        const id = groupLabel(group);
        const row = make('div', undefined, 'border:1px solid var(--border);border-radius:7px;padding:7px;');
        const top = make('div', undefined, 'display:flex;align-items:center;gap:6px;');
        const groupCheck = make('input');
        groupCheck.type = 'checkbox';
        groupCheck.checked = !prefs.hiddenGroups.includes(id);
        groupCheck.setAttribute('aria-label', id + ' bölümünü göster');
        groupCheck.addEventListener('change', () => {
          const next = readPreferences();
          next.hiddenGroups = groupCheck.checked ? next.hiddenGroups.filter(x => x !== id) : [...new Set([...next.hiddenGroups, id])];
          savePreferences(next); window.renderNav();
        });
        top.appendChild(groupCheck);
        const name = make('span', id, 'flex:1;font-size:13px;font-weight:600;');
        top.appendChild(name);
        const up = make('button', '↑');
        up.type = 'button'; up.title = 'Bölümü yukarı taşı'; up.disabled = index === 0;
        const down = make('button', '↓');
        down.type = 'button'; down.title = 'Bölümü aşağı taşı'; down.disabled = index === liveGroups.length - 1;
        [up, down].forEach(btn => { btn.style.cssText = 'min-width:30px;padding:4px;border:1px solid var(--border);border-radius:5px;background:var(--panel);color:var(--text);cursor:pointer;'; });
        up.addEventListener('click', () => moveGroup(id, -1));
        down.addEventListener('click', () => moveGroup(id, 1));
        top.appendChild(up); top.appendChild(down);
        row.appendChild(top);

        const items = Array.from(group.querySelectorAll('.nav-item'));
        const hasChildren = items.length > 1;
        const children = hasChildren ? items.slice(1) : items;
        if (children.length) {
          const sub = make('div', undefined, 'margin:7px 0 0 20px;display:flex;flex-direction:column;gap:5px;');
          children.forEach(item => {
            const key = itemKey(id, item);
            const line = make('label', undefined, 'display:flex;align-items:flex-start;gap:6px;font-size:12px;line-height:1.35;');
            const check = make('input');
            check.type = 'checkbox'; check.checked = !prefs.hiddenItems.includes(key);
            check.addEventListener('change', () => {
              const next = readPreferences();
              next.hiddenItems = check.checked ? next.hiddenItems.filter(x => x !== key) : [...new Set([...next.hiddenItems, key])];
              savePreferences(next); window.renderNav();
            });
            line.appendChild(check); line.appendChild(make('span', itemLabel(item)));
            sub.appendChild(line);
          });
          row.appendChild(sub);
        }
        list.appendChild(row);
      });
      panel.appendChild(list);
      const reset = make('button', 'Varsayılan menü düzenine dön');
      reset.type = 'button';
      reset.style.cssText = 'margin-top:10px;width:100%;padding:8px;border:1px solid var(--border);border-radius:7px;background:var(--panel);color:var(--text);cursor:pointer;';
      reset.addEventListener('click', () => {
        try { localStorage.removeItem(currentUserKey()); } catch (e) {}
        window.renderNav();
      });
      panel.appendChild(reset);
      toolbar.appendChild(panel);
    }
    nav.insertBefore(toolbar, nav.firstChild);
  }

  function moveGroup(id, delta){
    const prefs = readPreferences();
    const nav = document.getElementById('step-nav');
    if (!nav) return;
    const ids = getGroups(nav).map(groupLabel);
    const order = [...prefs.order.filter(x => ids.includes(x)), ...ids.filter(x => !prefs.order.includes(x))];
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    prefs.order = order;
    savePreferences(prefs);
    window.renderNav();
  }

  const originalRenderNav = window.renderNav;
  if (typeof originalRenderNav === 'function') {
    window.renderNav = function renderNavWithSidebarPreferences(){
      originalRenderNav();
      applyPreferencesAndToolbar();
    };
    // İlk açılışta ve sonradan yapılan menü yenilemelerinde tercihleri uygula.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.renderNav());
    } else {
      window.renderNav();
    }
  }
})();
