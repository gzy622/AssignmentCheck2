# 作业登记 AssignmentCheck2

一个轻量化、模块化的课堂作业登记工具，面向教师在课上快速标记作业提交状态和分数。项目无需构建，直接在浏览器中运行，同时保留本地持久化与导入导出能力。

## 功能概览

- **网格化点名登记**：按学号或姓名展示学生卡片，点击即可切换“已完成”状态。
- **分数登记模式**：开启“打分”后可逐个录入学生分数，支持 `0`、`100`、`+1`、`-1` 等快捷操作，并联动提交状态。
- **多任务管理**：支持新增、切换、重命名、删除任务，并维护任务科目标签。
- **名单编辑**：支持批量编辑学生名单，每行一条 `学号 空格 姓名`，可为个别学生添加“排除英语”标记。
- **统计视图**：支持按多个任务汇总查看班级平均完成率、学生完成率和逐项提交明细。
- **展示模式**：提供适合投屏的全屏展示界面。
- **调试面板**：内置开发者调试工具，支持日志查看、筛选和面板拖拽。
- **本地持久化**：数据保存在浏览器 `localStorage`，刷新页面后仍可恢复。
- **备份导入导出**：支持导出为 `assignmentcheck2_backup_YYYYMMDD.json`，导入时会校验数据结构后再覆盖现有数据。
- **动画开关**：可切换界面动画效果，适配低性能设备。
- **移动端适配**：网格会根据视口自动调整尺寸，弹窗针对移动端输入做了专门处理。

## 快速开始

本项目由多个原生 JavaScript 模块组成，无需安装构建工具，直接在浏览器中打开 `index.html` 即可使用。

如果需要运行测试，再安装 Node.js 依赖：

```bash
npm install
npx playwright install chromium
```

## 协作说明

- 仓库根目录的 `AGENTS.md` 是给智能体使用的单一规则入口
- 页面菜单中的版本号在 `index.html` 里维护，发布或功能变更时同步更新

## 测试说明

### 单元测试

```bash
npm run test
```

### 端到端测试

```bash
npm run test:e2e
```

### 全量测试

```bash
npm run test:all
```

### 覆盖率

```bash
npm run test:coverage
```

## 测试结构

- `core.test.js`：基础工具函数与数据读写测试。
- `tests/state.test.js`：应用状态管理逻辑测试。
- `app.spec.js`：核心用户流程 E2E 测试。
- `tests/e2e_present_mode.spec.js`：展示模式 E2E 测试。
- `tests/e2e_preset.spec.js`：预设任务与配置 E2E 测试。

## 项目结构

```text
.
├── index.html          # 应用入口
├── styles.css          # 全局样式
├── core.js             # 核心工具类、localStorage、Debug
├── back-handler.js     # 历史记录与返回键处理
├── modal.js            # 通用弹窗组件
├── app.js              # 全局状态管理与核心逻辑
├── action-views.js     # UI 视图生成逻辑
├── actions.js          # 业务操作分发逻辑
├── boot.js             # 应用引导
├── core.test.js        # 核心单测
├── tests/              # 额外单测与 E2E 测试
├── package.json        # 脚本与依赖
├── package-lock.json   # 依赖锁定
└── AGENTS.md           # 智能体协作与修改约束
```

## 适用场景

- 课堂作业即时登记
- 随堂小测提交追踪
- 需要离线、快速、轻量化记录的教学场景
