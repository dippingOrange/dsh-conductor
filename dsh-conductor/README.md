# Conductor 多模型调度（DSH 插件）

让**主模型（旗舰）只负责拆解、决策和验收**，把具体实现通过 `dispatch_tasks` 派给其它模型执行；
执行模型是真正的 DSH 子代理，拥有同样的读写文件、跑命令、搜索代码等工具，完成后把报告交回主模型。

```
你 ──对话──▶ 主模型（贵/强）
                │  dispatch_tasks(角色 + 需求 + 验收 + 返回格式 + 执行模型)
                ▼
        ┌───────────────┬───────────────┐
        │ 执行模型 A     │ 执行模型 B     │   ← 便宜的/第三方的/自部署的
        │ 改代码/跑测试  │ 写测试/做审查  │
        └───────┬───────┴───────┬───────┘
                └──── 报告 ──────┘
                ▼
           主模型验收，必要时 task_followup 让同一个执行者返工
```

## 安装

从 npm 安装：

```sh
dsh plugin install @dippingorange/dsh-conductor
dsh plugin install @dippingorange/dsh-conductor-ui
```

本地开发时，在 DSH 的 **Plugin Manager → 安装 bundle** 里选择本仓库的
`dsh-conductor` 和 `dsh-conductor-ui` 两个目录，或使用：

```sh
dsh plugin install /path/to/dsh-conductor/dsh-conductor
dsh plugin install /path/to/dsh-conductor/dsh-conductor-ui
```

安装后刷新一次 Web 页面。两个 bundle 可以独立启停。

## 工具

| 工具 | 作用 |
|---|---|
| `dispatch_tasks` | 一次派发一个或多个任务，立刻返回 `T1/T2...`；可带 `wait_seconds` 直接等首轮结果 |
| `wait_tasks` | 等待并取回报告；`timeout_seconds: 0` 就是查看状态 |
| `task_result` | 取某个任务的完整报告（`wait_tasks` 截断时用） |
| `task_followup` | 给同一个执行者追加要求（返工/补验收/解释），保留它之前的上下文；回复会以后台子代理通知的形式回到当前会话 |
| `cancel_task` | 取消任务，释放并发槽位 |
| `list_executors` | 列出用户配置的执行者角色（id、名称、provider/model），以及当前路由策略 |

每个任务的路由：

- `executor: "coder"` —— 用面板里配置好的执行者角色；默认策略下这是**唯一允许**的方式；
- `provider: "...", model: "..."` —— 仅当你启用了「允许旗舰临时指定 provider/model」；
- `inherit: true` —— 仅当启用 ad-hoc 路由时可用；默认 roles-only 策略下会直接报错。

### 角色修改审计

每次通过 `/conductor/roles` 修改角色时，会追加一条到
`$DSH_HOME/conductor/role-audit.jsonl`，记录时间、lead、策略、改了哪个执行者的
provider/model/name/description/阈值。最近记录可通过：

```text
GET /conductor/roles/audit?limit=50
```

审计是追踪手段，不是安全边界：模型如果有 shell/写文件权限，仍可能直接改
`roles.json`；默认 roles-only + 禁用 inherit 只是堵住插件工具侧最直接的绕过。

### 子代理上限

bundle patch 把全局 `maxActiveSubagents` 限制为 **5**，Conductor 任务和发布者原生子代理
都计入这个上限；Conductor 自己最多同时跑 4 个任务。

### follow-up 状态

对已完成/失败任务执行 `task_followup` 后，任务会重新标记为 `running` 并显示「返工中」；
插件会轮询 child 的活跃状态，child 变为 inactive 后把任务改回 `completed`。

### 任务板快照与恢复

```text
GET  /conductor/export   # 导出所有会话的终态任务、完整报告、统计
POST /conductor/import   # 插件重载后恢复终态任务（running/queued 会跳过）
```

导入使用当前仍然存活的 session；恢复的任务保留 `childId`、报告、follow-up 数量与上下文统计。

### 空报告与 max-tokens

执行者因输出 token 上限（`max-tokens`）停止、或完成但没有 closing report 时，任务会显示明确
的 `error`，不再出现「completed + 空 preview + error:null」。执行者 prompt 也要求将大型
SVG/HTML/代码写入文件，最终只返回简短报告。

### 执行者报告契约

- 执行者只负责执行，决定权在发布者
- 不得返回整个文件、完整 diff 或生成的产物；只给路径和必要短摘录
- 必须汇报关键事实：状态、改动路径、验证证据、验收 pass/fail、阻塞/未决事实
- 不得给建议、优先级或下一步方案；不要出现「建议」「下一步」「可以考虑」这类段落
- 最终结论可以适当精简，不要重复整份报告

### 完成通知

`dispatch_tasks` 使用 `delivery: 'parent'` 启动 child，因此执行者完成时，发布者会收到一条
background subagent 完成通知，即使发布者已经先回复了用户。发布者的系统提示要求：

