// 应用主逻辑
var currentUser = null;

function waitForDb(callback) {
    if (window.db) {
        callback();
    } else {
        setTimeout(function() { waitForDb(callback); }, 100);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    waitForDb(function() {
        console.log('DB ready, starting app');
        checkLogin();
        setupEventListeners();
    });
});

async function checkLogin() {
    var savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        DataManager.currentUser = currentUser;
        hideLoginModal();
        await initApp();
    } else {
        showLoginModal();
    }
}

function showLoginModal() { 
    document.getElementById('loginModal').style.display = 'flex'; 
    document.getElementById('mainApp').style.display = 'none';
}
function hideLoginModal() { 
    document.getElementById('loginModal').style.display = 'none'; 
    document.getElementById('mainApp').style.display = 'block';
}

async function login() {
    var username = document.getElementById('loginUsername').value;
    var password = document.getElementById('loginPassword').value;
    if (!username || !password) { showToast('请输入用户名和密码'); return; }
    try {
        var user = await DataManager.login(username, password);
        if (user) {
            currentUser = user;
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            hideLoginModal();
            await initApp();
            showToast('欢迎，' + user.name + '！');
        } else {
            showToast('用户名或密码错误');
        }
    } catch (e) {
        console.error('登录错误:', e);
        showToast('登录失败');
    }
}

function logout() {
    DataManager.logout();
    sessionStorage.removeItem('currentUser');
    currentUser = null;
    location.reload();
}

async function initApp() {
    document.getElementById('userName').textContent = currentUser.name;
    var isAdmin = currentUser.role !== 'manager';
    var roleEl = document.getElementById('userRole');
    if (roleEl) roleEl.textContent = isAdmin ? '管理员' : '店长';
    if (!isAdmin) {
        document.getElementById('settingsPanel').style.display = 'none';
        document.getElementById('storeManageSection').style.display = 'none';
        var ptEl = document.getElementById('productTemplateSection');
        if (ptEl) ptEl.style.display = 'none';
        var storePanel = document.querySelector('.store-panel');
        if (storePanel) storePanel.style.display = 'none';
    }
    await loadSettings();
    await refreshData();
    await initStoreSelect();
    await initUrgentStoreFilter();
}

async function loadSettings() {
    var settings = await DataManager.getSettings();
    document.getElementById('day7').value = settings.urgent;
    document.getElementById('day15').value = settings.high;
    document.getElementById('day30').value = settings.medium;
    document.getElementById('day60').value = settings.low;
    document.getElementById('day90').value = settings.notice;
}

async function saveSettings() {
    var settings = {
        urgent: parseInt(document.getElementById('day7').value) || 7,
        high: parseInt(document.getElementById('day15').value) || 15,
        medium: parseInt(document.getElementById('day30').value) || 30,
        low: parseInt(document.getElementById('day60').value) || 60,
        notice: parseInt(document.getElementById('day90').value) || 90
    };
    await DataManager.updateSettings(settings);
    await refreshData();
    await updateUrgentStatusOptions();
    showToast('预警规则已保存');
}

async function refreshData() {
    var products = await DataManager.getProducts();
    var stores = await DataManager.getStores();
    var settings = await DataManager.getSettings();
    var filteredProducts = currentUser.role === 'manager' ? products.filter(function(p) { return p.storeId === currentUser.storeId; }) : products;
    updateStats(filteredProducts, settings);
    await updateStoreRanking(stores, filteredProducts, settings);
    await updateProductTable();
}

