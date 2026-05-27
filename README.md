# 生日小屋

一个私密的双人小屋网站，用来记录生活、孕期提醒、资料卡片、照片和爱意便签。首版是自托管方案：React 前端、Express API、Node 内置 SQLite、服务器本地图片上传目录。

## 本地开发

```bash
npm install
npm run dev
```

本地默认共享密码是 `chocoli`。打开 `http://localhost:5173`，API 会由 Vite 代理到 `http://localhost:3000`。

## 生产部署

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`，至少设置：

```bash
CABIN_PASSWORD=你的共享密码
SESSION_SECRET=一串很长的随机字符串
```

然后部署：

```bash
docker compose up -d --build
```

容器默认监听 `3000`，可以用 Nginx 或 Caddy 把你的域名反向代理到这个端口。

## 数据与备份

- SQLite 数据库和上传图片默认保存在 `./data`。
- 登录后访问 `/api/export.json` 可以导出 JSON 备份。
- 图片会保存在 `/data/uploads`，数据库里保存文件元数据和关联记录。

## 视觉方向

项目里的视觉锚点在 `docs/visual-direction.png`。实现风格遵循温柔小屋、手账、胶片相册、浅木色、柔和米白、鼠尾草绿、暖玫瑰和琥珀点缀。
