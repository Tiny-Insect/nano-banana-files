# LumenDust 项目 - AI 交接文档

## 📋 项目概览

**项目名称**: LumenDust - NanoBanana 图像生成 WebUI  
**语言**: 中文  
**主题**: 深色模式  
**架构**: React 前端 + Express 后端 + PostgreSQL 数据库  

### 项目目标
为 NanoBanana 2 和 NanoBanana Pro 两个图像生成模型提供一个现代化的网页界面，支持：
- 文字生成图（Text-to-Image）
- 图片生成图（Image-to-Image，基于参考图）
- 多参数调控（宽高比、分辨率、生成数量）
- 历史管理和资产库

---

## 🚀 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript + Vite |
| **UI 组件库** | Shadcn/UI（基于 Radix UI） |
| **路由** | wouter |
| **状态管理** | React Context + 自定义 Hook（generation-store） |
| **数据获取** | TanStack React Query v5 |
| **样式** | Tailwind CSS |
| **表单** | react-hook-form + Zod 验证 |
| **图标** | lucide-react |
| **后端框架** | Express.js |
| **ORM** | Drizzle ORM |
| **数据库** | PostgreSQL |
| **本地存储** | localStorage（任务历史、设置） |

---

## 📁 项目文件结构

```
.
├── client/                              # 前端代码
│   ├── src/
│   │   ├── App.tsx                      # 应用入口，路由和主题设置
│   │   ├── index.css                    # 全局样式，包含 Tailwind 和自定义 CSS 变量
│   │   ├── pages/
│   │   │   ├── home.tsx                 # 主生成页面（聊天式界面、参数控制、任务流）
│   │   │   └── assets.tsx               # 资产库页面（历史图片查看/下载/删除）
│   │   ├── components/
│   │   │   └── layout.tsx               # 布局组件（顶部导航 + 设置弹窗）
│   │   └── lib/
│   │       ├── generation-store.tsx     # 状态管理（Redux-like Context）
│   │       └── queryClient.ts           # React Query 配置 + API 请求工具
│   └── vite.env.d.ts                    # Vite 环境变量类型定义
├── server/                              # 后端代码
│   ├── index.ts                         # Express 服务器启动
│   ├── routes.ts                        # API 路由（/api/generate 等）
│   ├── storage.ts                       # 数据库操作接口
│   └── db.ts                            # 数据库连接和初始化
├── shared/                              # 前后端共享代码
│   └── schema.ts                        # Zod 数据验证 Schema + TypeScript 类型
├── script/
│   └── build.ts                         # 构建脚本
├── vite.config.ts                       # Vite 配置
├── tailwind.config.ts                   # Tailwind CSS 配置
├── tsconfig.json                        # TypeScript 配置
├── drizzle.config.ts                    # Drizzle ORM 配置
├── package.json                         # 项目依赖
├── .replit                              # Replit 配置
└── replit.md                            # 项目文档

```

---

## 🔑 环境变量（必须配置）

在项目根目录创建 `.env.local` 文件，填入以下三个必需的密钥：

```env
# NanoBanana API 配置（第三方 API）
NANOBANANA_API_KEY=your_api_key_here
NANOBANANA_API_URL=your_api_url_here

# 会话密钥（安全相关）
SESSION_SECRET=your_random_secret_here

# 数据库连接（PostgreSQL）
DATABASE_URL=postgresql://user:password@host:port/dbname
```

**重要**: 这三个密钥不能放在代码里，必须在部署的环境中配置。

---

## 🔄 API 架构

### 数据流
```
前端 (React) 
  ↓
Express 后端 (server/routes.ts)
  ↓
VectorEngine API (第三方 API 网关)
  ↓
NanoBanana 模型（图像生成）
  ↓
返回图片 (base64 格式)
```

### 模型映射
```
nanobanana-2      → gemini-3-pro-image-preview
nanobanana-pro    → gemini-3.1-flash-image-preview
```

### 核心 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/generate` | 生成图片（支持文生图和图生图） |
| `GET` | `/api/images` | 获取历史图片列表 |
| `DELETE` | `/api/images/:id` | 删除历史图片 |

#### `/api/generate` 请求体示例
```json
{
  "model": "nanobanana-2",
  "prompt": "一只可爱的猫咪",
  "aspect_ratio": "16:9",
  "resolution": "4k",
  "num_images": 1,
  "images": [],
  "web_search": false,
  "thinking_level": "fast"
}
```

---

## 📊 数据库

### 表结构: `generated_images`
```typescript
{
  id: serial (主键)
  model: varchar(50)        // "nanobanana-2" 或 "nanobanana-pro"
  prompt: text              // 生成提示词
  aspectRatio: varchar(20)  // "16:9", "1:1" 等
  resolution: varchar(10)   // "1k", "2k", "4k"
  imageUrl: text           // 图片 URL 或 base64 数据
  createdAt: timestamp      // 创建时间
}
```