function updateStats(products, settings) {
    var expired = products.filter(function(p) { return p.daysLeft < 0; }).length;
    var urgent = products.filter(function(p) { return p.daysLeft >= 0 && p.daysLeft <= settings.urgent; }).length;
    var high = products.filter(function(p) { return p.daysLeft > settings.urgent && p.daysLeft <= settings.high; }).length;
    var medium = products.filter(function(p) { return p.daysLeft > settings.high && p.daysLeft <= settings.medium; }).length;
    var low = products.filter(function(p) { return p.daysLeft > settings.medium && p.daysLeft <= settings.low; }).length;
    var notice = products.filter(function(p) { return p.daysLeft > settings.low && p.daysLeft <= settings.notice; }).length;
    document.getElementById('statExpired').textContent = expired;
    document.getElementById('stat7').textContent = urgent;
    document.getElementById('stat15').textContent = high;
    document.getElementById('stat30').textContent = medium;
    document.getElementById('stat60').textContent = low;
    document.getElementById('stat90').textContent = notice;
}

async function updateStoreRanking(stores, products, settings) {
    var storeStats = [];
    for (var i = 0; i < stores.length; i++) {
        var store = stores[i];
        var storeProducts = products.filter(function(p) { return p.storeId === store.id; });
        var expired = storeProducts.filter(function(p) { return p.daysLeft < 0; }).length;
        var urgent = storeProducts.filter(function(p) { return p.daysLeft >= 0 && p.daysLeft <= settings.urgent; }).length;
        var high = storeProducts.filter(function(p) { return p.daysLeft > settings.urgent && p.daysLeft <= settings.high; }).length;
        var medium = storeProducts.filter(function(p) { return p.daysLeft > settings.high && p.daysLeft <= settings.medium; }).length;
        var low = storeProducts.filter(function(p) { return p.daysLeft > settings.medium && p.daysLeft <= settings.low; }).length;
        var notice = storeProducts.filter(function(p) { return p.daysLeft > settings.low && p.daysLeft <= settings.notice; }).length;
        var total = expired + urgent + high + medium + low + notice;
        if (total > 0) {
            storeStats.push({
                id: store.id,
                name: store.name,
                location: store.location,
                expired: expired,
                urgent: urgent,
                high: high,
                medium: medium,
                low: low,
                notice: notice,
                total: total
            });
        }
    }
    storeStats.sort(function(a, b) { return b.total - a.total; });
    var storeList = document.getElementById('storeList');
    var html = '';
    for (var j = 0; j < storeStats.length; j++) {
        var s = storeStats[j];
        html += '<div class="store-item" onclick="showStoreDetails(\'' + s.id + '\')">';
        html += '<div class="store-info"><div class="store-name">' + s.name + '</div>';
        html += '<div class="store-location">' + s.location + '</div></div>';
        html += '<div class="store-badges">';
        if (s.expired > 0) html += '<span class="badge badge-expired">' + s.expired + ' 已过期</span>';
        if (s.urgent > 0) html += '<span class="badge badge-urgent">' + s.urgent + ' ' + settings.urgent + '天内</span>';
        if (s.high > 0) html += '<span class="badge badge-high">' + s.high + ' ' + settings.high + '天内</span>';
        if (s.medium > 0) html += '<span class="badge badge-medium">' + s.medium + ' ' + settings.medium + '天内</span>';
        if (s.low > 0) html += '<span class="badge badge-low">' + s.low + ' ' + settings.low + '天内</span>';
        if (s.notice > 0) html += '<span class="badge badge-notice">' + s.notice + ' ' + settings.notice + '天内</span>';
        html += '</div></div>';
    }
    if (storeList) storeList.innerHTML = html || '<div class="empty-state"><p>暂无问题店铺</p></div>';
}

async function initStoreSelect() {
    var select = document.getElementById('addStore');
    var stores = await DataManager.getStores();
    // Manager only sees own store
    if (currentUser && currentUser.role === 'manager') {
        stores = stores.filter(function(s) { return s.id === currentUser.storeId; });
    }
    var options = '<option value="">请选择店铺</option>';
    for (var i = 0; i < stores.length; i++) {
        options += '<option value="' + stores[i].id + '">' + stores[i].name + '</option>';
    }
    select.innerHTML = options;
}

