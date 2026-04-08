# 作业登记 AssignmentCheck2

一个轻量化、模块化的课堂作业登记工具，面向教师在课上快速标记作业提交状态和分数。项目无需构建，直接在浏览器中运行，同时保留本地持久化与导入导出能力。

## 功能概览

- **网格化点名登记**：按学号或姓名展示学生卡片，点击即可切换"已完成"状态
- **分数登记模式**：开启"打分"后可逐个录入学生分数，支持快捷键盘输入和整十快速打分
- **多任务管理**：支持新增、切换、重命名、删除任务，并维护任务科目标签
- **名单编辑**：批量编辑学生名单，可为个别学生添加"排除英语"标记
- **小测趋势**：按区间查看全班小测成绩，展示均分、最新分、区间变化与得分轨迹
- **本地持久化**：数据保存在浏览器 `localStorage`，刷新页面后仍可恢复
- **备份导入导出**：支持导出为 JSON 备份文件，导入时校验数据结构后覆盖现有数据
- **动画开关**：可切换界面动画效果，适配低性能设备

## 快速开始

### 本地预览

**方式一：直接打开**
直接在浏览器中打开 `index.html` 即可使用。

**方式二：使用预览服务器（推荐）**

```bash
# 使用 http-server（需 Node.js）
npm run preview
# 访问 http://localhost:3000

# 或使用本地脚本（Linux/Mac）
npm run preview:local
# 支持 Python 内置服务器，自动检测端口占用
```

### 运行测试

安装依赖：

```bash
npm install
npx playwright install chromium
```

## 测试

```bash
# 单元测试
npm run test

# 端到端测试
npm run test:e2e

# 全量测试
npm run test:all

# 覆盖率
npm run test:coverage
```

## 项目结构

```text
.
├── index.html          # 应用入口
├── styles.css          # 全局样式
├── core.js             # 核心工具类（DOM、localStorage、颜色、验证等）
├── back-handler.js     # 返回键处理
├── modal.js            # 通用弹窗组件
├── bottom-sheet.js     # 底部滑出面板
├── scorepad.js         # 分数录入面板
├── app.js              # 全局状态管理与核心逻辑
├── action-views.js     # UI 视图生成
├── actions.js          # 业务操作分发
├── boot.js             # 应用引导
├── tests/              # 测试文件
│   ├── *.test.js       # 单元测试
│   ├── *.spec.js       # E2E 测试
│   └── setup.js        # 测试环境初始化
├── scripts/
│   └── preview.sh      # 本地预览服务器脚本（Python）
├── package.json        # 项目配置
├── playwright.config.js    # E2E 测试配置
├── vitest.config.js    # 单元测试配置
└── AGENTS.md           # 智能体协作规范
```

## 文件说明

### 核心文件

| 文件 | 说明 |
|------|------|
| `index.html` | 应用主页面，包含页面结构和模块引用 |
| `styles.css` | 全局样式、CSS 变量、动画、响应式布局 |
| `core.js` | 基础工具：DOM 选择器、localStorage 封装、设备检测、颜色工具、ID 生成器、数据验证器 |
| `app.js` | 状态管理 `State` 和 UI 渲染 `UI`，包含名单解析、任务管理、数据持久化 |
| `actions.js` | 业务操作中心：作业管理、名单编辑、导入导出、小测趋势 |

### UI 组件

| 文件 | 说明 |
|------|------|
| `modal.js` | 弹窗组件，支持全屏/页面模式、渐进式渲染 |
| `bottom-sheet.js` | 底部滑出面板，支持拖拽关闭 |
| `scorepad.js` | 分数录入面板，支持数字键盘和整十快速模式 |
| `action-views.js` | 视图生成工厂，提供弹窗/面板的骨架结构 |

### 其他

| 文件 | 说明 |
|------|------|
| `back-handler.js` | 浏览器返回键处理，实现"再按一次退出" |
| `boot.js` | 应用启动脚本，初始化各模块 |

## 模块依赖

```
index.html
    ├── styles.css
    ├── core.js（基础工具，无依赖）
    ├── back-handler.js → core.js
    ├── modal.js → core.js
    ├── bottom-sheet.js → core.js
    ├── scorepad.js → core.js, app.js
    ├── app.js → core.js, modal.js, back-handler.js
    ├── action-views.js → modal.js
    ├── actions.js → core.js, app.js, modal.js, bottom-sheet.js, scorepad.js
    └── boot.js（初始化所有模块）
```

## 适用场景

- 课堂作业即时登记
- 随堂小测提交追踪
- 需要离线、快速、轻量化记录的教学场景

## 技术特点

- **零构建**：纯原生 JavaScript，无需打包工具
- **模块化**：按功能拆分模块，职责清晰
- **响应式**：适配桌面和移动端
- **渐进式渲染**：大数据量时分块渲染，避免阻塞主线程
- **数据持久化**：localStorage 自动保存，支持导入导出
