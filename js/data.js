// Supabase 数据管理器
var DataManager = {
    currentUser: null,

    getDb: function() {
        return window.db;
    },

    // 获取所有店铺
    getStores: async function() {
        var result = await window.db.from('stores').select('*');
        if (result.error) { console.error('获取店铺失败:', result.error); return []; }
        return result.data || [];
    },

    // 添加店铺
    addStore: async function(store) {
        var result = await window.db.from('stores').insert([store]);
        if (result.error) { console.error('添加店铺失败:', result.error); return false; }
        return true;
    },

    // 更新店铺
    updateStore: async function(storeId, updates) {
        var result = await window.db.from('stores').update(updates).eq('id', storeId);
        if (result.error) { console.error('更新店铺失败:', result.error); return false; }
        return true;
    },

    // 删除店铺
    deleteStore: async function(storeId) {
        var result = await window.db.from('stores').delete().eq('id', storeId);
        if (result.error) { console.error('删除店铺失败:', result.error); return false; }
        return true;
    },

    // 获取所有产品
    getProducts: async function() {
        var result = await window.db.from('products').select('*');
        if (result.error) { console.error('获取产品失败:', result.error); return []; }
        return (result.data || []).map(function(p) {
            return {
                id: p.id,
                storeId: p.store_id,
                name: p.name,
                produceDate: p.produce_date,
                validDays: p.valid_days,
                expiryDate: p.expiry_date,
                daysLeft: p.days_left
            };
        });
    },

    // 添加产品
    addProduct: async function(product) {
        var expiryDate = DataManager.calculateExpiryDate(product.produceDate, product.validDays);
        var daysLeft = DataManager.calculateDaysLeft(expiryDate);
        var dbProduct = {
            store_id: product.storeId,
            name: product.name,
            produce_date: product.produceDate,
            valid_days: product.validDays,
            expiry_date: expiryDate,
            days_left: daysLeft
        };
        var result = await window.db.from('products').insert([dbProduct]);
        if (result.error) { console.error('添加产品失败:', result.error); return false; }
        return true;
    },

    // 更新产品
    updateProduct: async function(productId, updates) {
        var expiryDate = DataManager.calculateExpiryDate(updates.produceDate, updates.validDays);
        var daysLeft = DataManager.calculateDaysLeft(expiryDate);
        var dbUpdates = {
            store_id: updates.storeId,
            name: updates.name,
            produce_date: updates.produceDate,
            valid_days: updates.validDays,
            expiry_date: expiryDate,
            days_left: daysLeft
        };
        var result = await window.db.from('products').update(dbUpdates).eq('id', productId);
        if (result.error) { console.error('更新产品失败:', result.error); return false; }
        return true;
    },

    // 删除产品
    deleteProduct: async function(productId) {
        var result = await window.db.from('products').delete().eq('id', productId);
        if (result.error) { console.error('删除产品失败:', result.error); return false; }
        return true;
    },

    // 登录
    login: async function(username, password) {
        var result = await window.db.from('users').select('*').eq('username', username).eq('password', password).single();
        if (result.error || !result.data) { return null; }
        DataManager.currentUser = {
            username: result.data.username,
            password: result.data.password,
            role: result.data.role,
            name: result.data.name,
            storeId: result.data.store_id
        };
        return DataManager.currentUser;
    },

    // 登出
    logout: function() {
        DataManager.currentUser = null;
    },

    // 获取所有用户
    getUsers: async function() {
        var result = await window.db.from('users').select('*');
        if (result.error) { return []; }
        return (result.data || []).map(function(u) {
            return { username: u.username, password: u.password, role: u.role, name: u.name, storeId: u.store_id };
        });
    },

    // 更新密码
    updateUserPassword: async function(username, newPassword) {
        var result = await window.db.from('users').update({ password: newPassword }).eq('username', username);
        if (result.error) { return false; }
        return true;
    },

    // 添加用户
    addUser: async function(user) {
        var dbUser = { username: user.username, password: user.password, role: user.role, name: user.name, store_id: user.storeId };
        var result = await window.db.from('users').insert([dbUser]);
        if (result.error) { console.error('添加用户失败:', result.error); return false; }
        return true;
    },

    // 获取设置
    getSettings: async function() {
        var result = await window.db.from('settings').select('*');
        if (result.error) { return { urgent: 7, high: 15, medium: 30, low: 60, notice: 90 }; }
        var settings = {};
        (result.data || []).forEach(function(item) { settings[item.key] = parseInt(item.value); });
        return settings;
    },

    // 更新设置
    updateSettings: async function(settings) {
        var keys = Object.keys(settings);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            await window.db.from('settings').update({ value: settings[key].toString() }).eq('key', key);
        }
    },

    // 计算到期日期
    calculateExpiryDate: function(produceDate, validDays) {
        var date = new Date(produceDate);
        date.setDate(date.getDate() + parseInt(validDays));
        return date.toISOString().split('T')[0];
    },

    // 计算剩余天数
    calculateDaysLeft: function(expiryDate) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    }
};

console.log('DataManager loaded');