async function initUrgentStoreFilter() {
    var select = document.getElementById('urgentFilterStore');
    var stores = await DataManager.getStores();
    var options = '<option value="">全部店铺</option>';
    for (var i = 0; i < stores.length; i++) {
        options += '<option value="' + stores[i].id + '">' + stores[i].name + '</option>';
    }
    select.innerHTML = options;
    await updateUrgentStatusOptions();
}

async function updateUrgentStatusOptions() {
    var settings = await DataManager.getSettings();
    document.getElementById('statusUrgent').textContent = settings.urgent + '天内过期';
    document.getElementById('statusHigh').textContent = settings.high + '天内过期';
    document.getElementById('statusMedium').textContent = settings.medium + '天内过期';
    document.getElementById('statusLow').textContent = settings.low + '天内过期';
    document.getElementById('statusNotice').textContent = settings.notice + '天内过期';
}

async function filterUrgentProducts() {
    var searchText = (document.getElementById('urgentSearchProduct') && document.getElementById('urgentSearchProduct').value || '').toLowerCase();
    var filterStore = document.getElementById('urgentFilterStore') && document.getElementById('urgentFilterStore').value || '';
    var filterStatus = document.getElementById('urgentFilterStatus') && document.getElementById('urgentFilterStatus').value || '';
    var products = await DataManager.getProducts();
    var stores = await DataManager.getStores();
    var settings = await DataManager.getSettings();
    // Manager only sees own store's products
    if (currentUser && currentUser.role === 'manager') {
        products = products.filter(function(p) { return p.storeId === currentUser.storeId; });
    }
    var filtered = products.filter(function(p) { return p.daysLeft <= settings.notice; });
    if (searchText) filtered = filtered.filter(function(p) { return p.name.toLowerCase().indexOf(searchText) !== -1; });
    if (filterStore) filtered = filtered.filter(function(p) { return p.storeId === filterStore; });
    if (filterStatus) {
        switch (filterStatus) {
            case 'expired': filtered = filtered.filter(function(p) { return p.daysLeft < 0; }); break;
            case 'urgent': filtered = filtered.filter(function(p) { return p.daysLeft >= 0 && p.daysLeft <= settings.urgent; }); break;
            case 'high': filtered = filtered.filter(function(p) { return p.daysLeft > settings.urgent && p.daysLeft <= settings.high; }); break;
            case 'medium': filtered = filtered.filter(function(p) { return p.daysLeft > settings.high && p.daysLeft <= settings.medium; }); break;
            case 'low': filtered = filtered.filter(function(p) { return p.daysLeft > settings.medium && p.daysLeft <= settings.low; }); break;
            case 'notice': filtered = filtered.filter(function(p) { return p.daysLeft > settings.low && p.daysLeft <= settings.notice; }); break;
        }
    }
    filtered.sort(function(a, b) { return a.daysLeft - b.daysLeft; });
    var tbody = document.getElementById('productTableBody');
    if (tbody) {
        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var p = filtered[i];
            var store = stores.find(function(s) { return s.id === p.storeId; });
            var storeName = store ? store.name : p.storeId;
            var statusClass = '', statusText = '';
            if (p.daysLeft < 0) { statusClass = 'expired'; statusText = '已过期 ' + Math.abs(p.daysLeft) + '天'; }
            else if (p.daysLeft <= settings.urgent) { statusClass = 'd7'; statusText = '剩 ' + p.daysLeft + '天'; }
            else if (p.daysLeft <= settings.high) { statusClass = 'd15'; statusText = '剩 ' + p.daysLeft + '天'; }
            else if (p.daysLeft <= settings.medium) { statusClass = 'd30'; statusText = '剩 ' + p.daysLeft + '天'; }
            else if (p.daysLeft <= settings.low) { statusClass = 'd60'; statusText = '剩 ' + p.daysLeft + '天'; }
            else { statusClass = 'd90'; statusText = '剩 ' + p.daysLeft + '天'; }
            html += '<tr><td><div class="product-name">' + p.name + '</div></td><td class="product-store">' + storeName + '</td><td class="expiry-date">' + p.expiryDate + '</td><td><span class="days-left ' + statusClass + '">' + statusText + '</span></td></tr>';
        }
        tbody.innerHTML = html;
    }
}