### 初始化数据库
```bash
npm run db:push
```
此命令会自动创建表和所有列。

---

## 💾 本地存储 (localStorage)

前端使用 localStorage 来持久化用户数据：

### `nanobanana_tasks` 
```typescript
GenerationTask[] = [
  {
    id: string;                           // task-{timestamp}
    prompt: string;                       // 生成提示词
    referenceImagePreviews: string[];     // 参考图预览（data URL）
    referenceImageBase64: string[];       // 参考图 base64（存储时清空以节省空间）
    model: "nanobanana-2" | "nanobanana-pro";
    aspectRatio: string;                  // "16:9", "1:1" 等
    resolution: string;                   // "1k", "2k", "4k"
    numImages: number;                    // 1-4 张
    status: "creating" | "generating" | "downloading" | "complete" | "error";
    statusDetail?: string;                // 详细状态信息
    generatedImages: string[];            // 生成的图片（base64 或 URL）
    error?: string;                       // 错误信息
    createdAt?: number;                   // 创建时间戳
    completedAt?: number;                 // 完成时间戳
    webSearch?: boolean;
    thinkingLevel?: string;
  }
]
```
**注意**: 系统自动保存最近 20 条任务，并清理 referenceImageBase64 以节省空间。

### `nanobanana_settings`
```typescript
{
  customApiUrl: string;      // 用户自定义 API 地址
  customApiKey: string;      // 用户自定义 API 密钥
  downloadPrefix: string;    // 下载文件名前缀（默认 "LumenDust"）
  downloadFormat: string;    // 下载格式（"png", "jpg", "webp"）
}
```

---

## 🎨 UI 界面

### 页面结构
- **首页 (/)**
  - 顶部导航栏（Logo + 设置按钮）
  - 聊天式任务流（从上到下显示历史任务）
  - 底部输入区（固定或根据滚动位置收缩）
    - 参考图上传区
    - 提示词输入框（自动高度调整）
    - 参数控制区（宽高比、分辨率、数量、模型选择）
    - 发送按钮

- **资产库页面 (/assets)**
  - 历史生成的所有图片网格显示
  - 下载和删除功能

- **设置面板（浮窗）**
  - API 地址和密钥配置
  - 下载设置（文件名前缀、图片格式）

### 宽高比选项

**NanoBanana 2** (14 个比例):
```
1:1, 4:3, 3:4, 16:9, 9:16, 21:9, 3:2, 2:3,
4:5, 5:4, 1:4, 4:1, 1:8, 8:1
```

**NanoBanana Pro** (8 个比例):
```
1:1, 4:3, 3:4, 16:9, 9:16, 21:9, 3:2, 2:3
```

### 分辨率选项
```
1k (1K)
2k (2K)
4k (4K)
```

---

## 🔧 运行项目

### 开发模式
```bash
npm install          # 安装依赖
npm run db:push      # 初始化数据库（首次运行）
npm run dev          # 启动开发服务器 (http://localhost:5173)
```

### 编译和生产构建
```bash
npm run build        # 编译前后端
npm start            # 启动生产服务器
```

### 类型检查
```bash
npm run check        # 运行 TypeScript 类型检查
```

---

## 🐛 已知特性和注意事项

### ✅ 已实现的功能
- ✅ 支持文生图和图生图（自动检测）
- ✅ 支持多参考图（最多 10 张）
- ✅ 4K/2K/1K 三档分辨率
- ✅ 智能比例管理（切换模型自动调整）
- ✅ 任务历史持久化（localStorage）
- ✅ 自定义 API 配置
- ✅ 深色主题
- ✅ 中文界面
- ✅ 删除确认对话框
- ✅ 自动滚动和输入栏收缩
- ✅ 页面刷新后任务恢复（如果已生成图片）
- ✅ 参考图原始数据自动清理（节省 localStorage 空间）
- ✅ 再次生成功能（使用原任务参数）

### 🔄 最近的改动（最后 5 次提交）
1. **Switch to using a third-party API** - 移除 Google 官方 API 逻辑，统一使用 VectorEngine 第三方 API
2. **Restore completed tasks after page refresh** - 修复页面刷新后任务消失的问题
3. **Add more aspect ratio options** - 为 NanoBanana Pro 添加更多宽高比选项
4. **Fix regenerate bugs** - 修复再次生成时参数传递问题
5. **Restore full ratio lists** - 恢复完整的宽高比列表

### ⚠️ 重要注意事项

#### 1. API 请求格式
- **目前使用**: OpenAI 兼容格式（通过 VectorEngine API 网关）
- **请求头**: `Authorization: Bearer {API_KEY}`
- **模型参数**: `messages[].content` 中包含文本和图片
- **图片格式**: 支持 base64 和 URL 两种格式

