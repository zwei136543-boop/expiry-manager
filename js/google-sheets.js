// Google Sheets 数据管理
const SHEET_ID = '1tDXRMTxi5GdrVzxRgkmQtCYQY1ZEQGVGdR1qwiqvvdM';
const API_KEY = 'AIzaSyDummyKeyForDemo'; // 需要替换为真实的 API Key

class GoogleSheetsManager {
    constructor() {
        this.sheetId = SHEET_ID;
        this.baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values`;
    }

    // 读取数据
    async readSheet(sheetName) {
        try {
            const range = `${sheetName}!A:Z`;
            const url = `${this.baseUrl}/${range}?key=${API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error(`读取 ${sheetName} 失败:`, error);
            return [];
        }
    }

    // 获取所有店铺
    async getStores() {
        const rows = await this.readSheet('stores');
        if (rows.length <= 1) return [];
        
        const headers = rows[0];
        return rows.slice(1).map(row => ({
            id: row[0],
            name: row[1],
            location: row[2],
            manager: row[3]
        }));
    }

    // 获取所有产品
    async getProducts() {
        const rows = await this.readSheet('products');
        if (rows.length <= 1) return [];
        
        const headers = rows[0];
        return rows.slice(1).map(row => ({
            id: row[0],
            storeId: row[1],
            name: row[2],
            produceDate: row[3],
            validDays: parseInt(row[4]),
            expiryDate: row[5],
            daysLeft: parseInt(row[6])
        }));
    }

    // 获取所有用户
    async getUsers() {
        const rows = await this.readSheet('users');
        if (rows.length <= 1) return [];
        
        return rows.slice(1).map(row => ({
            username: row[0],
            password: row[1],
            role: row[2],
            name: row[3],
            storeId: row[4]
        }));
    }

    // 获取设置
    async getSettings() {
        const rows = await this.readSheet('settings');
        if (rows.length <= 1) return {};
        
        const settings = {};
        rows.slice(1).forEach(row => {
            settings[row[0]] = row[1];
        });
        return settings;
    }
}

// 导出
const GoogleSheets = new GoogleSheetsManager();