async function updateProductTable() { await filterUrgentProducts(); }
function filterProducts() { filterUrgentProducts(); }

function showChangePasswordModal() { document.getElementById('changePasswordModal').classList.add('active'); }
function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('active');
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

async function changePassword() {
    var oldPassword = document.getElementById('oldPassword').value;
    var newPassword = document.getElementById('newPassword').value;
    var confirmPassword = document.getElementById('confirmPassword').value;
    if (!oldPassword || !newPassword || !confirmPassword) { showToast('请填写完整信息'); return; }
    if (newPassword !== confirmPassword) { showToast('两次输入的新密码不一致'); return; }
    if (newPassword.length < 6) { showToast('新密码至少6个字符'); return; }
    if (currentUser.password !== oldPassword) { showToast('原密码错误'); return; }
    await DataManager.updateUserPassword(currentUser.username, newPassword);
    currentUser.password = newPassword;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    closeChangePasswordModal();
    showToast('密码修改成功！');
}

async function showAddModal() {
    document.getElementById('addModal').classList.add('active');
    // Populate template dropdown from localStorage
    var select = document.getElementById('addProductTemplate');
    var templates = getTemplatesSync();
    var options = '<option value="">请选择产品模板</option><option value="custom">自定义产品</option>';
    for (var i = 0; i < templates.length; i++) {
        options += '<option value="' + templates[i].name + '">' + templates[i].name + ' (' + templates[i].validDays + '天)</option>';
    }
    select.innerHTML = options;
}
function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('addProductName').value = '';
    document.getElementById('addProduceDate').value = '';
    document.getElementById('addValidDays').value = '';
}

async function addProduct() {
    var storeId = document.getElementById('addStore').value;
    var name = document.getElementById('addProductName').value;
    var produceDate = document.getElementById('addProduceDate').value;
    var validDays = parseInt(document.getElementById('addValidDays').value);
    if (!storeId || !name || !produceDate || !validDays) { showToast('请填写完整信息'); return; }
    await DataManager.addProduct({ storeId: storeId, name: name, produceDate: produceDate, validDays: validDays });
    closeAddModal();
    await refreshData();
    await initUrgentStoreFilter();
    showToast('产品添加成功');
}

async function exportData() {
    var products = await DataManager.getProducts();
    var stores = await DataManager.getStores();
    var rows = products.map(function(p) {
        var store = stores.find(function(s) { return s.id === p.storeId; });
        return { '店铺': store ? store.name : p.storeId, '产品名称': p.name, '生产日期': p.produceDate, '有效期(天)': p.validDays, '到期日期': p.expiryDate, '剩余天数': p.daysLeft };
    });
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '产品列表');
    XLSX.writeFile(wb, '效期管理导出_' + new Date().toLocaleDateString() + '.xlsx');
    showToast('数据导出成功');
}

function setupEventListeners() {
    // Enter 键登录
    document.getElementById('loginPassword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') login();
    });
    document.getElementById('loginUsername').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('loginPassword').focus();
    });
    document.getElementById('importFile').addEventListener('change', async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = async function(e) {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            var sheet = workbook.Sheets[workbook.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(sheet);
            var stores = await DataManager.getStores();
            var invalidStores = [];
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var storeName = row['店铺'] || row['店铺名称'] || row['门店'] || '';
                var productName = row['产品名称'] || row['产品'] || row['名称'] || '';
                var produceDate = row['生产日期'];
                var validDays = parseInt(row['有效期'] || row['有效期(天)'] || row['有效天数']);
                if (!storeName || !productName || !produceDate || !validDays) continue;
                var store = stores.find(function(s) { return s.name === storeName; });
                if (!store) { invalidStores.push(storeName); continue; }
                await DataManager.addProduct({ storeId: store.id, name: productName, produceDate: new Date(produceDate).toISOString().split('T')[0], validDays: validDays });
            }
            await refreshData();
            await initUrgentStoreFilter();
            showToast(invalidStores.length > 0 ? '部分店铺名称无效: ' + invalidStores.join(', ') : '数据导入成功');
        };
        reader.readAsArrayBuffer(file);
    });
}

