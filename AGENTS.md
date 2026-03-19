# 作业极速登记 Pro — [AGENTS.md](http://AGENTS.md)

## Project Overview

轻量化课堂作业登记工具，纯前端实现，无需构建，直接打开 index.html 即可运行。

## Start Here

优先阅读以下文件：

- index.html（应用入口）
- app.js（核心状态与逻辑）
- core.js（数据与存储）
- actions.js（业务操作分发）

## Architecture

- UI：action-views.js
- 状态管理：app.js
- 核心工具与存储：core.js
- 启动入口：boot.js

## Constraints

- 不引入构建工具
- 必须保持纯前端运行（直接打开 index.html）
- 数据存储仅使用 localStorage
- 不修改现有数据结构格式

## Commands

测试：

```plaintext
npm run test


```

E2E：

```plaintext
npm run test:e2e


```

覆盖率：

```plaintext
npm run test:coverage


```

## Verification

修改后必须满足：

1. 所有测试通过
2. 页面可正常打开 index.html
3. 本地数据读写正常

## Do Not Modify

- localStorage 数据结构定义
- 备份文件格式
- 版本号机制

## Execution Rules

- 一次性完成完整任务（实现 + 测试）
- 避免分步骤输出或等待确认
- 修改前先阅读相关文件
- 优先采用最小改动策略

## Testing Strategy

- 优先覆盖 core.js 与状态管理逻辑
- 新功能必须补充对应测试

## Definition of Done

- 功能可运行
- 不破坏现有功能
- 测试全部通过

## Modification Strategy

- 优先复用已有函数
- 避免新增全局状态
- 避免重复逻辑

## Commit Message Rules

- 涉及代码修改时，在回复末尾附带 git commit message
- message 必须存放在代码块内，且仅包含消息主体内容（禁止包含 `git commit -m` 等命令前缀）
- 格式要求为 `<type>: <描述>`
- message 使用简体中文
- 不涉及修改时无需提供
