/**
 * dsh-chat-nav 浏览器半边：右侧聊天快捷导航（ChatGPT 式悬停滑出）。
 *
 * 鼠标移入消息区右缘（滚动条左侧）的大号手柄，导航面板自动滑出；
 * 移开鼠标自动收起。面板高度随消息条数自适应（240–520px 封顶）并
 * 上下居中。头部无任何按钮。
 *
 * 手工编写的模块表 bundle（与 tsdown clientBundle 产物的格式一致）：
 * 脚本执行只注册 factory（window.__ModuleLoader__.load），模块体副作用
 * ——包括下面的 <style> 注入——在 factory 物化时运行。React 走模块表
 * 种子 require('react')；样式标签带 data-plugin 前缀，加载器在物化时
 * 认领并在卸载时清理。跨插件协作全部走 cordis 服务（ctx.slots /
 * ctx.sessions），无任何跨插件值导入。
 */
window.__ModuleLoader__.load({
  id: 'dsh-chat-nav',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    // 样式（仅主题令牌）。幂等守卫与 tsdown 的 CSS 虚拟模块同款：
    // data-plugin-css 防重复，加载器按 data-plugin 认领/清理。
    if (typeof document !== 'undefined'
      && document.querySelector('style[data-plugin-css="dsh-chat-nav/styles"]') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-chat-nav'
      tag.dataset.pluginCss = 'dsh-chat-nav/styles'
      tag.textContent = [
        '.dsh-nav-zone{position:fixed;width:48px;pointer-events:auto;display:flex;align-items:center;',
        'justify-content:center;}',
        '.dsh-nav-handle{width:48px;height:96px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1);',
        'background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);opacity:.95;',
        'display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center;}',
        '.dsh-nav-zone:hover .dsh-nav-handle{opacity:1;color:var(--dsw-alias-label-primary);',
        'border-color:var(--dsw-alias-brand-primary);}',
        '.dsh-nav-bar{width:20px;height:2.5px;border-radius:1.5px;background:currentColor;}',
        '.dsh-nav-badge{font-size:10px;line-height:1;margin-top:4px;color:var(--dsw-alias-label-secondary);}',
        '.dsh-nav-panel{position:fixed;width:300px;max-width:38vw;display:flex;flex-direction:column;',
        'background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;',
        'box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);',
        'pointer-events:auto;overflow:hidden;font-size:13px;line-height:1.5;animation:dshNavIn .2s ease;}',
        '@keyframes dshNavIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}',
        '.dsh-nav-head{display:flex;align-items:center;gap:6px;padding:14px 16px 8px;}',
        '.dsh-nav-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}',
        '.dsh-nav-count{font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.7;}',
        '.dsh-nav-list{overflow-y:auto;padding:0 8px 16px;display:flex;flex-direction:column;gap:1px;flex:1;',
        'min-height:0;}',
        '.dsh-nav-item{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;border:none;',
        'background:none;cursor:pointer;border-radius:8px;padding:8px 10px;color:var(--dsw-alias-label-secondary);}',
        '.dsh-nav-item:hover{background:var(--dsw-alias-bg-layer-2);}',
        '.dsh-nav-item.dsh-nav-active{background:var(--dsw-alias-bg-layer-2);',
        'color:var(--dsw-alias-label-primary);}',
        '.dsh-nav-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
        '.dsh-nav-dot{flex:none;width:6px;height:6px;border-radius:50%;margin-top:7px;',
        'background:var(--dsw-alias-state-warn-primary);}',
      ].join('')
      document.head.appendChild(tag)
    }

    const plugin = {
      name: 'dsh-chat-nav',
      inject: ['slots', 'sessions'],
      apply(ctx) {
        const slots = ctx.slots
        const sessions = ctx.sessions

        // ---- 会话快照可观察源（open 状态由组件本地悬停驱动） ----
        const listeners = new Set()
        let infoOff = null
        let sessionOff = null
        let cached = { session: undefined }

        const currentSessionSource = () => {
          const info = sessions.currentProvideInfo.getSnapshot()
          const hooks = info === null || info === undefined ? undefined : info.hooks
          return hooks === undefined || hooks === null ? undefined : hooks['session']
        }

        const refresh = () => {
          const source = currentSessionSource()
          const session = source === undefined ? undefined : source.getSnapshot()
          cached = { session }
          for (const fn of listeners) fn()
        }

        const bindSession = () => {
          if (sessionOff !== null) {
            sessionOff()
            sessionOff = null
          }
          const source = currentSessionSource()
          if (source !== undefined) sessionOff = source.subscribe(refresh)
        }

        const navSource = {
          getSnapshot: () => cached,
          subscribe(fn) {
            listeners.add(fn)
            if (listeners.size === 1) {
              bindSession()
              infoOff = sessions.currentProvideInfo.subscribe(() => {
                bindSession()
                refresh()
              })
              refresh()
            }
            return () => {
              listeners.delete(fn)
              if (listeners.size === 0) {
                if (sessionOff !== null) {
                  sessionOff()
                  sessionOff = null
                }
                if (infoOff !== null) {
                  infoOff()
                  infoOff = null
                }
              }
            }
          },
        }

        // ---- 轮次导航模型：一条 = 一个用户提问（user/steering）；命令轮次兜底 ----
        const COMMANDISH = new Set(['command', 'command-input', 'manual-compaction', 'compaction'])
        const KIND_LABELS = {
          command: '命令',
          'command-input': '命令输入',
          compaction: '历史压缩',
          'manual-compaction': '压缩',
        }

        const turnOf = (node) => {
          const loc = node.location
          if (loc !== null && loc !== undefined && (loc.kind === 'turn' || loc.kind === 'step')) return loc.turn.turn
          return undefined
        }

        const summarize = (text, max) => {
          const first = String(text).split(/\r?\n/u)[0].trim()
          if (first === '') return null
          const chars = Array.from(first)
          return chars.length <= max ? first : chars.slice(0, max).join('') + '…'
        }

        const userTextOf = (node) => {
          const data = node.data
          const content = data !== null && data !== undefined && Array.isArray(data.content) ? data.content : []
          for (const block of content) {
            if (block !== null && block !== undefined && block.type === 'text'
              && typeof block.text === 'string' && block.text.trim() !== '') {
              return block.text
            }
          }
          return null
        }

        const EMPTY_ITEMS = []
        const EMPTY_ROWS = new Map()

        const buildTurnItems = (session) => {
          const chat = session.chat
          const items = []
          const rowToItem = new Map()
          const seenTurns = new Set()
          for (const key of chat.order) {
            const node = chat.nodes.get(key)
            if (node === undefined || node.visibility === 'hidden') continue
            const turn = turnOf(node)
            const kind = node.kind
            if (kind === 'user' || kind === 'steering') {
              const text = userTextOf(node)
              items.push({
                key: node.key,
                label: text === null ? (kind === 'user' ? '提问' : '插话') : summarize(text, 60),
                full: text === null ? '' : String(text).trim(),
                running: turn !== undefined && chat.timeline.turns.get(turn) !== undefined
                  && chat.timeline.turns.get(turn).status === 'open',
                turn,
              })
              if (turn !== undefined) seenTurns.add(turn)
            } else if (turn !== undefined && COMMANDISH.has(kind) && !seenTurns.has(turn)) {
              items.push({
                key: node.key,
                label: KIND_LABELS[kind],
                full: KIND_LABELS[kind],
                running: chat.timeline.turns.get(turn) !== undefined
                  && chat.timeline.turns.get(turn).status === 'open',
                turn,
              })
              seenTurns.add(turn)
            }
            const last = items[items.length - 1]
            if (last !== undefined) rowToItem.set(key, last.key)
          }
          return { items, rowToItem }
        }

        // ---- DOM 跳转（产品自带的锚点面：[data-conversation-scroll] + [data-chat-anchor-key]） ----
        const escapeAttr = (value) => (
          typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"')
        )

        const scrollToKey = (key) => {
          const scrollport = document.querySelector('[data-conversation-scroll]')
          if (scrollport === null) return
          const row = scrollport.querySelector('[data-chat-anchor-key="' + escapeAttr(key) + '"]')
          if (row === null) return
          const top = row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top - 8
          scrollport.scrollTop += top
        }

        // ---- 面板组件：悬停滑出（ChatGPT 式），高度随内容自适应（240–520 封顶） ----
        function ChatNavPanel(props) {
          const session = props.useChatNav(s => s.session)
          const panelRef = React.useRef(null)
          const listRef = React.useRef(null)
          const [open, setOpen] = React.useState(false)
          const [activeKey, setActiveKey] = React.useState(null)
          const [geom, setGeom] = React.useState(null)
          const [panelH, setPanelH] = React.useState(320)
          const order = session === undefined || session === null ? null : session.chat.order
          const built = React.useMemo(() => (session !== undefined
            ? buildTurnItems(session)
            : { items: EMPTY_ITEMS, rowToItem: EMPTY_ROWS }), [session])
          const items = built.items
          const barCount = Math.min(items.length, 10)

          // 几何：消息区边界（右缘、顶基线、区域高度、details 开合）
          React.useEffect(() => {
            const measure = () => {
              const scrollport = document.querySelector('[data-conversation-scroll]')
              if (scrollport === null) {
                setGeom(null)
                return
              }
              const rect = scrollport.getBoundingClientRect()
              const composer = scrollport.querySelector('[data-composer-seat]')
              const composerTop = composer === null ? rect.bottom : composer.getBoundingClientRect().top
              setGeom({
                right: Math.max(8, window.innerWidth - rect.right + 8),
                topBase: Math.max(8, rect.top + 8),
                areaH: Math.max(120, composerTop - rect.top - 16),
                detailsOpen: document.querySelector('[data-details-collapsed]') === null,
              })
            }
            measure()
            let observer = null
            if (typeof ResizeObserver !== 'undefined') {
              observer = new ResizeObserver(measure)
              const scrollport = document.querySelector('[data-conversation-scroll]')
              if (scrollport !== null) observer.observe(scrollport)
            }
            return () => {
              if (observer !== null) observer.disconnect()
            }
          }, [open, items])

          // 面板高度随消息条数增长：最低 240，封顶 520（且不超过消息区）
          React.useEffect(() => {
            if (!open || panelRef.current === null) return
            const list = panelRef.current.querySelector('.dsh-nav-list')
            const content = list === null ? 0 : list.scrollHeight
            const head = panelRef.current.querySelector('.dsh-nav-head')
            const headH = head === null ? 0 : head.offsetHeight
            const want = Math.max(240, Math.min(520, headH + content + 24))
            const cap = geom === null ? 520 : Math.min(520, geom.areaH)
            const next = Math.min(want, cap)
            if (next !== panelH) setPanelH(next)
          }, [open, items, geom, panelH])

          // 当前轮次高亮：观察滚动容器内的消息行，映射到所属导航项
          React.useEffect(() => {
            const scrollport = document.querySelector('[data-conversation-scroll]')
            if (scrollport === null) return
            const rows = scrollport.querySelectorAll('[data-chat-anchor-key]')
            if (rows.length === 0) {
              setActiveKey(null)
              return
            }
            const visible = new Set()
            const observer = new IntersectionObserver((entries) => {
              let changed = false
              for (const entry of entries) {
                const key = entry.target.getAttribute('data-chat-anchor-key')
                if (key === null) continue
                const now = entry.isIntersecting
                const before = visible.has(key)
                if (now !== before) {
                  if (now) visible.add(key)
                  else visible.delete(key)
                  changed = true
                }
              }
              if (!changed) return
              let best = null
              let bestTop = Infinity
              for (const key of visible) {
                const el = scrollport.querySelector('[data-chat-anchor-key="' + escapeAttr(key) + '"]')
                if (el === null) continue
                const top = el.getBoundingClientRect().top
                if (top < bestTop) {
                  bestTop = top
                  best = key
                }
              }
              setActiveKey(best === null ? null : (built.rowToItem.get(best) ?? null))
            })
            for (const row of rows) observer.observe(row)
            return () => observer.disconnect()
          }, [order])

          // 高亮项在导航列表中保持可见
          React.useEffect(() => {
            if (activeKey === null || listRef.current === null) return
            const el = listRef.current.querySelector('[data-nav-key="' + escapeAttr(activeKey) + '"]')
            if (el !== null && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
          }, [activeKey])

          if (items.length === 0 || geom === null) return null

          // 收起态：触发区域 = 手柄本身（48×96，垂直居中）；横杆数 = 消息条数（上限 10，超出显示总数）
          if (!open) {
            if (geom.detailsOpen) return null
            const bars = []
            for (let i = 0; i < barCount; i++) {
              bars.push(React.createElement('span', { key: i, className: 'dsh-nav-bar' }))
            }
            return React.createElement('div', {
              className: 'dsh-nav-zone',
              style: {
                right: geom.right,
                top: geom.topBase + Math.max(0, (geom.areaH - 96) / 2),
                height: 96,
                width: 48,
              },
              onMouseEnter: () => setOpen(true),
            },
              React.createElement('div', { className: 'dsh-nav-handle', 'aria-hidden': 'true' },
                ...bars,
                items.length > 10
                  ? React.createElement('span', { className: 'dsh-nav-badge' }, String(items.length))
                  : null,
              ),
            )
          }

          // 展开态：GPT 风格浮窗，上下居中，移开鼠标自动收起
          return React.createElement('div', {
            ref: panelRef,
            className: 'dsh-nav-panel',
            role: 'navigation',
            'aria-label': '聊天导航',
            style: {
              right: geom.right,
              top: geom.topBase + Math.max(0, (geom.areaH - panelH) / 2),
              height: panelH,
            },
            onMouseLeave: () => setOpen(false),
          },
            React.createElement('div', { className: 'dsh-nav-head' },
              React.createElement('span', { className: 'dsh-nav-title' }, '消息'),
              React.createElement('span', { className: 'dsh-nav-count' }, String(items.length)),
            ),
            React.createElement('div', { ref: listRef, className: 'dsh-nav-list' },
              items.map(item => React.createElement('button', {
                key: item.key,
                type: 'button',
                'data-nav-key': item.key,
                className: 'dsh-nav-item' + (item.key === activeKey ? ' dsh-nav-active' : ''),
                'aria-current': item.key === activeKey ? 'true' : undefined,
                title: item.full === '' ? undefined : item.full,
                onClick: () => scrollToKey(item.key),
              },
                item.running
                  ? React.createElement('span', { className: 'dsh-nav-dot', 'aria-hidden': 'true' })
                  : null,
                React.createElement('span', { className: 'dsh-nav-text' }, item.label),
              )),
            ),
          )
        }

        // ---- 注册（仅一个座位：面板 + 悬停热区一体） ----
        slots.inject('shell.overlay', () => slots.register(
          { name: 'shell.overlay', id: 'chat-nav', order: 100, inject: () => ({ hooks: { chatNav: navSource } }) },
          ChatNavPanel,
        ))
      },
    }

    module.exports = plugin
    return module.exports
  },
})