#### 2. 图片数据处理
- 前端上传的参考图同时保存两份：
  - `referenceImagePreviews`: data URL（用于显示）
  - `referenceImageBase64`: 纯 base64（用于 API 请求）
- localStorage 保存时清空 base64 以节省空间
- 生成的图片以 base64 或 URL 形式返回

#### 3. localStorage 配额限制
- 浏览器 localStorage 容量有限（通常 5-10MB）
- 系统自动限制保存最近 20 条任务
- 如果超过配额，会降级到最近 5 条
- 参考图原始数据会被清理，但生成结果会保留

#### 4. 状态管理
- 使用 React Context + useState（generation-store.tsx）
- 不使用 Redux，足够处理当前复杂度
- 所有状态变化会实时同步到 localStorage

#### 5. 错误处理
- API 错误会显示用户友好的中文错误提示
- 常见状态码处理：429（频率限制）、502/503/504（服务不可用）
- 网络错误自动重试逻辑（在前端 apiRequest 中）

---

## 🛠️ 关键代码文件导读

### `client/src/pages/home.tsx` (923 行)
主生成页面，包含：
- `ModelToggle` 组件：模型选择器
- `RatioIcon` 组件：宽高比可视化
- `TaskCard` 组件：单个任务卡片
- `Lightbox` 组件：图片全屏预览
- `handleGenerate()`: 提交生成请求
- `handleReGenerate()`: 基于旧任务重新生成
- `handleReEdit()`: 加载任务参数到编辑区
- 滚动管理和输入栏收缩逻辑

### `client/src/lib/generation-store.tsx` (134 行)
全局状态管理：
- `GenerationTask` 接口定义
- `loadTasks()` / `saveTasks()`: localStorage 持久化
- `GenerationProvider` Context 提供者
- `useGenerationStore()` Hook 消费者

### `server/routes.ts` (284 行)
后端 API 路由：
- `POST /api/generate`: 图像生成入口
  - 参数验证（Zod Schema）
  - 构建 API 请求体（OpenAI 兼容格式）
  - 调用 VectorEngine API
  - 提取响应中的图片数据
  - 保存到数据库
- `GET /api/images`: 获取历史图片
- `DELETE /api/images/:id`: 删除历史图片

### `server/storage.ts` (约 50 行)
数据库操作接口 (IStorage)：
- `saveImage()`: 保存生成的图片
- `getImages()`: 分页获取历史图片
- `getImageCount()`: 获取总数
- `deleteImage()`: 删除图片

### `shared/schema.ts` (47 行)
数据校验和类型定义：
- `generatedImages` 表定义
- `GenerateRequest` 验证 Schema
- `NANOBANANA2_RATIOS` 和 `NANOBANANA_PRO_RATIOS` 常量
- `RESOLUTIONS` 常量

---

## 📝 开发指南

### 添加新功能的流程
1. 在 `shared/schema.ts` 中定义数据模型
2. 更新 `server/routes.ts` 中的 API 逻辑
3. 在 `server/storage.ts` 中实现数据库操作
4. 在前端中添加 UI 和业务逻辑

### 修改数据库表
```bash
# 修改 shared/schema.ts 中的表定义
# 然后运行
npm run db:push
```

### 调试技巧
- 后端日志：查看 Express 服务器的 console.log 输出
- 前端日志：浏览器 DevTools Console
- API 请求：使用浏览器 Network 标签查看请求体和响应
- localStorage：在浏览器 DevTools Application 标签中查看

### 样式修改
- 全局样式：`client/src/index.css`
- 组件样式：Tailwind CSS 类名（直接在 JSX 中）
- 主题色：定义在 `tailwind.config.ts` 和 `index.css` 中的 CSS 变量
- 深色模式：使用 `dark:` 前缀（已在 tailwind.config.ts 中配置）

---

## 🚀 下一步开发建议

### 优先级高
- [ ] 优化大量参考图上传时的性能
- [ ] 添加进度条或更详细的生成进度
- [ ] 支持批量下载图片
- [ ] 添加图片编辑功能（裁剪、调整等）

### 优先级中
- [ ] 支持用户账号系统
- [ ] 云端同步任务历史
- [ ] 添加水印功能
- [ ] 支持 API 配额提示

### 优先级低
- [ ] 添加图片分类标签功能
- [ ] 支持分享生成的图片
- [ ] 添加图片对比工具

---

## 📞 技术支持

如果继续开发此项目，重点关注：
1. **API 变更**: VectorEngine API 可能更新，需要同时更新前后端请求格式
2. **数据库迁移**: 使用 `npm run db:push` 而不是手动 SQL
3. **localStorage 限制**: 大量数据可能需要迁移到后端存储
4. **性能优化**: React Query 缓存策略可能需要调整

---

**最后更新**: 2026-03-07  
**项目状态**: 功能完整，可用于生产环境
