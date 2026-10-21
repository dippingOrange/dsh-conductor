window.__ModuleLoader__.load({
  id: '@local/dsh-conductor-ui',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useRef, useState } = React
    const h = React.createElement

    const NS = 'conductor'
    const PANEL_ID = 'conductor-tasks'
    const BOARD_TAB_ID = '@local/dsh-conductor-ui/board'
    const BOARD_TAB_KIND = 'conductor-board'

    const zh = {
      title: 'Conductor 任务板',
      panel: '任务板',
      refresh: '刷新',
      'page.title': 'Conductor 任务板',
      'page.subtitle': '所有会话的执行任务、状态和报告',
      'page.back': '返回对话',
      'page.session': '会话',
      'page.sessionAll': '全部会话',
      'page.loading': '正在读取任务…',
      'page.empty': '没有任务',
      'page.open': '在任务板页面中打开',
      'column.active': '进行中',
      'column.done': '已完成',
      'column.failed': '失败 / 取消',
      'tab.tasks': '任务',
      'tab.roles': '执行者与发布者',
      'roles.lead': '任务发布者（旗舰）',
      'roles.leadHint': '保存默认发布者；应用后新建会话会使用它。当前会话仍可在输入框的模型选择器切换。',
      'roles.executors': '执行者（次旗舰）',
      'roles.executorsHint': '旗舰只能把任务派给这些角色，模型由你固定。',
      'roles.add': '添加执行者',
      'roles.added': '已添加执行者；保存后生效',
      'roles.remove': '删除',
      'roles.save': '保存配置',
      'roles.apply': '应用为默认发布者',
      'roles.applyNew': '应用并新建会话',
      'roles.id': 'ID',
      'roles.name': '名称',
      'roles.provider': 'Provider',
      'roles.model': '模型',
      'roles.description': '说明',
      'roles.policy': '允许旗舰临时指定 provider/model（关闭后只能使用上面的执行者）',
      'roles.default': '当前默认模型',
      'roles.unset': '未设置',
      'roles.saved': '配置已保存',
      'roles.applied': '已应用默认发布者',
      'roles.loading': '正在读取角色配置…',
      'roles.empty': '还没有执行者，点击“添加执行者”',
      'roles.error': '操作失败',
      'roles.incomplete': '每个执行者都必须选择 provider 和模型',
      'roles.needLead': '先选择发布者模型',
      'label.running': '运行中',
      'label.done': '已完成',
      'label.failed': '失败',
      'label.followups': '追加指令',
      'filter.all': '全部',
      'filter.active': '进行中',
      'filter.done': '已完成',
      'filter.failed': '失败/取消',
      'status.queued': '排队中',
      'status.starting': '启动中',
      'status.running': '运行中',
      'status.completed': '已完成',
      'status.failed': '失败',
      'status.cancelled': '已取消',
      'action.cancel': '取消',
      'action.confirmCancel': '确认取消',
      'action.followup': '追加指令',
      'action.report': '报告',
      'action.send': '发送',
      'action.close': '关闭',
      'followup.placeholder': '给执行者补充要求、验收点或返工说明…',
      'notice.cancelled': '任务已取消',
      'notice.followup': '指令已发送，回复会作为后台子代理通知回来',
      'notice.failed': '操作失败',
      'error.load': '读取任务失败',
      'empty.filter': '这个筛选下没有任务',
      'detail.loading': '正在读取报告…',
      'detail.empty': '（没有报告内容）',
    }

    const en = {
      title: 'Conductor board',
      panel: 'Tasks',
      refresh: 'Refresh',
      'page.title': 'Conductor board',
      'page.subtitle': 'Execution tasks, status, and reports across sessions',
      'page.back': 'Back to chat',
      'page.session': 'Session',
      'page.sessionAll': 'All sessions',
      'page.loading': 'Loading tasks…',
      'page.empty': 'No tasks',
      'page.open': 'Open the full task board',
      'column.active': 'Active',
      'column.done': 'Done',
      'column.failed': 'Failed / cancelled',
      'tab.tasks': 'Tasks',
      'tab.roles': 'Executors & publisher',
      'roles.lead': 'Task publisher (flagship)',
      'roles.leadHint': 'Saved as the default publisher; new sessions use it. The current session keeps its composer model.',
      'roles.executors': 'Executors (sub-flagship)',
      'roles.executorsHint': 'The flagship may only assign work to these roles; you fix each model.',
      'roles.add': 'Add executor',
      'roles.added': 'Executor added; save to apply',
      'roles.remove': 'Remove',
      'roles.save': 'Save configuration',
      'roles.apply': 'Apply as default publisher',
      'roles.applyNew': 'Apply and start a new session',
      'roles.id': 'ID',
      'roles.name': 'Name',
      'roles.provider': 'Provider',
      'roles.model': 'Model',
      'roles.description': 'Description',
      'roles.policy': 'Allow the flagship to name provider/model ad hoc (off = configured executors only)',
      'roles.default': 'Current default model',
      'roles.unset': 'Not set',
      'roles.saved': 'Configuration saved',
      'roles.applied': 'Default publisher applied',
      'roles.loading': 'Loading roles…',
      'roles.empty': 'No executors yet — click “Add executor”',
      'roles.error': 'Action failed',
      'roles.incomplete': 'Every executor needs a provider and a model',
      'roles.needLead': 'Choose a publisher model first',
      'label.running': 'running',
      'label.done': 'done',
      'label.failed': 'failed',
      'label.followups': 'follow-ups',
      'filter.all': 'All',
      'filter.active': 'Active',
      'filter.done': 'Done',
      'filter.failed': 'Failed',
      'status.queued': 'queued',
      'status.starting': 'starting',
      'status.running': 'running',
      'status.completed': 'completed',
      'status.failed': 'failed',
      'status.cancelled': 'cancelled',
      'action.cancel': 'Cancel',
      'action.confirmCancel': 'Confirm',
      'action.followup': 'Follow up',
      'action.report': 'Report',
      'action.send': 'Send',
      'action.close': 'Close',
      'followup.placeholder': 'Add requirements, acceptance checks, or corrections…',
      'notice.cancelled': 'Task cancelled',
      'notice.followup': 'Instruction sent; the reply arrives as a background subagent notice',
      'notice.failed': 'Action failed',
      'error.load': 'Could not load tasks',
      'empty.filter': 'No tasks in this filter',
      'detail.loading': 'Loading report…',
      'detail.empty': '(no report content)',
    }

    const CSS = `
.dsh-cb { border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); border-radius:10px; margin:8px 0 0; overflow:hidden; font-size:12px; color:var(--dsw-alias-label-primary); }
/* The composer dock is a single flex row shared with the activity/usage pills.
   When the board is present, let the row wrap and give the board its own line,
   centered at the composer card width. */
[data-composer-dock]:has(.dsh-cb) { flex-wrap:wrap; align-items:flex-start; row-gap:0; }
[data-composer-dock]:has(.dsh-cb) > .dsh-cb,
[data-composer-dock] > *:has(> .dsh-cb) { flex:0 0 100%; width:100%; max-width:var(--dsh-composer-card-max-width); margin:8px auto 0; }
.dsh-cb-head { display:flex; align-items:center; gap:4px; padding:5px 8px 5px 4px; }
.dsh-cb-toggle { flex:1; min-width:0; display:flex; align-items:center; gap:8px; border:0; background:transparent; color:inherit; padding:4px 6px; border-radius:6px; cursor:pointer; text-align:left; font:inherit; }
.dsh-cb-toggle:hover { background:var(--dsw-alias-bg-layer-2); }
.dsh-cb-toggle:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }
.dsh-cb-mark { display:flex; color:var(--dsw-alias-brand-primary); flex:none; }
.dsh-cb-title { font-weight:600; white-space:nowrap; }
.dsh-cb-stats { color:var(--dsw-alias-label-secondary); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dsh-cb-chevron { margin-left:auto; color:var(--dsw-alias-label-secondary); font-size:10px; flex:none; }
.dsh-cb-icon { border:0; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:14px; padding:0; flex:none; }
.dsh-cb-icon:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dsh-cb-icon:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }
.dsh-cb-body { border-top:1px solid var(--dsw-alias-border-l1); padding:8px; display:flex; flex-direction:column; gap:8px; max-height:46vh; overflow:auto; }
.dsh-cb-filters { display:flex; gap:4px; flex-wrap:wrap; }
.dsh-cb-filter { border:1px solid transparent; background:transparent; color:var(--dsw-alias-label-secondary); border-radius:999px; padding:2px 8px; font-size:11px; cursor:pointer; font:inherit; }
.dsh-cb-filter:hover { background:var(--dsw-alias-bg-layer-2); }
.dsh-cb-filter[aria-pressed="true"] { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-border-l1); }
.dsh-cb-task { border:1px solid var(--dsw-alias-border-l1); border-radius:8px; padding:7px 8px; display:flex; gap:8px; background:var(--dsw-alias-bg-base); }
.dsh-cb-task:hover { border-color:var(--dsw-alias-border-l2); }
.dsh-cb-dot { width:7px; height:7px; border-radius:50%; margin-top:5px; flex:none; background:var(--dsw-alias-state-idle-primary); }
.dsh-cb-dot.running { background:var(--dsw-alias-brand-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); animation:dsh-cb-pulse 1.6s ease-in-out infinite; }
.dsh-cb-dot.completed { background:var(--dsw-alias-state-success-primary); }
.dsh-cb-dot.failed { background:var(--dsw-alias-state-error-primary); }
.dsh-cb-dot.cancelled { background:var(--dsw-alias-state-idle-primary); }
@keyframes dsh-cb-pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }
.dsh-cb-main { flex:1; min-width:0; }
.dsh-cb-line { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dsh-cb-id { font-weight:600; font-variant-numeric:tabular-nums; }
.dsh-cb-role { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px; }
.dsh-cb-pill { font-size:10px; padding:1px 6px; border-radius:999px; border:1px solid var(--dsw-alias-border-l1); color:var(--dsw-alias-label-secondary); white-space:nowrap; }
.dsh-cb-pill.running { color:var(--dsw-alias-brand-primary); border-color:var(--dsw-alias-brand-primary); }
.dsh-cb-pill.completed { color:var(--dsw-alias-state-success-primary); border-color:var(--dsw-alias-state-success-primary); }
.dsh-cb-pill.failed { color:var(--dsw-alias-state-error-primary); border-color:var(--dsw-alias-state-error-primary); }
.dsh-cb-elapsed { margin-left:auto; color:var(--dsw-alias-label-secondary); font-size:11px; font-variant-numeric:tabular-nums; }
.dsh-cb-sub { color:var(--dsw-alias-label-secondary); font-size:11px; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dsh-cb-preview { color:var(--dsw-alias-label-secondary); font-size:11px; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:.9; }
.dsh-cb-actions { display:flex; flex-direction:column; gap:4px; flex:none; justify-content:flex-start; }
.dsh-cb-btn { border:1px solid var(--dsw-alias-border-l1); background:transparent; color:var(--dsw-alias-label-secondary); border-radius:6px; padding:3px 7px; font-size:11px; cursor:pointer; white-space:nowrap; font:inherit; }
.dsh-cb-btn:hover { border-color:var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dsh-cb-btn:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }
.dsh-cb-btn.primary { color:var(--dsw-alias-brand-primary); border-color:var(--dsw-alias-brand-primary); }
.dsh-cb-btn.danger { color:var(--dsw-alias-state-error-primary); }
.dsh-cb-btn:disabled { opacity:.5; cursor:default; }
.dsh-cb-followup { margin:6px 0 2px 15px; display:flex; flex-direction:column; gap:5px; }
.dsh-cb-input { width:100%; box-sizing:border-box; resize:vertical; min-height:48px; max-height:120px; padding:6px 8px; border-radius:6px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; }
.dsh-cb-input:focus { outline:none; border-color:var(--dsw-alias-brand-primary); }
.dsh-cb-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.dsh-cb-error { color:var(--dsw-alias-state-error-primary); font-size:11px; }
.dsh-cb-notice { color:var(--dsw-alias-state-success-primary); font-size:11px; }
.dsh-cb-empty { color:var(--dsw-alias-label-secondary); font-size:11px; padding:8px 4px; text-align:center; }
.dsh-cb-spacer { flex:1; }
.dsh-cb-backdrop { position:fixed; inset:0; z-index:80; display:flex; align-items:center; justify-content:center; padding:24px; background:color-mix(in srgb, var(--dsw-alias-bg-base) 58%, transparent); backdrop-filter:blur(2px); }
.dsh-cb-modal { width:min(760px,100%); max-height:82vh; display:flex; flex-direction:column; background:var(--dsw-alias-bg-overlay); border:1px solid var(--dsw-alias-border-l2); border-radius:12px; box-shadow:0 24px 70px rgba(0,0,0,.35); overflow:hidden; }
.dsh-cb-modal-head { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid var(--dsw-alias-border-l1); flex-wrap:wrap; }
.dsh-cb-modal-title { font-weight:600; font-size:13px; }
.dsh-cb-modal-body { padding:12px 14px; overflow:auto; }
.dsh-cb-pre { margin:0; white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; line-height:1.55; color:var(--dsw-alias-label-primary); }
.dsh-cb-modal-foot { display:flex; justify-content:flex-end; gap:8px; padding:10px 14px; border-top:1px solid var(--dsw-alias-border-l1); }
.dsh-cb-scrollbar { scrollbar-width:thin; }
.dsh-cb-page { min-height:100%; box-sizing:border-box; padding:24px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-size:13px; overflow:auto; }
.dsh-cb-page-inner { max-width:1120px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
.dsh-cb-page-head { display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.dsh-cb-page-title { font-size:18px; font-weight:600; line-height:1.3; }
.dsh-cb-page-sub { color:var(--dsw-alias-label-secondary); font-size:12px; margin-top:4px; }
.dsh-cb-page-tools { display:flex; gap:6px; align-items:center; margin-left:auto; }
.dsh-cb-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.dsh-cb-tabs { display:flex; gap:4px; border-bottom:1px solid var(--dsw-alias-border-l1); }
.dsh-cb-tab { border:0; background:transparent; color:var(--dsw-alias-label-secondary); padding:6px 10px; font:inherit; font-size:12px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
.dsh-cb-tab:hover { color:var(--dsw-alias-label-primary); }
.dsh-cb-tab[aria-selected="true"] { color:var(--dsw-alias-brand-primary); border-bottom-color:var(--dsw-alias-brand-primary); }
.dsh-cb-roles { display:flex; flex-direction:column; gap:12px; max-width:820px; }
.dsh-cb-role-card { border:1px solid var(--dsw-alias-border-l1); border-radius:10px; background:var(--dsw-alias-bg-layer-1); padding:12px; display:flex; flex-direction:column; gap:10px; }
.dsh-cb-role-title { font-size:13px; font-weight:600; }
.dsh-cb-role-hint { color:var(--dsw-alias-label-secondary); font-size:11px; line-height:1.5; }
.dsh-cb-role-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; }
.dsh-cb-field { display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--dsw-alias-label-secondary); min-width:0; }
.dsh-cb-field input, .dsh-cb-field select { height:28px; box-sizing:border-box; padding:3px 8px; border-radius:6px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; min-width:0; }
.dsh-cb-field input:focus, .dsh-cb-field select:focus { outline:none; border-color:var(--dsw-alias-brand-primary); }
.dsh-cb-field input[readonly] { opacity:.65; }
.dsh-cb-role-list { display:flex; flex-direction:column; gap:10px; }
.dsh-cb-role-actions { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.dsh-cb-role-footer { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.dsh-cb-check { display:flex; gap:8px; align-items:flex-start; font-size:12px; color:var(--dsw-alias-label-primary); }
.dsh-cb-check input { margin-top:2px; }
.dsh-cb-select { background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); border:1px solid var(--dsw-alias-border-l1); border-radius:6px; padding:4px 8px; font:inherit; font-size:12px; }
.dsh-cb-columns { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; align-items:start; }
.dsh-cb-column { background:var(--dsw-alias-bg-layer-1); border:1px solid var(--dsw-alias-border-l1); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; min-height:140px; }
.dsh-cb-column-head { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; }
.dsh-cb-column-count { color:var(--dsw-alias-label-secondary); font-weight:400; margin-left:auto; }
.dsh-cb-page .dsh-cb-task { display:block; }
.dsh-cb-page .dsh-cb-followup { margin-left:0; }
.dsh-cb-page .dsh-cb-role { max-width:none; margin-top:4px; font-weight:600; white-space:normal; }
.dsh-cb-page .dsh-cb-actions { flex-direction:row; margin-top:6px; flex-wrap:wrap; }
.dsh-cb-page .dsh-cb-empty { padding:16px 4px; }
@media (max-width:900px) { .dsh-cb-columns { grid-template-columns:1fr; } .dsh-cb-page { padding:16px; } }
@media (max-width:720px) { .dsh-cb-stats { display:none; } .dsh-cb-role { max-width:120px; } }
@media (prefers-reduced-motion:reduce) { .dsh-cb-dot.running { animation:none; } }
.dsh-cb-launcher { width:28px; height:28px; border:0; background:transparent; color:var(--dsw-alias-label-secondary); border-radius:6px; display:flex; align-items:center; justify-content:center; padding:0; cursor:pointer; flex:none; }
.dsh-cb-launcher:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dsh-cb-launcher:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:1px; }
.dsh-cb-compact { padding:12px; }
.dsh-cb-compact .dsh-cb-columns { grid-template-columns:1fr; }
.dsh-cb-compact .dsh-cb-page-title { font-size:16px; }
`

    const ACTIVE = new Set(['queued', 'starting', 'running'])
    const RANK = { running: 0, starting: 0, queued: 1, failed: 2, completed: 3, cancelled: 4 }

    function isActive(task) {
      return ACTIVE.has(task.status)
    }

    function statusClass(status) {
      return status === 'starting' || status === 'running' ? 'running' : status
    }

    function formatDuration(ms) {
      const total = Math.max(0, Math.round(ms / 1000))
      if (total < 60) return `${total}s`
      const minutes = Math.floor(total / 60)
      const seconds = total % 60
      if (minutes < 60) return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return rest === 0 ? `${hours}h` : `${hours}h${rest}m`
    }

    function errorText(value) {
      return value instanceof Error ? value.message : String(value)
    }

    function taskKeyOf(task) {
      return `${task.session}:${task.id}`
    }

    function selectSessionId(snapshot) {
      return snapshot.sessionId
    }

    function useBoard(sessionId) {
      const [board, setBoard] = useState(null)
      const [error, setError] = useState(null)
      const inFlight = useRef(false)
      const load = useCallback(async () => {
        if (sessionId === undefined || sessionId === null) return
        if (inFlight.current) return
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        inFlight.current = true
        try {
          const response = await fetch(
            `/conductor/board?session=${encodeURIComponent(sessionId)}`,
            { cache: 'no-store', headers: { accept: 'application/json' } },
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const value = await response.json()
          setBoard(value)
          setError(null)
        } catch (cause) {
          setError(errorText(cause))
        } finally {
          inFlight.current = false
        }
      }, [sessionId])
      useEffect(() => {
        void load()
        const timer = setInterval(() => {
          void load()
        }, 2000)
        return () => clearInterval(timer)
      }, [load])
      return { board, error, reload: load }
    }

    function useAllBoards() {
      const [data, setData] = useState(null)
      const [error, setError] = useState(null)
      const inFlight = useRef(false)
      const load = useCallback(async () => {
        if (inFlight.current) return
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        inFlight.current = true
        try {
          const response = await fetch('/conductor/boards', {
            cache: 'no-store',
            headers: { accept: 'application/json' },
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const value = await response.json()
          setData(value)
          setError(null)
        } catch (cause) {
          setError(errorText(cause))
        } finally {
          inFlight.current = false
        }
      }, [])
      useEffect(() => {
        void load()
        const timer = setInterval(() => {
          void load()
        }, 3000)
        return () => clearInterval(timer)
      }, [load])
      return { data, error, reload: load }
    }

    async function postAction(payload) {
      const response = await fetch('/conductor/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let value = {}
      try {
        value = await response.json()
      } catch {
        value = {}
      }
      if (!response.ok || value.ok === false) {
        throw new Error(value.error === undefined ? `HTTP ${response.status}` : value.error)
      }
      return value
    }

    function BoardMark() {
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M5 19V9M12 19V5M19 19v-6',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
        }),
      )
    }

    function ConductorPanelIcon(props) {
      const size = typeof props.size === 'number' ? props.size : 18
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M4 6h16M4 12h9M4 18h12',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
        }),
      )
    }

    function ConductorLauncher(props) {
      const tr = typeof props.t === 'function' ? props.t : (key) => key
      return h(
        'button',
        {
          type: 'button',
          className: 'dsh-cb-launcher',
          title: tr('page.title'),
          'aria-label': tr('page.title'),
          onClick: () => props.openBoard(),
        },
        h(BoardMark),
      )
    }

    function ConductorDock(props) {
      const hookSessionId =
        typeof props.useSession === 'function' ? props.useSession(selectSessionId) : undefined
      const sessionId =
        props.sessionId ?? (props.session && props.session.id) ?? hookSessionId
      const tr = typeof props.t === 'function' ? props.t : (key) => key

      const [open, setOpen] = useState(() => {
        try {
          return localStorage.getItem('dsh.conductor.open') !== '0'
        } catch {
          return true
        }
      })
      const [filter, setFilter] = useState('all')
      const [detail, setDetail] = useState(null)
      const [followup, setFollowup] = useState(null)
      const [confirmCancel, setConfirmCancel] = useState(null)
      const [busyCancel, setBusyCancel] = useState(null)
      const [notice, setNotice] = useState(null)
      const noticeTimer = useRef(undefined)
      const confirmTimer = useRef(undefined)
      const autoCollapsed = useRef(false)

      const { board, error, reload } = useBoard(sessionId)

      useEffect(() => {
        if (autoCollapsed.current || board === null) return
        autoCollapsed.current = true
        let saved = null
        try {
          saved = localStorage.getItem('dsh.conductor.open')
        } catch {
          saved = null
        }
        const tasks = Array.isArray(board.tasks) ? board.tasks : []
        if (saved === null && !tasks.some(isActive)) setOpen(false)
      }, [board])

      useEffect(
        () => () => {
          if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current)
          if (confirmTimer.current !== undefined) clearTimeout(confirmTimer.current)
        },
        [],
      )

      useEffect(() => {
        if (detail === null) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setDetail(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [detail])

      function notify(text) {
        setNotice(text)
        if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), 3500)
      }

      function toggle() {
        setOpen((value) => {
          const next = !value
          try {
            localStorage.setItem('dsh.conductor.open', next ? '1' : '0')
          } catch {
            /* ignore storage failures */
          }
          return next
        })
      }

      async function cancelTask(task) {
        if (confirmCancel !== task.id) {
          setConfirmCancel(task.id)
          if (confirmTimer.current !== undefined) clearTimeout(confirmTimer.current)
          confirmTimer.current = setTimeout(() => setConfirmCancel(null), 4000)
          return
        }
        setConfirmCancel(null)
        setBusyCancel(task.id)
        try {
          await postAction({ session: sessionId, task: task.id, action: 'cancel' })
          notify(`${tr('notice.cancelled')} · ${task.id}`)
          await reload()
        } catch (cause) {
          notify(`${tr('notice.failed')}: ${errorText(cause)}`)
        } finally {
          setBusyCancel(null)
        }
      }

      async function sendFollowup() {
        if (followup === null || followup.text.trim() === '') return
        const current = followup
        setFollowup({ ...current, busy: true, error: null })
        try {
          await postAction({
            session: sessionId,
            task: current.id,
            action: 'followup',
            message: current.text.trim(),
          })
          setFollowup(null)
          notify(`${tr('notice.followup')} · ${current.id}`)
          await reload()
        } catch (cause) {
          setFollowup({ ...current, busy: false, error: errorText(cause) })
        }
      }

      async function openReport(task) {
        setDetail({ task, loading: true, result: null, error: null })
        try {
          const response = await fetch(
            `/conductor/result?session=${encodeURIComponent(sessionId)}&task=${encodeURIComponent(task.id)}`,
            { cache: 'no-store', headers: { accept: 'application/json' } },
          )
          const value = await response.json()
          if (!response.ok || value.ok === false) {
            throw new Error(value.error === undefined ? `HTTP ${response.status}` : value.error)
          }
          setDetail({ task, loading: false, result: value.task, error: null })
        } catch (cause) {
          setDetail({ task, loading: false, result: null, error: errorText(cause) })
        }
      }

      if (typeof sessionId !== 'string' || sessionId === '') return null
      if (board === null) return null
      const tasks = Array.isArray(board.tasks) ? board.tasks : []
      if (tasks.length === 0) return null

      const sorted = [...tasks].sort(
        (a, b) => (RANK[a.status] ?? 5) - (RANK[b.status] ?? 5) || a.createdAt - b.createdAt,
      )
      const counts = {
        all: tasks.length,
        active: tasks.filter(isActive).length,
        done: tasks.filter((task) => task.status === 'completed').length,
        failed: tasks.filter((task) => task.status === 'failed' || task.status === 'cancelled').length,
      }
      const filtered = sorted.filter((task) => {
        if (filter === 'active') return isActive(task)
        if (filter === 'done') return task.status === 'completed'
        if (filter === 'failed') return task.status === 'failed' || task.status === 'cancelled'
        return true
      })
      const stats = [
        counts.active > 0 ? `${counts.active} ${tr('label.running')}` : null,
        counts.done > 0 ? `${counts.done} ${tr('label.done')}` : null,
        counts.failed > 0 ? `${counts.failed} ${tr('label.failed')}` : null,
      ]
        .filter(Boolean)
        .join(' · ')

      function renderFollowup(task) {
        if (followup === null || followup.id !== task.id) return null
        return h(
          'div',
          { className: 'dsh-cb-followup' },
          h('textarea', {
            className: 'dsh-cb-input',
            value: followup.text,
            placeholder: tr('followup.placeholder'),
            onChange: (event) =>
              setFollowup({ ...followup, text: event.target.value, error: null }),
            rows: 2,
          }),
          followup.error === null || followup.error === undefined
            ? null
            : h('div', { className: 'dsh-cb-error' }, followup.error),
          h(
            'div',
            { className: 'dsh-cb-row' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-btn primary',
                disabled: followup.busy || followup.text.trim() === '',
                onClick: () => void sendFollowup(),
              },
              tr('action.send'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-btn',
                onClick: () => setFollowup(null),
              },
              tr('action.close'),
            ),
          ),
        )
      }

      function renderTask(task) {
        const active = isActive(task)
        const preview =
          typeof task.preview === 'string' && task.preview.trim() !== ''
            ? task.preview.replace(/\s+/g, ' ').slice(0, 160)
            : null
        return h(
          'div',
          { key: task.id, className: 'dsh-cb-task' },
          h('span', { className: `dsh-cb-dot ${statusClass(task.status)}` }),
          h(
            'div',
            { className: 'dsh-cb-main' },
            h(
              'div',
              { className: 'dsh-cb-line' },
              h('span', { className: 'dsh-cb-id' }, task.id),
              h('span', { className: 'dsh-cb-role', title: task.role }, task.role),
              h(
                'span',
                { className: `dsh-cb-pill ${statusClass(task.status)}` },
                tr(`status.${task.status}`),
              ),
              h('span', { className: 'dsh-cb-elapsed' }, formatDuration(task.elapsedMs)),
            ),
            h(
              'div',
              { className: 'dsh-cb-sub', title: task.route },
              `${task.route}${
                task.followups > 0 ? ` · ${tr('label.followups')} ${task.followups}` : ''
              }`,
            ),
            preview === null ? null : h('div', { className: 'dsh-cb-preview' }, preview),
            task.error ? h('div', { className: 'dsh-cb-error' }, task.error) : null,
            renderFollowup(task),
          ),
          h(
            'div',
            { className: 'dsh-cb-actions' },
            active
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn danger',
                    disabled: busyCancel === task.id,
                    onClick: () => void cancelTask(task),
                  },
                  confirmCancel === task.id
                    ? tr('action.confirmCancel')
                    : tr('action.cancel'),
                )
              : null,
            task.childId
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn',
                    onClick: () =>
                      setFollowup(
                        followup !== null && followup.id === task.id
                          ? null
                          : { id: task.id, text: '', busy: false, error: null },
                      ),
                  },
                  tr('action.followup'),
                )
              : null,
            active
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn',
                    onClick: () => void openReport(task),
                  },
                  tr('action.report'),
                ),
          ),
        )
      }

      const modal =
        detail === null
          ? null
          : h(
              'div',
              {
                className: 'dsh-cb-backdrop',
                role: 'presentation',
                onMouseDown: (event) => {
                  if (event.target === event.currentTarget) setDetail(null)
                },
              },
              h(
                'div',
                {
                  className: 'dsh-cb-modal',
                  role: 'dialog',
                  'aria-modal': 'true',
                  'aria-label': `${detail.task.id} ${tr('action.report')}`,
                },
                h(
                  'div',
                  { className: 'dsh-cb-modal-head' },
                  h('span', { className: 'dsh-cb-id' }, detail.task.id),
                  h('span', { className: 'dsh-cb-role' }, detail.task.role),
                  h(
                    'span',
                    { className: `dsh-cb-pill ${statusClass(detail.task.status)}` },
                    tr(`status.${detail.task.status}`),
                  ),
                  h('span', { className: 'dsh-cb-spacer' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-cb-icon',
                      'aria-label': tr('action.close'),
                      onClick: () => setDetail(null),
                    },
                    '×',
                  ),
                ),
                h(
                  'div',
                  { className: 'dsh-cb-modal-body dsh-cb-scrollbar' },
                  h('div', { className: 'dsh-cb-sub' }, detail.task.route),
                  detail.loading
                    ? h('div', { className: 'dsh-cb-empty' }, tr('detail.loading'))
                    : detail.error
                      ? h('div', { className: 'dsh-cb-error' }, detail.error)
                      : h(
                          'pre',
                          { className: 'dsh-cb-pre' },
                          detail.result && typeof detail.result.result === 'string'
                            ? detail.result.result
                            : tr('detail.empty'),
                        ),
                ),
                h(
                  'div',
                  { className: 'dsh-cb-modal-foot' },
                  detail.task.childId
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-cb-btn primary',
                          onClick: () => {
                            setDetail(null)
                            setFollowup({
                              id: detail.task.id,
                              text: '',
                              busy: false,
                              error: null,
                            })
                          },
                        },
                        tr('action.followup'),
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-cb-btn',
                      onClick: () => setDetail(null),
                    },
                    tr('action.close'),
                  ),
                ),
              ),
            )

      return h(
        React.Fragment,
        null,
        h('style', { key: 'conductor-css' }, CSS),
        h(
          'section',
          { className: 'dsh-cb', 'data-testid': 'conductor-board' },
          h(
            'div',
            { className: 'dsh-cb-head' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-toggle',
                'aria-expanded': open,
                onClick: toggle,
              },
              h('span', { className: 'dsh-cb-mark' }, h(BoardMark)),
              h('span', { className: 'dsh-cb-title' }, tr('title')),
              h('span', { className: 'dsh-cb-stats' }, stats),
              h('span', { className: 'dsh-cb-chevron', 'aria-hidden': true }, open ? '▾' : '▸'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-icon',
                title: tr('refresh'),
                'aria-label': tr('refresh'),
                onClick: () => void reload(),
              },
              '↻',
            ),
            typeof props.openPage === 'function'
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-icon',
                    title: tr('page.open'),
                    'aria-label': tr('page.open'),
                    onClick: () => props.openPage(),
                  },
                  '▦',
                )
              : null,
          ),
          open
            ? h(
                'div',
                { className: 'dsh-cb-body dsh-cb-scrollbar' },
                h(
                  'div',
                  { className: 'dsh-cb-filters' },
                  ['all', 'active', 'done', 'failed'].map((key) =>
                    h(
                      'button',
                      {
                        key,
                        type: 'button',
                        className: 'dsh-cb-filter',
                        'aria-pressed': filter === key,
                        onClick: () => setFilter(key),
                      },
                      `${tr(`filter.${key}`)} ${counts[key]}`,
                    ),
                  ),
                ),
                notice === null ? null : h('div', { className: 'dsh-cb-notice' }, notice),
                error === null
                  ? null
                  : h('div', { className: 'dsh-cb-error' }, `${tr('error.load')}: ${error}`),
                filtered.length === 0
                  ? h('div', { className: 'dsh-cb-empty' }, tr('empty.filter'))
                  : filtered.map(renderTask),
              )
            : null,
        ),
        modal,
      )
    }

    function RolesPanel(props) {
      const tr = typeof props.t === 'function' ? props.t : (key) => key
      const [routes, setRoutes] = useState([])
      const [draft, setDraft] = useState(null)
      const [defaultSelection, setDefaultSelection] = useState(null)
      const [loading, setLoading] = useState(true)
      const [saving, setSaving] = useState(false)
      const [error, setError] = useState(null)
      const [notice, setNotice] = useState(null)
      const noticeTimer = useRef(undefined)

      useEffect(() => {
        let alive = true
        async function load() {
          setLoading(true)
          setError(null)
          try {
            const [rolesResponse, routesResponse] = await Promise.all([
              fetch('/conductor/roles', { cache: 'no-store', headers: { accept: 'application/json' } }),
              fetch('/conductor/routes', { cache: 'no-store', headers: { accept: 'application/json' } }),
            ])
            if (!rolesResponse.ok) throw new Error(`HTTP ${rolesResponse.status}`)
            if (!routesResponse.ok) throw new Error(`HTTP ${routesResponse.status}`)
            const roles = await rolesResponse.json()
            const routeValue = await routesResponse.json()
            if (!alive) return
            setRoutes(Array.isArray(routeValue.providers) ? routeValue.providers : [])
            setDefaultSelection(roles.defaultSelection ?? null)
            setDraft({
              lead: roles.lead ?? null,
              executors: roles.executors ?? {},
              allowAdHocRoutes: roles.allowAdHocRoutes === true,
            })
          } catch (cause) {
            if (alive) setError(errorText(cause))
          } finally {
            if (alive) setLoading(false)
          }
        }
        void load()
        return () => {
          alive = false
          if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current)
        }
      }, [])

      function notify(text) {
        setNotice(text)
        if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), 3500)
      }

      function modelsOf(provider) {
        const route = routes.find((entry) => entry.id === provider)
        return route !== undefined && Array.isArray(route.models) ? route.models : []
      }

      function updateExecutor(id, field, value) {
        setDraft((current) => {
          if (current === null) return current
          const executors = { ...current.executors }
          const entry = { ...executors[id], [field]: value }
          if (field === 'provider') {
            const models = modelsOf(value)
            if (!models.some((model) => model.id === entry.model)) {
              entry.model = models[0] === undefined ? '' : models[0].id
            }
          }
          executors[id] = entry
          return { ...current, executors }
        })
      }

      function removeExecutor(id) {
        setDraft((current) => {
          if (current === null) return current
          const executors = { ...current.executors }
          delete executors[id]
          return { ...current, executors }
        })
      }

      function addExecutor() {
        setDraft((current) => {
          if (current === null) return current
          const executors = { ...current.executors }
          let index = 1
          while (executors[`role-${index}`] !== undefined) index += 1
          const first = routes.find(
            (route) => Array.isArray(route.models) && route.models.length > 0,
          )
          executors[`role-${index}`] = {
            name: '',
            provider: first === undefined ? '' : first.id,
            model: first === undefined ? '' : first.models[0].id,
            description: '',
          }
          return { ...current, executors }
        })
        notify(tr('roles.added'))
      }

      function setLeadProvider(provider) {
        setDraft((current) => {
          if (current === null) return current
          if (provider === '') return { ...current, lead: null }
          const models = modelsOf(provider)
          return {
            ...current,
            lead: { provider, model: models[0] === undefined ? '' : models[0].id },
          }
        })
      }

      function setLeadModel(model) {
        setDraft((current) => {
          if (current === null || current.lead === null) return current
          return { ...current, lead: { ...current.lead, model } }
        })
      }

      async function save() {
        if (draft === null) return
        for (const entry of Object.values(draft.executors)) {
          if (
            entry === null ||
            typeof entry.provider !== 'string' ||
            entry.provider === '' ||
            typeof entry.model !== 'string' ||
            entry.model === ''
          ) {
            setError(tr('roles.incomplete'))
            return
          }
        }
        if (
          draft.lead !== null &&
          (typeof draft.lead.provider !== 'string' ||
            draft.lead.provider === '' ||
            typeof draft.lead.model !== 'string' ||
            draft.lead.model === '')
        ) {
          setError(tr('roles.needLead'))
          return
        }
        setSaving(true)
        setError(null)
        try {
          const response = await fetch('/conductor/roles', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              lead: draft.lead,
              executors: draft.executors,
              allowAdHocRoutes: draft.allowAdHocRoutes,
            }),
          })
          const value = await response.json().catch(() => ({}))
          if (!response.ok || value.ok === false) {
            throw new Error(value.error === undefined ? `HTTP ${response.status}` : value.error)
          }
          setDraft({
            lead: value.lead ?? null,
            executors: value.executors ?? {},
            allowAdHocRoutes: value.allowAdHocRoutes === true,
          })
          notify(tr('roles.saved'))
        } catch (cause) {
          setError(errorText(cause))
        } finally {
          setSaving(false)
        }
      }

      async function applyLead(startNew) {
        if (draft === null || draft.lead === null) {
          setError(tr('roles.needLead'))
          return
        }
        if (draft.lead.provider === '' || draft.lead.model === '') {
          setError(tr('roles.needLead'))
          return
        }
        setSaving(true)
        setError(null)
        try {
          const same =
            defaultSelection !== null &&
            defaultSelection.provider === draft.lead.provider &&
            defaultSelection.model === draft.lead.model
          const payload = {
            provider: draft.lead.provider,
            model: draft.lead.model,
            ...(same && typeof defaultSelection.reasoningEffort === 'string'
              ? { reasoningEffort: defaultSelection.reasoningEffort }
              : {}),
          }
          const response = await fetch('/conductor/lead/apply', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const value = await response.json().catch(() => ({}))
          if (!response.ok || value.ok === false) {
            throw new Error(value.error === undefined ? `HTTP ${response.status}` : value.error)
          }
          setDefaultSelection(value.lead ?? null)
          notify(tr('roles.applied'))
          if (startNew && typeof props.onNewSession === 'function') props.onNewSession()
        } catch (cause) {
          setError(errorText(cause))
        } finally {
          setSaving(false)
        }
      }

      function field(label, control) {
        return h(
          'label',
          { className: 'dsh-cb-field' },
          h('span', null, label),
          control,
        )
      }

      function providerSelect(value, onChange, allowEmpty) {
        return h(
          'select',
          { value, onChange: (event) => onChange(event.target.value) },
          allowEmpty ? h('option', { value: '' }, tr('roles.unset')) : null,
          routes.map((route) =>
            h(
              'option',
              { key: route.id, value: route.id },
              route.name === route.id ? route.id : `${route.name} (${route.id})`,
            ),
          ),
        )
      }

      function modelSelect(models, value, onChange) {
        const known = models.some((model) => model.id === value)
        return h(
          'select',
          { value, onChange: (event) => onChange(event.target.value) },
          value === '' ? h('option', { value: '' }, tr('roles.unset')) : null,
          models.map((model) =>
            h(
              'option',
              { key: model.id, value: model.id },
              model.name === undefined || model.name === model.id
                ? model.id
                : `${model.name} (${model.id})`,
            ),
          ),
          !known && value !== '' ? h('option', { value }, value) : null,
        )
      }

      if (loading && draft === null) {
        return h('div', { className: 'dsh-cb-empty' }, tr('roles.loading'))
      }
      if (draft === null) {
        return h(
          'div',
          { className: 'dsh-cb-error' },
          `${tr('roles.error')}: ${error === null ? '' : error}`,
        )
      }

      const lead = draft.lead ?? { provider: '', model: '' }
      const leadModels = modelsOf(lead.provider)
      const defaultText =
        defaultSelection === null
          ? tr('roles.unset')
          : `${defaultSelection.provider}/${defaultSelection.model}`
      const executorEntries = Object.entries(draft.executors)

      return h(
        'div',
        { className: 'dsh-cb-roles' },
        error === null
          ? null
          : h('div', { className: 'dsh-cb-error' }, `${tr('roles.error')}: ${error}`),
        h(
          'div',
          { className: 'dsh-cb-role-card' },
          h('div', { className: 'dsh-cb-role-title' }, tr('roles.lead')),
          h('div', { className: 'dsh-cb-role-hint' }, tr('roles.leadHint')),
          h(
            'div',
            { className: 'dsh-cb-role-grid' },
            field(
              tr('roles.provider'),
              providerSelect(lead.provider, setLeadProvider, true),
            ),
            field(tr('roles.model'), modelSelect(leadModels, lead.model, setLeadModel)),
          ),
          h(
            'div',
            { className: 'dsh-cb-role-hint' },
            `${tr('roles.default')}: ${defaultText}`,
          ),
          h(
            'div',
            { className: 'dsh-cb-role-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-btn primary',
                disabled: saving,
                onClick: () => void applyLead(false),
              },
              tr('roles.apply'),
            ),
            typeof props.onNewSession === 'function'
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn',
                    disabled: saving,
                    onClick: () => void applyLead(true),
                  },
                  tr('roles.applyNew'),
                )
              : null,
          ),
        ),
        h(
          'div',
          { className: 'dsh-cb-role-card' },
          h('div', { className: 'dsh-cb-role-title' }, tr('roles.executors')),
          h('div', { className: 'dsh-cb-role-hint' }, tr('roles.executorsHint')),
          executorEntries.length === 0
            ? h('div', { className: 'dsh-cb-empty' }, tr('roles.empty'))
            : h(
                'div',
                { className: 'dsh-cb-role-list' },
                executorEntries.map(([id, entry]) =>
                  h(
                    'div',
                    {
                      key: id,
                      className: 'dsh-cb-role-card',
                      style: { background: 'var(--dsw-alias-bg-base)' },
                    },
                    h(
                      'div',
                      { className: 'dsh-cb-role-grid' },
                      field(
                        tr('roles.id'),
                        h('input', { value: id, readOnly: true }),
                      ),
                      field(
                        tr('roles.name'),
                        h('input', {
                          value: entry.name ?? '',
                          placeholder: id,
                          onChange: (event) =>
                            updateExecutor(id, 'name', event.target.value),
                        }),
                      ),
                      field(
                        tr('roles.provider'),
                        providerSelect(
                          entry.provider,
                          (value) => updateExecutor(id, 'provider', value),
                          false,
                        ),
                      ),
                      field(
                        tr('roles.model'),
                        modelSelect(modelsOf(entry.provider), entry.model, (value) =>
                          updateExecutor(id, 'model', value),
                        ),
                      ),
                    ),
                    field(
                      tr('roles.description'),
                      h('input', {
                        value: entry.description ?? '',
                        onChange: (event) =>
                          updateExecutor(id, 'description', event.target.value),
                      }),
                    ),
                    h(
                      'div',
                      { className: 'dsh-cb-role-actions' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-cb-btn danger',
                          onClick: () => removeExecutor(id),
                        },
                        tr('roles.remove'),
                      ),
                    ),
                  ),
                ),
              ),
          h(
            'div',
            { className: 'dsh-cb-role-actions' },
            h(
              'button',
              { type: 'button', className: 'dsh-cb-btn', onClick: addExecutor },
              tr('roles.add'),
            ),
            notice === null ? null : h('span', { className: 'dsh-cb-notice' }, notice),
          ),
        ),
        h(
          'div',
          { className: 'dsh-cb-role-card' },
          h(
            'label',
            { className: 'dsh-cb-check' },
            h('input', {
              type: 'checkbox',
              checked: draft.allowAdHocRoutes,
              onChange: (event) =>
                setDraft({ ...draft, allowAdHocRoutes: event.target.checked }),
            }),
            h('span', null, tr('roles.policy')),
          ),
          h(
            'div',
            { className: 'dsh-cb-role-footer' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-btn primary',
                disabled: saving,
                onClick: () => void save(),
              },
              tr('roles.save'),
            ),
          ),
        ),
      )
    }

    function ConductorTab(props) {
      return h(ConductorPage, {
        ...props,
        compact: true,
        focusSession: props.sessionId,
      })
    }

    function ConductorPage(props) {
      const tr = typeof props.t === 'function' ? props.t : (key) => key
      const compact = props.compact === true
      const { data, error, reload } = useAllBoards()
      const [sessionFilter, setSessionFilter] = useState(props.focusSession ?? 'all')
      const [view, setView] = useState('tasks')
      const [detail, setDetail] = useState(null)
      const [followup, setFollowup] = useState(null)
      const [confirmCancel, setConfirmCancel] = useState(null)
      const [busyCancel, setBusyCancel] = useState(null)
      const [notice, setNotice] = useState(null)
      const noticeTimer = useRef(undefined)
      const confirmTimer = useRef(undefined)

      useEffect(
        () => () => {
          if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current)
          if (confirmTimer.current !== undefined) clearTimeout(confirmTimer.current)
        },
        [],
      )

      useEffect(() => {
        if (detail === null) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') setDetail(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [detail])

      function notify(text) {
        setNotice(text)
        if (noticeTimer.current !== undefined) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), 3500)
      }

      async function cancelTask(task) {
        const key = taskKeyOf(task)
        if (confirmCancel !== key) {
          setConfirmCancel(key)
          if (confirmTimer.current !== undefined) clearTimeout(confirmTimer.current)
          confirmTimer.current = setTimeout(() => setConfirmCancel(null), 4000)
          return
        }
        setConfirmCancel(null)
        setBusyCancel(key)
        try {
          await postAction({ session: task.session, task: task.id, action: 'cancel' })
          notify(`${tr('notice.cancelled')} · ${task.id}`)
          await reload()
        } catch (cause) {
          notify(`${tr('notice.failed')}: ${errorText(cause)}`)
        } finally {
          setBusyCancel(null)
        }
      }

      async function sendFollowup() {
        if (followup === null || followup.text.trim() === '') return
        const current = followup
        setFollowup({ ...current, busy: true, error: null })
        try {
          await postAction({
            session: current.session,
            task: current.id,
            action: 'followup',
            message: current.text.trim(),
          })
          setFollowup(null)
          notify(`${tr('notice.followup')} · ${current.id}`)
          await reload()
        } catch (cause) {
          setFollowup({ ...current, busy: false, error: errorText(cause) })
        }
      }

      async function openReport(task) {
        const key = taskKeyOf(task)
        setDetail({ task, key, loading: true, result: null, error: null })
        try {
          const response = await fetch(
            `/conductor/result?session=${encodeURIComponent(task.session)}&task=${encodeURIComponent(task.id)}`,
            { cache: 'no-store', headers: { accept: 'application/json' } },
          )
          const value = await response.json()
          if (!response.ok || value.ok === false) {
            throw new Error(value.error === undefined ? `HTTP ${response.status}` : value.error)
          }
          setDetail({ task, key, loading: false, result: value.task, error: null })
        } catch (cause) {
          setDetail({ task, key, loading: false, result: null, error: errorText(cause) })
        }
      }

      function followupEditor(task) {
        return h(
          'div',
          { className: 'dsh-cb-followup' },
          h('textarea', {
            className: 'dsh-cb-input',
            value: followup.text,
            placeholder: tr('followup.placeholder'),
            onChange: (event) =>
              setFollowup({ ...followup, text: event.target.value, error: null }),
            rows: 3,
          }),
          followup.error === null || followup.error === undefined
            ? null
            : h('div', { className: 'dsh-cb-error' }, followup.error),
          h(
            'div',
            { className: 'dsh-cb-row' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-btn primary',
                disabled: followup.busy || followup.text.trim() === '',
                onClick: () => void sendFollowup(),
              },
              tr('action.send'),
            ),
            h(
              'button',
              { type: 'button', className: 'dsh-cb-btn', onClick: () => setFollowup(null) },
              tr('action.close'),
            ),
          ),
        )
      }

      function renderCard(task) {
        const key = taskKeyOf(task)
        const active = isActive(task)
        const preview =
          typeof task.preview === 'string' && task.preview.trim() !== ''
            ? task.preview.replace(/\s+/g, ' ').slice(0, 200)
            : null
        return h(
          'div',
          { key, className: 'dsh-cb-task' },
          h(
            'div',
            { className: 'dsh-cb-main' },
            h(
              'div',
              { className: 'dsh-cb-line' },
              h('span', { className: 'dsh-cb-id' }, task.id),
              h(
                'span',
                { className: `dsh-cb-pill ${statusClass(task.status)}` },
                tr(`status.${task.status}`),
              ),
              h('span', { className: 'dsh-cb-elapsed' }, formatDuration(task.elapsedMs)),
            ),
            h('div', { className: 'dsh-cb-role', title: task.role }, task.role),
            h('div', { className: 'dsh-cb-sub', title: task.route }, task.route),
            h(
              'div',
              { className: 'dsh-cb-sub', title: task.session },
              `#${task.session.slice(-6)}${
                task.followups > 0 ? ` · ${tr('label.followups')} ${task.followups}` : ''
              }`,
            ),
            preview === null ? null : h('div', { className: 'dsh-cb-preview' }, preview),
            task.error ? h('div', { className: 'dsh-cb-error' }, task.error) : null,
            followup !== null && followup.key === key ? followupEditor(task) : null,
          ),
          h(
            'div',
            { className: 'dsh-cb-actions' },
            active
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn danger',
                    disabled: busyCancel === key,
                    onClick: () => void cancelTask(task),
                  },
                  confirmCancel === key ? tr('action.confirmCancel') : tr('action.cancel'),
                )
              : null,
            task.childId
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn',
                    onClick: () =>
                      setFollowup(
                        followup !== null && followup.key === key
                          ? null
                          : {
                              key,
                              session: task.session,
                              id: task.id,
                              text: '',
                              busy: false,
                              error: null,
                            },
                      ),
                  },
                  tr('action.followup'),
                )
              : null,
            active
              ? null
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-cb-btn',
                    onClick: () => void openReport(task),
                  },
                  tr('action.report'),
                ),
          ),
        )
      }

      const sessions = data !== null && Array.isArray(data.sessions) ? data.sessions : []
      const all = sessions.flatMap((entry) =>
        Array.isArray(entry.tasks)
          ? entry.tasks.map((task) => ({ ...task, session: entry.session }))
          : [],
      )
      const sessionIds = [...new Set(all.map((task) => task.session))]
      const visible =
        sessionFilter === 'all'
          ? all
          : all.filter((task) => task.session === sessionFilter)
      const columns = [
        {
          key: 'active',
          title: tr('column.active'),
          dot: 'running',
          tasks: visible.filter(isActive),
        },
        {
          key: 'done',
          title: tr('column.done'),
          dot: 'completed',
          tasks: visible.filter((task) => task.status === 'completed'),
        },
        {
          key: 'failed',
          title: tr('column.failed'),
          dot: 'failed',
          tasks: visible.filter(
            (task) => task.status === 'failed' || task.status === 'cancelled',
          ),
        },
      ]
      for (const column of columns) {
        column.tasks.sort((a, b) => b.createdAt - a.createdAt)
      }
      const activeCount = visible.filter(isActive).length
      const doneCount = visible.filter((task) => task.status === 'completed').length
      const failedCount = visible.filter(
        (task) => task.status === 'failed' || task.status === 'cancelled',
      ).length

      const modal =
        detail === null
          ? null
          : h(
              'div',
              {
                className: 'dsh-cb-backdrop',
                role: 'presentation',
                onMouseDown: (event) => {
                  if (event.target === event.currentTarget) setDetail(null)
                },
              },
              h(
                'div',
                {
                  className: 'dsh-cb-modal',
                  role: 'dialog',
                  'aria-modal': 'true',
                  'aria-label': `${detail.task.id} ${tr('action.report')}`,
                },
                h(
                  'div',
                  { className: 'dsh-cb-modal-head' },
                  h('span', { className: 'dsh-cb-id' }, detail.task.id),
                  h('span', { className: 'dsh-cb-role' }, detail.task.role),
                  h(
                    'span',
                    { className: `dsh-cb-pill ${statusClass(detail.task.status)}` },
                    tr(`status.${detail.task.status}`),
                  ),
                  h(
                    'span',
                    { className: 'dsh-cb-sub' },
                    `#${detail.task.session.slice(-6)}`,
                  ),
                  h('span', { className: 'dsh-cb-spacer' }),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-cb-icon',
                      'aria-label': tr('action.close'),
                      onClick: () => setDetail(null),
                    },
                    '×',
                  ),
                ),
                h(
                  'div',
                  { className: 'dsh-cb-modal-body dsh-cb-scrollbar' },
                  h('div', { className: 'dsh-cb-sub' }, detail.task.route),
                  detail.loading
                    ? h('div', { className: 'dsh-cb-empty' }, tr('detail.loading'))
                    : detail.error
                      ? h('div', { className: 'dsh-cb-error' }, detail.error)
                      : h(
                          'pre',
                          { className: 'dsh-cb-pre' },
                          detail.result && typeof detail.result.result === 'string'
                            ? detail.result.result
                            : tr('detail.empty'),
                        ),
                ),
                h(
                  'div',
                  { className: 'dsh-cb-modal-foot' },
                  detail.task.childId
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-cb-btn primary',
                          onClick: () => {
                            setDetail(null)
                            setFollowup({
                              key: detail.key,
                              session: detail.task.session,
                              id: detail.task.id,
                              text: '',
                              busy: false,
                              error: null,
                            })
                          },
                        },
                        tr('action.followup'),
                      )
                    : null,
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-cb-btn',
                      onClick: () => setDetail(null),
                    },
                    tr('action.close'),
                  ),
                ),
              ),
            )

      const body =
        data === null
          ? h(
              'div',
              { className: 'dsh-cb-empty' },
              error === null ? tr('page.loading') : `${tr('error.load')}: ${error}`,
            )
          : h(
              'div',
              { className: 'dsh-cb-columns' },
              columns.map((column) =>
                h(
                  'div',
                  { key: column.key, className: 'dsh-cb-column' },
                  h(
                    'div',
                    { className: 'dsh-cb-column-head' },
                    h('span', { className: `dsh-cb-dot ${column.dot}` }),
                    h('span', null, column.title),
                    h('span', { className: 'dsh-cb-column-count' }, column.tasks.length),
                  ),
                  column.tasks.length === 0
                    ? h('div', { className: 'dsh-cb-empty' }, tr('page.empty'))
                    : column.tasks.map(renderCard),
                ),
              ),
            )

      return h(
        'div',
        { className: `dsh-cb-page${compact ? ' dsh-cb-compact' : ''}`, 'data-testid': 'conductor-page' },
        h('style', { key: 'conductor-page-css' }, CSS),
        h(
          'div',
          { className: 'dsh-cb-page-inner' },
          h(
            'div',
            { className: 'dsh-cb-page-head' },
            h(
              'div',
              { style: { flex: '1 1 320px' } },
              h('div', { className: 'dsh-cb-page-title' }, tr('page.title')),
              h('div', { className: 'dsh-cb-page-sub' }, tr('page.subtitle')),
            ),
            h(
              'div',
              { className: 'dsh-cb-page-tools' },
              h(
                'button',
                { type: 'button', className: 'dsh-cb-btn', onClick: () => void reload() },
                tr('refresh'),
              ),
              typeof props.onBack === 'function'
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-cb-btn',
                      onClick: () => props.onBack(),
                    },
                    tr('page.back'),
                  )
                : null,
            ),
          ),
          h(
            'div',
            { className: 'dsh-cb-tabs' },
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-tab',
                'aria-selected': view === 'tasks',
                onClick: () => setView('tasks'),
              },
              tr('tab.tasks'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-cb-tab',
                'aria-selected': view === 'roles',
                onClick: () => setView('roles'),
              },
              tr('tab.roles'),
            ),
          ),
          view === 'roles'
            ? h(RolesPanel, { t: tr, onNewSession: props.onNewSession })
            : h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'dsh-cb-toolbar' },
                  h('span', { className: 'dsh-cb-sub' }, tr('page.session')),
                  h(
                    'select',
                    {
                      className: 'dsh-cb-select',
                      value: sessionFilter,
                      onChange: (event) => setSessionFilter(event.target.value),
                      'aria-label': tr('page.session'),
                    },
                    h('option', { value: 'all' }, tr('page.sessionAll')),
                    sessionIds.map((id) =>
                      h('option', { key: id, value: id }, `#${id.slice(-6)}`),
                    ),
                  ),
                  h(
                    'span',
                    { className: 'dsh-cb-stats' },
                    `${activeCount} ${tr('label.running')} · ${doneCount} ${tr('label.done')} · ${failedCount} ${tr('label.failed')}`,
                  ),
                ),
                notice === null ? null : h('div', { className: 'dsh-cb-notice' }, notice),
                error === null || data === null
                  ? null
                  : h(
                      'div',
                      { className: 'dsh-cb-error' },
                      `${tr('error.load')}: ${error}`,
                    ),
                body,
              ),
        ),
        modal,
      )
    }

    return {
      name: 'conductor-ui',
      inject: ['slots', 'locale', 'layout', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }))
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: PANEL_ID,
              locale: NS,
              inject: () => ({
                onBack: () => ctx.layout.selectPanel(null),
                onNewSession: () => ctx.uiWorkspace.startSession(),
              }),
            },
            ConductorPage,
          ),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 12,
              locale: NS,
              label: () => t('panel'),
            },
            ConductorPanelIcon,
          ),
        )

        let boardTabState = 'idle'
        let rightService
        const ensureBoardTab = () => {
          if (boardTabState === 'ready') return true
          if (boardTabState === 'failed') return false
          let tabs
          let right
          try {
            tabs = ctx.get('sidebarRightTabs') ?? ctx.sidebarRightTabs
            right = ctx.get('sidebarRight') ?? ctx.sidebarRight
          } catch {
            return false
          }
          if (
            tabs === undefined ||
            right === undefined ||
            typeof tabs.register !== 'function' ||
            typeof right.openTab !== 'function'
          ) {
            return false
          }
          try {
            ctx.effect(() =>
              tabs.register({
                id: BOARD_TAB_ID,
                kind: BOARD_TAB_KIND,
                priority: 'extension',
                title: () => t('page.title'),
              }),
            )
            ctx.effect(() =>
              ctx.slots.inject('sidebar.right.pane.tab', () =>
                ctx.slots.register(
                  {
                    name: 'sidebar.right.pane.tab',
                    key: BOARD_TAB_ID,
                    locale: NS,
                    inject: () => ({
                      onNewSession: () => ctx.uiWorkspace.startSession(),
                    }),
                  },
                  ConductorTab,
                ),
              ),
            )
            rightService = right
            boardTabState = 'ready'
            return true
          } catch {
            boardTabState = 'failed'
            return false
          }
        }

        const openBoard = () => {
          if (ensureBoardTab() && rightService !== undefined) {
            try {
              rightService.openTab(BOARD_TAB_KIND, { params: {} })
              return
            } catch {
              boardTabState = 'failed'
            }
          }
          ctx.layout.selectPanel(PANEL_ID)
        }

        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: 'conductor-launcher',
              order: 5,
              locale: NS,
              inject: () => ({ openBoard }),
            },
            ConductorLauncher,
          ),
        )

        ensureBoardTab()
      },
    }
  },
})