function showToast(message) {
    var toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

function showModal(title, content) {
    var existing = document.getElementById('dynamicModal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'dynamicModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = '<div class="modal-container"><div class="modal-header"><h2>' + title + '</h2><button class="modal-close" onclick="closeDynamicModal()">×</button></div><div class="modal-body">' + content + '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function closeDynamicModal() {
    var modal = document.getElementById('dynamicModal');
    if (modal) modal.remove();
}

async function showProductManage() {
    var products = await DataManager.getProducts();
    var stores = await DataManager.getStores();
    // Manager only sees own store's products
    if (currentUser && currentUser.role === 'manager') {
        products = products.filter(function(p) { return p.storeId === currentUser.storeId; });
    }
    var html = '<div style="max-height:400px;overflow-y:auto;"><table class="product-table" style="width:100%;"><thead><tr><th>产品名称</th><th>店铺</th><th>到期日期</th><th>操作</th></tr></thead><tbody>';
    for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var store = stores.find(function(s) { return s.id === p.storeId; });
        html += '<tr><td>' + p.name + '</td><td>' + (store ? store.name : p.storeId) + '</td><td>' + p.expiryDate + '</td><td><button class="btn btn-secondary" style="padding:4px 12px;font-size:12px;" onclick="editProduct(' + p.id + ')">编辑</button> <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px;margin-left:8px;background:#ff4757;color:white;border:none;" onclick="deleteProduct(' + p.id + ')">删除</button></td></tr>';
    }
    html += '</tbody></table></div>';
    showModal('产品管理', html);
}

async function deleteProduct(productId) {
    if (!confirm('确定要删除这个产品吗？')) return;
    await DataManager.deleteProduct(productId);
    await showProductManage();
    await refreshData();
    showToast('产品已删除');
}

async function editProduct(productId) {
    var products = await DataManager.getProducts();
    var stores = await DataManager.getStores();
    var product = products.find(function(p) { return p.id === productId; });
    if (!product) return;
    var storeOptions = '';
    for (var i = 0; i < stores.length; i++) {
        storeOptions += '<option value="' + stores[i].id + '"' + (stores[i].id === product.storeId ? ' selected' : '') + '>' + stores[i].name + '</option>';
    }
    showModal('编辑产品', '<div class="form-group"><label>店铺</label><select id="editProductStore">' + storeOptions + '</select></div><div class="form-group"><label>产品名称</label><input type="text" id="editProductName" value="' + product.name + '"></div><div class="form-group"><label>生产日期</label><input type="date" id="editProductProduceDate" value="' + product.produceDate + '"></div><div class="form-group"><label>有效期（天）</label><input type="number" id="editProductValidDays" value="' + product.validDays + '"></div><div style="display:flex;gap:10px;margin-top:16px;"><button class="btn btn-secondary" onclick="closeDynamicModal()">取消</button><button class="btn btn-primary" onclick="saveProductEdit(' + productId + ')">保存</button></div>');
}

async function saveProductEdit(productId) {
    var updates = {
        storeId: document.getElementById('editProductStore').value,
        name: document.getElementById('editProductName').value,
        produceDate: document.getElementById('editProductProduceDate').value,
        validDays: parseInt(document.getElementById('editProductValidDays').value)
    };
    await DataManager.updateProduct(productId, updates);
    closeDynamicModal();
    await showProductManage();
    await refreshData();
    showToast('产品已更新');
}

async function showStoreManage() {
    var stores = await DataManager.getStores();
    var users = await DataManager.getUsers();
    var html = '<div style="max-height:400px;overflow-y:auto;"><table class="product-table" style="width:100%;"><thead><tr><th>店铺</th><th>位置</th><th>店长账号</th><th>操作</th></tr></thead><tbody>';
    for (var i = 0; i < stores.length; i++) {
        var store = stores[i];
        var manager = users.find(function(u) { return u.storeId === store.id && u.role === 'manager'; });
        var canDelete = store.id !== 'store1';
        html += '<tr><td>' + store.name + '</td><td>' + store.location + '</td><td>' + (manager ? manager.username : '未分配') + '</td><td><button class="btn btn-primary" style="padding:4px 12px;font-size:12px;" onclick="editStore(\'' + store.id + '\')">编辑</button>' + (canDelete ? ' <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px;margin-left:8px;background:#ff4757;color:white;border:none;" onclick="deleteStore(\'' + store.id + '\')">删除</button>' : '') + '</td></tr>';
    }
    html += '</tbody></table><div style="margin-top:20px;padding:16px;background:#f8f9fa;border-radius:8px;"><h4 style="margin-bottom:12px;">添加新店铺</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"><input type="text" id="newStoreName" placeholder="店铺名称" style="padding:8px;border:1px solid #ddd;border-radius:6px;"><input type="text" id="newStoreLocation" placeholder="店铺位置" style="padding:8px;border:1px solid #ddd;border-radius:6px;"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;"><input type="text" id="newStoreUsername" placeholder="店长登录账号" style="padding:8px;border:1px solid #ddd;border-radius:6px;"><input type="text" id="newStorePassword" placeholder="店长登录密码(至少6位)" style="padding:8px;border:1px solid #ddd;border-radius:6px;"></div><button class="btn btn-primary" onclick="addStore()" style="width:100%;">添加店铺</button></div></div>';
    showModal('店铺管理', html);
}

async function addStore() {
    var name = document.getElementById('newStoreName').value.trim();
    var location = document.getElementById('newStoreLocation').value.trim();
    var username = document.getElementById('newStoreUsername').value.trim();
    var password = document.getElementById('newStorePassword').value.trim();
    if (!name || !location) { showToast('请填写店铺名称和位置'); return; }
    if (!username || !password) { showToast('请填写店长登录账号和密码'); return; }
    if (password.length < 6) { showToast('密码至少6个字符'); return; }
    var storeId = 'store' + Date.now();
    await DataManager.addStore({ id: storeId, name: name, location: location, manager: '' });
    await DataManager.addUser({ username: username, password: password, role: 'manager', name: name + ' 店长', storeId: storeId });
    await showStoreManage();
    await refreshData();
    showToast('店铺及店长账号创建成功');
}

async function deleteStore(storeId) {
    if (!confirm('确定要删除这个店铺吗？')) return;
    await DataManager.deleteStore(storeId);
    await showStoreManage();
    await refreshData();
    showToast('店铺已删除');
}

async function editStore(storeId) {
    var stores = await DataManager.getStores();
    var users = await DataManager.getUsers();
    var store = stores.find(function(s) { return s.id === storeId; });
    if (!store) return;
    var manager = users.find(function(u) { return u.storeId === storeId && u.role === 'manager'; });
    showModal('编辑店铺', '<div class="form-group"><label>店铺名称</label><input type="text" id="editStoreName" value="' + store.name + '"></div><div class="form-group"><label>店铺位置</label><input type="text" id="editStoreLocation" value="' + store.location + '"></div><div style="padding:16px;background:#f8f9fa;border-radius:8px;margin-bottom:20px;"><h4 style="margin-bottom:12px;font-size:14px;color:#666;">店长账号设置</h4><div class="form-group"><label>登录账号</label><input type="text" id="editManagerUsername" value="' + (manager ? manager.username : '') + '" placeholder="请输入店长登录账号"></div><div class="form-group"><label>登录密码</label><input type="text" id="editManagerPassword" value="' + (manager ? manager.password : '') + '" placeholder="请输入店长登录密码"></div></div><div style="display:flex;gap:12px;"><button class="btn btn-secondary" onclick="closeDynamicModal()">取消</button><button class="btn btn-primary" onclick="saveStoreEdit(\'' + storeId + '\')">保存</button></div>');
}

async function saveStoreEdit(storeId) {
    var name = document.getElementById('editStoreName').value.trim();
    var location = document.getElementById('editStoreLocation').value.trim();
    var username = document.getElementById('editManagerUsername').value.trim();
    var password = document.getElementById('editManagerPassword').value.trim();
    if (!name || !location) { showToast('请填写店铺名称和位置'); return; }
    if (username && password && password.length < 6) { showToast('密码至少6个字符'); return; }
    await DataManager.updateStore(storeId, { name: name, location: location });
    if (username && password) {
        var users = await DataManager.getUsers();
        var manager = users.find(function(u) { return u.storeId === storeId && u.role === 'manager'; });
        if (manager) {
            await window.db.from('users').update({ username: username, password: password, name: name + '店长' }).eq('username', manager.username);
        } else {
            await DataManager.addUser({ username: username, password: password, role: 'manager', name: name + '店长', storeId: storeId });
        }
    }
    closeDynamicModal();
    await showStoreManage();
    await refreshData();
    showToast('保存成功');
}

async function showAllStores() { await showStoreManage(); }

async function showStoreDetails(storeId) {
    var stores = await DataManager.getStores();
    var products = await DataManager.getProducts();
    var settings = await DataManager.getSettings();
    var store = stores.find(function(s) { return s.id === storeId; });
    if (!store) return;
    var storeProducts = products.filter(function(p) { return p.storeId === storeId; });
    showModal(store.name, '<div style="padding:20px;"><h3>' + store.name + '</h3><p>位置: ' + store.location + '</p><p>产品总数: ' + storeProducts.length + '</p><p>过期产品: ' + storeProducts.filter(function(p) { return p.daysLeft < 0; }).length + '</p></div>');
}

// ========== Product Templates (stored in Supabase) ==========

function getTemplatesSync() {
    try {
        return JSON.parse(localStorage.getItem('productTemplates') || '[]');
    } catch (e) {
        return [];
    }
}

function saveTemplatesLocal(templates) {
    localStorage.setItem('productTemplates', JSON.stringify(templates));
}

async function getTemplates() {
    try {
        var result = await window.db.from('settings').select('*').eq('key', 'product_templates').single();
        if (result.data && result.data.value) {
            return JSON.parse(result.data.value);
        }
    } catch (e) {
        console.error('Failed to load templates from DB:', e);
    }
    return getTemplatesSync();
}

async function saveTemplates(templates) {
    saveTemplatesLocal(templates);
    try {
        await window.db.from('settings').update({ value: JSON.stringify(templates) }).eq('key', 'product_templates');
    } catch (e) {
        console.error('Failed to save templates to DB:', e);
    }
}

async function showProductTemplateManage() {
    var templates = await getTemplates();
    var html = '<div style="max-height:500px;overflow-y:auto;">';

    if (templates.length === 0) {
        html += '<div style="text-align:center;padding:30px;color:#999;"><p>暂无产品模板</p><p style="font-size:12px;margin-top:8px;">通过导入 Excel 文件来批量添加预设产品</p></div>';
    } else {
        html += '<table class="product-table" style="width:100%;"><thead><tr><th>产品名称</th><th>有效期(天)</th><th>分类</th><th>操作</th></tr></thead><tbody>';
        for (var i = 0; i < templates.length; i++) {
            var t = templates[i];
            html += '<tr><td>' + t.name + '</td><td>' + t.validDays + '天</td><td>' + (t.category || '-') + '</td>';
            html += '<td><button class="btn btn-secondary" style="padding:4px 12px;font-size:12px;margin-left:8px;background:#ff4757;color:white;border:none;" onclick="deleteTemplate(' + i + ')">删除</button></td></tr>';
        }
        html += '</tbody></table>';
    }

    html += '<div style="margin-top:20px;padding:16px;background:#f8f9fa;border-radius:8px;">';
    html += '<h4 style="margin-bottom:12px;">导入产品模板（Excel）</h4>';
    html += '<p style="font-size:12px;color:#666;margin-bottom:12px;">Excel 格式：第一行为标题，包含"产品名称"和"有效期"或"有效期(天)"列</p>';
    html += '<input type="file" id="templateFile" accept=".xlsx,.xls" style="margin-bottom:12px;width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">';
    html += '<button class="btn btn-primary" onclick="importTemplates()" style="width:100%;">导入模板</button>';
    html += '</div>';

    html += '<div style="margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px;">';
    html += '<h4 style="margin-bottom:12px;">手动添加模板</h4>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">';
    html += '<input type="text" id="tplName" placeholder="产品名称" style="padding:8px;border:1px solid #ddd;border-radius:6px;">';
    html += '<input type="number" id="tplDays" placeholder="有效期(天)" style="padding:8px;border:1px solid #ddd;border-radius:6px;">';
    html += '<input type="text" id="tplCategory" placeholder="分类(选填)" style="padding:8px;border:1px solid #ddd;border-radius:6px;">';
    html += '</div>';
    html += '<button class="btn btn-primary" onclick="addTemplate()" style="width:100%;">添加</button>';
    html += '</div>';

    html += '</div>';
    showModal('产品模板管理', html);
}

async function addTemplate() {
    var name = document.getElementById('tplName').value.trim();
    var validDays = parseInt(document.getElementById('tplDays').value);
    var category = document.getElementById('tplCategory').value.trim();
    if (!name || !validDays) { showToast('请填写产品名称和有效期'); return; }
    var templates = await getTemplates();
    templates.push({ name: name, validDays: validDays, category: category });
    saveTemplates(templates);
    showProductTemplateManage();
    showToast('模板添加成功');
}

async function deleteTemplate(index) {
    var templates = await getTemplates();
    templates.splice(index, 1);
    saveTemplates(templates);
    showProductTemplateManage();
    showToast('模板已删除');
}

function importTemplates() {
    var fileInput = document.getElementById('templateFile');
    if (!fileInput || !fileInput.files[0]) { showToast('请选择 Excel 文件'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            var sheet = workbook.Sheets[workbook.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(sheet);
    var templates = getTemplatesSync();
            var count = 0;
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var name = row['产品名称'] || row['产品'] || row['名称'] || '';
                var validDays = parseInt(row['有效期'] || row['有效期(天)'] || row['有效天数']);
                var category = row['分类'] || row['类别'] || '';
                if (!name || !validDays) continue;
                templates.push({ name: name, validDays: validDays, category: category });
                count++;
            }
            saveTemplatesLocal(templates);
            showProductTemplateManage();
            showToast('成功导入 ' + count + ' 个产品模板');
        } catch (err) {
            console.error('导入模板失败:', err);
            showToast('导入失败，请检查文件格式');
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

async function onTemplateSelect() {
    var select = document.getElementById('addProductTemplate');
    var templates = await getTemplates();
    var selectedValue = select.value;
    if (selectedValue && selectedValue !== 'custom') {
        var template = templates.find(function(t) { return t.name === selectedValue; });
        if (template) {
            document.getElementById('addProductName').value = template.name;
            document.getElementById('addValidDays').value = template.validDays;
        }
    } else if (selectedValue === 'custom') {
        document.getElementById('addProductName').value = '';
        document.getElementById('addValidDays').value = '';
    }
}

console.log('App loaded');
