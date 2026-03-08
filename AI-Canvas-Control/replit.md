# LumenDust 图像生成 WebUI

## 概述
LumenDust 图像生成 WebUI，支持 NanoBanana 2 和 NanoBanana Pro 两个模型，深色主题，聊天式界面。

## 功能
- **双模型选择**: NanoBanana 2 和 NanoBanana Pro，底部参数栏切换
- **自动文生图/图生图**: 上传参考图即为图生图，无图即为文生图
- **多图上传**: 最多10张参考图，堆叠显示，鼠标悬浮展开
- **参数调节**: 宽高比（横向展示+比例图标）、分辨率(1k/2k/4k)、生成数量(1-4张)
- **NanoBanana 2 专属**: 联网搜索（通过 google_search 工具）、深度思考（thinking_budget: 8192）
- **比例自动切换**: 模型切换时自动调整可用比例
- **资产库**: 历史生成图片的查看、下载、删除
- **设置页**: API 配置、下载设置（文件名前缀、图片格式 PNG/JPG/WEBP）
- **自定义 API 凭据**: 用户可在设置中填入自己的 API URL 和 Key
- **删除确认**: 删除任务前弹出确认对话框
- **智能滚动**: 新任务自动滚到底部，删除不滚动，支持"回到底部"按钮
- **输入栏收缩**: 往上翻阅时输入栏自动缩小，点击恢复
- **深色主题**: 默认深色模式
- **中文界面**

## 技术栈
- **前端**: React + TypeScript + Tailwind CSS + Shadcn/UI
- **后端**: Express.js API 代理 + PostgreSQL 历史存储
- **ORM**: Drizzle ORM
- **路由**: wouter

## 项目结构
- `client/src/pages/home.tsx` - 主生成页面（聊天式界面、删除确认、滚动/收缩逻辑）
- `client/src/pages/assets.tsx` - 资产库页面
- `client/src/components/layout.tsx` - 布局组件（导航+设置弹窗，含 API/下载设置）
- `client/src/lib/generation-store.tsx` - 生成状态管理（任务历史、参数、localStorage 持久化）
- `client/src/lib/queryClient.ts` - API 请求工具（支持自定义 headers）
- `client/src/App.tsx` - 应用路由 + 深色主题
- `server/routes.ts` - API 路由（支持自定义凭据、联网搜索、深度思考）
- `server/storage.ts` - 数据库存储
- `server/db.ts` - 数据库连接
- `shared/schema.ts` - 数据模型

## 环境变量
- `NANOBANANA_API_KEY` - API 密钥（默认，可被自定义设置覆盖）
- `NANOBANANA_API_URL` - API 地址（默认，可被自定义设置覆盖）
- `DATABASE_URL` - PostgreSQL 连接

## API 路由
- `POST /api/generate` - 图像生成（支持 web_search、thinking_level 参数）
- `GET /api/images` - 获取历史图片
- `DELETE /api/images/:id` - 删除历史图片

## 数据库
- `generated_images` 表: id, model, prompt, aspect_ratio, resolution, image_url, created_at

## 本地存储 (localStorage)
- `nanobanana_tasks` - 任务历史（最近50条，不含参考图 base64）
- `nanobanana_settings` - 设置（API URL、API Key、downloadPrefix、downloadFormat）

## API 架构
- 前端请求 → Express 服务端 → VectorEngine API (api.vectorengine.ai)
- 模型映射: nanobanana-2 → gemini-3-pro-image-preview, nanobanana-pro → gemini-3.1-flash-image-preview
- 联网搜索: 通过 tools: [{ google_search: {} }] 实现
- 深度思考: 通过 thinking_config: { thinking_budget: 8192 } 实现
- 图片格式设置仅影响下载文件名后缀，实际格式由 API 返回决定（通常为 PNG base64）
