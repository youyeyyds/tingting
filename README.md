# 听听APP

微信小程序课程学习平台 + 后台管理系统

## 项目结构

```
tingting/
├── admin/                # 管理后台
│   ├── src/              # Vue 3 前端
│   └── server/           # Express 后端服务
├── miniprogram/          # 微信小程序
├── cloudfunctions/       # 云函数
├── audios/               # 音频文件
└── scripts/              # 工具脚本
```

## 功能模块

### 管理后台

- 课程管理 - 创建/编辑/删除课程
- 章节管理 - 管理课程章节
- 音频管理 - 上传/管理课程音频
- 分类管理 - 课程分类
- 用户管理 - 用户列表/权限
- 角色管理 - 角色权限配置
- 系统配置 - 环境配置/菜单排序

### 微信小程序

- 课程列表/详情
- 音频播放
- 收藏功能
- 个人中心

## 技术栈

| 模块 | 技术 |
|------|------|
| 后台前端 | Vue 3 + Vite + Element Plus |
| 后台后端 | Express + @cloudbase/node-sdk |
| 小程序 | 微信小程序原生 + 云开发 |
| 云服务 | 微信云开发（数据库/存储/云函数） |

## 快速开始

### 1. 环境配置

复制 `.env.example` 为 `.env`，填写云开发凭证：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
TCB_SECRET_ID=你的SecretId
TCB_SECRET_KEY=你的SecretKey
TCB_ENV_ID=你的云环境ID
```

### 2. 安装依赖

```bash
# 后台前端
cd admin
npm install

# 后台后端
cd server
npm install
```

### 3. 启动服务

```bash
# 启动后端（端口 3002）
cd admin/server
npm start

# 启动前端（端口 5173）
cd admin
npm run dev
```

访问 http://localhost:5173 进入管理后台。

### 4. 小程序

使用微信开发者工具打开 `miniprogram` 目录。

## 获取云开发凭证

1. 登录 [微信云开发控制台](https://cloud.weixin.qq.com/) 获取云环境ID
2. 访问 [腾讯云访问管理](https://console.cloud.tencent.com/cam) 创建子用户
3. 授权策略：`QcloudTCBFullAccess` + `QcloudCamReadOnlyAccess`
4. 获取 SecretId 和 SecretKey

## 安全提示

- `.env` 文件包含敏感凭证，已配置 gitignore 不会提交
- 请妥善保管 SecretKey，不要泄露
- 建议定期更换子用户凭证

## License

MIT