- 任务未完成时不能声称已完成
- 收到完成通知后，把结果转告用户，或调用 `wait_tasks` 取完整报告

> 这条通知依赖 DSH 的 session 持久化；`task_followup` 的完成通知走同一条通道。

## 可视化任务板

另装了一个独立的 Web UI bundle `@dippingorange/dsh-conductor-ui`，提供两个入口：

**1. 输入框工具栏入口（日常使用）**：输入框卡片底部工具栏最左侧的 `▦` 图标。
点击后在**右侧栏**打开「任务板」tab，聊天和看板并排，不再占用输入框下方的
activity/usage 参数行。

- 当前会话的任务以紧凑单列显示；
- **取消**（点两次确认）、**追加指令**、**报告**（完整报告弹窗）；
- 顶部可切换到「执行者与发布者」；
- 关掉右侧栏后，任务仍在后台运行，点 `▦` 随时再打开。

**2. 整页任务板**：左侧栏的 **任务板** 面板图标（和 Plugins / Schedule 同级）。

- 三列看板：**进行中 / 已完成 / 失败·取消**；
- 汇总所有会话的任务，顶部可按会话名称筛选；
- 每张卡片带会话标记、执行路由、耗时、报告预览；
- 同样支持取消、追加指令、查看完整报告；
- 顶部「返回对话」回到当前会话。

两个界面都每 2 秒自动刷新；颜色、边框、弹窗全部使用 `--dsw-alias-*`
主题 token，跟随明暗主题。数据来自 Host 的 `/conductor/board`、
`/conductor/boards`、`/conductor/result`、`/conductor/action` 同源接口，
不额外保存 API key。UI 是独立插件，可以在 Plugin Manager 里单独关掉。

> 首次安装后如果没看到入口，刷新一次页面（Ctrl+R）。面板 API 与 Web GUI 同源，
> 沿用 GUI 的访问边界；不要把 GUI 端口暴露到不可信网络。

## 上下文预算与压缩

执行者仍然按任务隔离：每次 `dispatch_tasks` 都新建 child，新任务不会继承上一个任务的上下文；
唯一复用上下文的是 `task_followup`。

任务（包括 follow-up）结束后，插件读取 child 最后一次请求的 input tokens 和模型 context
window。如果占用 **≥ 40%**（默认值按 DeepSeek 在 40% 后质量下降的观察设置），它会重新
resume 这个 child session，调用 Host 的 compaction
服务（与 `/compact` 同一后端）压缩，记录压缩后的占用并释放 session。下一次 follow-up
冷启动时看到的是压缩后的历史；新任务仍然从全新 child 开始，没有旧上下文需要压缩。

每个执行者的最近一次任务会在 **执行者与发布者** 和任务卡片中显示：

- 上下文占用百分比
- 上次压缩至今的对话轮数

压缩成功后，左侧 **任务板** 图标和 **执行者与发布者** tab 会出现绿点；打开对应界面后清除。

配置项：

| 键 | 默认 | 含义 |
|---|---|---|
| `contextCompactionPercent` | `40` | 最后一次请求占 context window 的百分比阈值；每个执行者可覆盖 |
| `contextWindowTokens` | `128000` | provider 未报告窗口时的回退值 |
| `contextWindowMax` | `0` | 百分比计算的可选上限；0 表示用 provider 报告值 |
| `compactionTimeoutMs` | `30000` | 压缩超时 |

bundle 会重新启用 Host 的 `compaction-basic` / `command-compact`（Web app 默认把它们留给
preset），因此普通聊天里的 `/compact` 也可用。

## 先加模型路由（一次性）

插件只负责“派给谁”，模型提供方由 DSH 自带的 **Settings → Models** 管理。三种来源：

### 1. OpenCode Zen（opencode 订阅）

DSH 的 pi-ai 适配器**内置** OpenCode Zen 提供方。

1. Settings → Models → **Add model provider**；
2. 选 **Third-party model provider** → **OpenCode Zen**；
3. 粘贴 API key（会以 `OPENCODE_API_KEY` 凭据引用保存，不写进配置文件）；
4. 在模型列表里保留/添加要用的 id，例如 `claude-haiku-4-5`、`gpt-5.4-mini`。

### 2. Command Code（command code 订阅）

Command Code 提供 OpenAI / Anthropic 兼容的 Provider API（需要 Pro 及以上套餐）。

1. 在 Command Code Studio 创建 API key；
2. Settings → Models → **Add model provider** → **Custom model API**；
3. Provider ID 填 `command-code`；
4. 协议选 **OpenAI Chat Completions**；
5. 端点填 `https://api.commandcode.ai/provider/v1`；
6. 模型 id 从 `https://api.commandcode.ai/provider/v1/models` 取，例如
   `deepseek/deepseek-v4-flash`（便宜、适合执行）；
7. 粘贴 API key。

