# 🚀 Vercel 部署指南

## 第一步：访问 Vercel

1. 打开浏览器，访问：https://vercel.com
2. 点击右上角「Sign Up」
3. 选择「Continue with GitHub」
4. 授权 Vercel 访问你的 GitHub 账号

## 第二步：导入项目

1. 登录 Vercel 后，点击「Add New...」→「Project」
2. 选择「Import Git Repository」
3. 在搜索框输入：`expiry-manager`
4. 选择你的仓库：`zwei136543-boop/expiry-manager`
5. 点击「Import」

## 第三步：配置项目

1. **Project Name**：保持 `expiry-manager`
2. **Framework Preset**：选择 `Other`（因为是静态网站）
3. **Root Directory**：保持空白
4. 点击「Deploy」

## 第四步：等待部署完成

- Vercel 会自动构建和部署
- 部署完成后会显示一个 URL，类似：`https://expiry-manager.vercel.app`

## 第五步：访问你的应用

部署完成后，你可以通过以下方式访问：
- **Vercel 提供的 URL**：https://expiry-manager.vercel.app
- **自定义域名**（可选）：在 Vercel 项目设置中配置

## 🎉 完成！

现在你的应用已经上线了！可以分享给所有店铺使用。

---

## 📝 后续更新

每次你在 GitHub 上提交代码，Vercel 会自动重新部署。

### 更新步骤：
1. 修改本地代码
2. 提交到 GitHub（需要安装 Git）
3. Vercel 自动部署新版本

---

## ⚠️ 注意事项

- 目前数据存储在浏览器 localStorage 中
- 每个浏览器的数据是独立的
- 如果需要多设备同步，需要后期添加后端数据库

---

**需要帮助？** 告诉我部署过程中遇到的问题！
