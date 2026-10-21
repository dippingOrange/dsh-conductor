# Conductor Task Board（Web UI）

这是 `@local/dsh-conductor` 的可视化面板，独立成一个 Client bundle，便于单独启停。

## 入口

### 1. 输入框工具栏 → 右侧栏 tab（日常使用）

输入框卡片底部工具栏最左侧的 `▦` 图标（`conversation.input.left`）。点击后：

- 在**右侧栏**打开「任务板」tab，聊天与看板并排；
- 当前会话的任务以紧凑单列显示；
- 支持取消（两次确认）、追加指令、完整报告弹窗；
- 顶部可切换「执行者与发布者」；
- 关掉右侧栏后任务继续运行，点 `▦` 随时再打开。

不再向 `conversation.composer.dock` 注入大卡片，因此不会和 activity/usage 参数行挤在一起。

### 2. 整页任务板

左侧栏的 **任务板** 面板图标（`sidebar.panellist`，和 Plugins / Schedule 同级），
对应 `main` slot 里的整页视图（`conductor-tasks`）：

- 三列看板：**进行中 / 已完成 / 失败·取消**；
- 汇总所有会话的任务，顶部按会话名称筛选；
- 卡片显示任务号、角色、执行路由、会话标记、耗时、报告预览；
- 同样支持取消、追加指令、完整报告；
- 顶部「返回对话」回到当前会话。

两个界面都每 2 秒轮询；操作后立即刷新。

### 3. 执行者与发布者

两种看板里都有「执行者与发布者」标签：

- **任务发布者（旗舰）**：选 provider/model，应用为 DSH 默认模型；新建会话使用它；
- **执行者（次旗舰）**：固定角色列表，每个角色绑定 provider/model，可改名、说明、增删；
- **路由策略**：默认只允许使用执行者角色，旗舰不能自行指定 provider/model；
- 保存后写入 `$DSH_HOME/conductor/roles.json`，立即生效。

## 数据来源

由 `@local/dsh-conductor` 的 Host 半注册的同源接口：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/conductor/board?session=<id>` | 当前会话的任务列表 |
| GET | `/conductor/boards` | 所有会话的任务（整页看板用） |
| GET | `/conductor/result?session=<id>&task=<T1>` | 单个任务的完整报告 |
| POST | `/conductor/action` | `{session, task, action: "cancel" \| "followup", message?}` |
| GET | `/conductor/roles` | 发布者、执行者角色、路由策略 |
| POST | `/conductor/roles` | 保存完整的角色配置 |
| GET | `/conductor/routes` | 所有 provider 及其模型（下拉框数据） |
| POST | `/conductor/lead/apply` | 把发布者写回 DSH 默认模型 |

API 与 Web GUI 同源，沿用 GUI 的访问边界，不要把 GUI 端口暴露到不可信网络。

## 文件

- `client.js` —— 浏览器半：slot 注册、紧凑条、整页看板、弹窗、轮询
- `index.js` —— Host 半（空插件，只为挂载 bundle 行）
- `cordis.patch.yml` —— 插件行
- `locale/en.json`、`locale/zh.json` —— Plugin Manager 显示名
- `icon.svg` —— 插件图标

## 开发注意

- 不使用 Harness Client 包，只从浏览器模块表取 `react`；
- 颜色/边框全部使用 `--dsw-alias-*` 主题 token；
- 不读取宿主 DOM，不向 `document.body` 追加节点；
- 修改 `client.js` 后在 Plugin Manager 里关开一次该插件（或刷新页面）即可加载新版本。