> Command Code 的 Claude 模型走 Anthropic Messages 端点（`https://api.commandcode.ai/provider`），
> 但该端点的鉴权头与 pi-ai 的 Anthropic 适配器可能不一致；用它家 OpenAI 兼容模型最稳，
> 这些通常也正是适合当执行器的低价模型。

### 3. 自部署模型（vLLM / Ollama / LM Studio / 任何 OpenAI 兼容服务）

1. Settings → Models → **Add model provider** → **Custom model API**；
2. Provider ID 例如 `local`；
3. 协议选 **OpenAI Chat Completions**；
4. 端点：vLLM `http://127.0.0.1:8000/v1`，Ollama `http://127.0.0.1:11434/v1`，LM Studio `http://127.0.0.1:1234/v1`；
5. 模型 id 填服务端实际提供的 id；
6. **API key 填一个占位值**（例如 `local`）。OpenAI 兼容实现要求带 key；
   全新空白 key 会保存为“无凭据”，请求可能失败。

配置完成后，让主模型调用 `list_executors` 就能看到可用的 provider/model 和角色。

## 设置执行者与发布者（Web 面板）

打开左侧栏的 **任务板** → **执行者与发布者** 标签：

- **任务发布者（旗舰）**：选择 provider/model，点「应用为默认发布者」写回 DSH 的默认模型；
  之后新建会话会使用它。当前会话仍可在输入框的模型选择器里切换。
- **执行者（次旗舰）**：每行是一个固定角色，绑定 provider/model；可以改名称、说明、增删。
  角色 id（如 `coder`）就是 `dispatch_tasks` 的 `executor` 值，名称只用于展示。
- **路由策略**：默认「只允许使用执行者角色」，旗舰不能自己编 provider/model。
  需要临时放开时勾选「允许旗舰临时指定 provider/model」。
- 点「保存配置」写入 `$DSH_HOME/conductor/roles.json`，立即生效，无需重启。

默认策略是 **executor roles only**：主模型只能把任务派给你配置的角色，模型选择权在你手里。
如果角色列表为空，`dispatch_tasks` 会拒绝派发并提示去面板添加。

## 推荐用法

对着主模型说：

> 这个需求按模块拆一下：实现用 `coder`，审查用 `reviewer`；
> 每个任务给出验收标准和返回格式，做完汇总给我。

主模型会自己 `dispatch_tasks` → `wait_tasks` → 对照验收标准检查 → 不满意就
`task_followup` 让同一个执行者返工。模型路由由你在「执行者与发布者」里固定，
主模型只负责拆解、派发和验收。

任务运行期间你可以继续和主模型讨论别的模块，也可以让它 `wait_tasks` 等一下。

## 行为细节

- **子代理是完整 Agent**：继承当前工作目录、工具集、权限范围和会话谱系；可以读写文件、执行 PowerShell、跑测试。
- **并发**：`maxConcurrent` 限制本插件同时运行的数量；DSH 每个委派树还有 `maxActiveSubagents`（默认 8）。
- **槽位释放**：任务结束后立即释放子代理槽位；`task_followup` 会冷恢复同一个子会话，保留上下文。
- **结果控制权**：使用 `delivery: 'caller'`，完成通知不会直接刷进主对话，由 `wait_tasks` / `dispatch_tasks(wait_seconds)` 统一汇总，避免多个子任务各刷一条消息。
- **返工闭环**：任务结束后子代理槽位立即释放；`task_followup` 会让同一个子会话冷恢复，它的回复以一条后台子代理通知回到主对话，主模型被唤醒后继续验收或汇总。
- **对话隔离**：执行者看不到主对话，所以 `task` 和 `context` 必须自包含；把相关文件路径写进 `files`。

## 限制

- 执行器必须先在 Settings → Models 里配置好；`list_executors` 能确认实际可用路由。
- 单个报告默认截断到 6000 字符（`wait_tasks`），完整内容用 `task_result` 或网页里的「报告」。
- 依赖 DSH 的 `spawn` 子代理后端（本 profile 已内置）。
- 插件工具对所有会话可见；它是 profile 级安装。
- 任务板数据在 Host 内存里，DSH 重启后任务记录会清空（子会话日志仍保留）。
- 角色配置持久化在 `$DSH_HOME/conductor/roles.json`；`cordis.patch.yml` 的 `executors`
  只在文件不存在时作为初始种子。

## 文件

- `index.js` —— Host 插件本体（无第三方依赖），含任务板、角色与 HTTP 接口
- `cordis.patch.yml` —— 插件行与默认配置（角色初始种子）
- `locale/en.json`、`locale/zh.json` —— 插件管理页显示名
- `icon.svg` —— 插件图标
- 角色配置：`$DSH_HOME/conductor/roles.json`
- UI bundle：仓库里的 `dsh-conductor-ui/`（`client.js` 为任务板 + 角色编辑界面）
