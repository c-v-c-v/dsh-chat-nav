/**
 * dsh-chat-nav 浏览器半边：右侧聊天快捷导航（ChatGPT 式悬停滑出）。
 *
 * 鼠标移入消息区右缘的手柄，导航面板自动滑出；移开自动收起。
 * 面板高度随消息条数自适应并上下居中；会话历史按页加载，导航只列出
 * 已加载的提问，未加载完显示「已加载 N」，全部加载完显示提问总数。
 * 底部可一键加载更早消息。
 *
 * 结构（自顶向下）：
 *   1. 常量          几何与行为参数，集中可调
 *   2. 样式          模板字符串 + data-plugin 标签注入（加载器认领/清理）
 *   3. 纯函数        与 ctx 无关、可独立测试的推导逻辑
 *   4. 插件          会话数据源（可观察）、面板组件、槽位注册
 *
 * bundle 格式与 tsdown clientBundle 产物一致：脚本执行只注册 factory
 * （window.__ModuleLoader__.load），模块体副作用在物化时运行；React 走
 * 模块表种子 require('react')；跨插件协作只走 cordis 服务，无值导入。
 */
window.__ModuleLoader__.load({
  id: 'dsh-chat-nav',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')

    /* ================================================================
     * 1. 常量
     * ================================================================ */

    const HANDLE_WIDTH = 48          // 手柄（触发区）宽
    const HANDLE_HEIGHT = 96         // 手柄（触发区）高，垂直居中
    const MAX_BARS = 10              // 手柄横杆上限，超出显示总数徽标
    const PANEL_WIDTH = 300          // 面板宽
    const PANEL_MIN_HEIGHT = 240     // 面板高度下限
    const PANEL_MAX_HEIGHT = 520     // 面板高度上限（随内容增长封顶）
    const EDGE_INSET = 8             // 面板/手柄距消息区右缘（8px 滚动条外侧）
    const SCROLL_INSET = 8           // 跳转后目标行距滚动区顶部留白
    const PANEL_FOOTER_GAP = 24      // 高度计算里列表内容外的头部+留白补偿
    const AREA_MIN_HEIGHT = 120      // 消息区高度下限

    /* ================================================================
     * 2. 样式
     * ================================================================ */

    const STYLE_TEXT = `
      .dsh-nav-zone{position:fixed;pointer-events:auto;display:flex;align-items:center;justify-content:center;}
      .dsh-nav-handle{width:${HANDLE_WIDTH}px;height:${HANDLE_HEIGHT}px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1);
        background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);opacity:.95;
        display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center;}
      .dsh-nav-zone:hover .dsh-nav-handle{opacity:1;color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary);}
      .dsh-nav-bar{width:20px;height:2.5px;border-radius:1.5px;background:currentColor;}
      .dsh-nav-badge{font-size:10px;line-height:1;margin-top:4px;color:var(--dsw-alias-label-secondary);}
      .dsh-nav-panel{position:fixed;width:${PANEL_WIDTH}px;max-width:38vw;display:flex;flex-direction:column;
        background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;
        box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent);
        pointer-events:auto;overflow:hidden;font-size:13px;line-height:1.5;animation:dshNavIn .2s ease;}
      @keyframes dshNavIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:none}}
      .dsh-nav-head{display:flex;align-items:center;gap:6px;padding:14px 16px 8px;}
      .dsh-nav-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
      .dsh-nav-count{font-size:12px;color:var(--dsw-alias-label-secondary);opacity:.7;}
      .dsh-nav-list{overflow-y:auto;padding:0 8px 8px;display:flex;flex-direction:column;gap:1px;flex:1;min-height:0;}
      .dsh-nav-more{border-top:1px solid var(--dsw-alias-border-l1);padding:4px 8px 10px;}
      .dsh-nav-more-btn{width:100%;border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-secondary);
        font-size:12px;padding:6px 0;border-radius:6px;}
      .dsh-nav-more-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}
      .dsh-nav-more-btn:disabled{opacity:.6;cursor:default;}
      .dsh-nav-item{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;border:none;
        background:none;cursor:pointer;border-radius:8px;padding:8px 10px;color:var(--dsw-alias-label-secondary);}
      .dsh-nav-item:hover{background:var(--dsw-alias-bg-layer-2);}
      .dsh-nav-item.dsh-nav-active{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
      .dsh-nav-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}
      .dsh-nav-dot{flex:none;width:6px;height:6px;border-radius:50%;margin-top:7px;
        background:var(--dsw-alias-state-warn-primary);}
    `

    // 真实 bundle 无动态插件的 styles 符号：手工注入 style 标签，幂等守卫
    // 防重复；加载器物化时按 data-plugin 认领、卸载时清理。
    if (typeof document !== 'undefined'
      && document.querySelector('style[data-plugin-css="dsh-chat-nav/styles"]') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-chat-nav'
      tag.dataset.pluginCss = 'dsh-chat-nav/styles'
      tag.textContent = STYLE_TEXT
      document.head.appendChild(tag)
    }

    /* ================================================================
     * 3. 纯函数（不依赖 ctx，可独立测试）
     * ================================================================ */

    /** 节点归属的轮次号；无轮次定位（session 级/未解析）返回 undefined。 */
    function turnOf(node) {
      const loc = node.location
      if (loc !== null && loc !== undefined && (loc.kind === 'turn' || loc.kind === 'step')) return loc.turn.turn
      return undefined
    }

    /** 取文本首行并截断，空文本返回 null。 */
    function summarize(text, max) {
      const first = String(text).split(/\r?\n/u)[0].trim()
      if (first === '') return null
      const chars = Array.from(first)
      return chars.length <= max ? first : chars.slice(0, max).join('') + '…'
    }

    /** 用户类节点（user/steering）的第一个非空文本块。 */
    function userTextOf(node) {
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

    /**
     * 由会话快照构建导航：一条 = 一个用户提问（user/steering）。
     * 命令/压缩等流程控制节点不生成导航项（它们不是提问）；同时返回
     * "消息行 → 导航项"映射供滚动高亮。
     */
    function buildNavItems(session) {
      const chat = session.chat
      const items = []
      const rowToItem = new Map()
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
        }
        const last = items[items.length - 1]
        if (last !== undefined) rowToItem.set(key, last.key)
      }
      return { items, rowToItem }
    }

    /** 属性选择器值转义（节点 key 可能含特殊字符）。 */
    function escapeAttribute(value) {
      return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(value)
        : value.replace(/"/g, '\\"')
    }

    /**
     * 把聊天滚动到指定节点：复用产品自带的锚点面
     * （[data-conversation-scroll] 滚动容器 + [data-chat-anchor-key] 消息行）。
     */
    function scrollToKey(key) {
      const scrollport = document.querySelector('[data-conversation-scroll]')
      if (scrollport === null) return
      const row = scrollport.querySelector('[data-chat-anchor-key="' + escapeAttribute(key) + '"]')
      if (row === null) return
      const top = row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top - SCROLL_INSET
      scrollport.scrollTop += top
    }

    /**
     * 计数展示文案。窗口未加载完（hasMore === true）时显示「已加载 N」——
     * 接口外还有未加载的历史，本窗口的提问数就是已加载的真实数量，配合
     * 「加载更早消息」按钮提示未完成。
     * 窗口 = 全日志（hasMore === false）时「已加载」就是「全部」：导航列表
     * 由窗口内可见的用户提问构成，此刻窗口覆盖整个日志，列表因此就是全部
     * 提问的完整形态，恒显示单数。
     */
    function navCountLabel(itemCount, session) {
      if (session === undefined || session === null) return String(itemCount)
      if (session.hasMore === true) return `已加载 ${itemCount}`
      return String(itemCount)
    }

    /* ================================================================
     * 4. 插件
     * ================================================================ */

    const EMPTY_NAV = { items: [], rowToItem: new Map() }

    const plugin = {
      name: 'dsh-chat-nav',
      inject: ['slots', 'sessions'],
      apply(ctx) {
        const slots = ctx.slots
        const sessions = ctx.sessions

        // ---- 会话数据源：当前会话快照 ----
        // root 作用域无 useSession，经注册的 inject hooks 舱暴露为 useChatNav。
        // 订阅两类来源：currentProvideInfo（会话切换）与当前会话快照
        // （流式更新、翻页变化），会话切换时重绑。
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
          // 每次变化重建缓存对象：uSES 要求 getSnapshot 引用在不变时稳定
          cached = { session }
          for (const fn of listeners) fn()
        }

        const bindSession = () => {
          if (sessionOff !== null) {
            sessionOff()
            sessionOff = null
          }
          const source = currentSessionSource()
          if (source === undefined) return
          sessionOff = source.subscribe(refresh)
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

        /** 加载更早历史（会话分页），导航随快照更新自动刷新。 */
        const loadOlder = () => {
          const source = currentSessionSource()
          if (source !== undefined && typeof source.loadOlder === 'function') {
            void source.loadOlder()
          }
        }

        // ---- 面板组件：收起态 = 手柄；展开态 = 浮窗 ----
        function ChatNavPanel(props) {
          const { session } = props.useChatNav(s => s)
          const panelRef = React.useRef(null)
          const listRef = React.useRef(null)
          const [open, setOpen] = React.useState(false)
          const [activeKey, setActiveKey] = React.useState(null)
          const [geometry, setGeometry] = React.useState(null)
          const [panelHeight, setPanelHeight] = React.useState(320)

          const order = session === undefined || session === null ? null : session.chat.order
          const nav = React.useMemo(
            () => (session === undefined ? EMPTY_NAV : buildNavItems(session)),
            [session],
          )
          const items = nav.items
          const barCount = Math.min(items.length, MAX_BARS)
          const hasMore = session !== undefined && session !== null && session.hasMore === true
          const loadingOlder = session !== undefined && session !== null && session.loadingOlder === true

          // 几何：测量消息区（[data-conversation-scroll]）右缘/顶/高，确定
          // 手柄与面板位置；details 列展开时不显示手柄（避开其拖拽手柄，
          // 用帧根 data-details-collapsed 检测）。
          React.useEffect(() => {
            const measure = () => {
              const scrollport = document.querySelector('[data-conversation-scroll]')
              if (scrollport === null) {
                setGeometry(null)
                return
              }
              const rect = scrollport.getBoundingClientRect()
              const composer = scrollport.querySelector('[data-composer-seat]')
              const composerTop = composer === null ? rect.bottom : composer.getBoundingClientRect().top
              setGeometry({
                right: Math.max(8, window.innerWidth - rect.right + EDGE_INSET),
                topBase: Math.max(8, rect.top + EDGE_INSET),
                areaHeight: Math.max(AREA_MIN_HEIGHT, composerTop - rect.top - 16),
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

          // 面板高度随内容增长：最低 PANEL_MIN_HEIGHT，封顶 PANEL_MAX_HEIGHT
          //（且不超过消息区高度），保证「消息少时刚好包住、多时滚动」。
          React.useEffect(() => {
            if (!open || panelRef.current === null) return
            const list = panelRef.current.querySelector('.dsh-nav-list')
            const content = list === null ? 0 : list.scrollHeight
            const head = panelRef.current.querySelector('.dsh-nav-head')
            const headHeight = head === null ? 0 : head.offsetHeight
            const want = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, headHeight + content + PANEL_FOOTER_GAP))
            const cap = geometry === null ? PANEL_MAX_HEIGHT : Math.min(PANEL_MAX_HEIGHT, geometry.areaHeight)
            const next = Math.min(want, cap)
            if (next !== panelHeight) setPanelHeight(next)
          }, [open, items, geometry, panelHeight])

          // 当前轮次高亮：观察消息区内的消息行，最靠上的可见行经 rowToItem
          // 映射为激活导航项；行集合变化（order）时重建 observer。
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
              let bestKey = null
              let bestTop = Infinity
              for (const key of visible) {
                const el = scrollport.querySelector('[data-chat-anchor-key="' + escapeAttribute(key) + '"]')
                if (el === null) continue
                const top = el.getBoundingClientRect().top
                if (top < bestTop) {
                  bestTop = top
                  bestKey = key
                }
              }
              setActiveKey(bestKey === null ? null : (nav.rowToItem.get(bestKey) ?? null))
            })
            for (const row of rows) observer.observe(row)
            return () => observer.disconnect()
          }, [order])

          // 激活项在导航列表中保持可见
          React.useEffect(() => {
            if (activeKey === null || listRef.current === null) return
            const el = listRef.current.querySelector('[data-nav-key="' + escapeAttribute(activeKey) + '"]')
            if (el !== null && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
          }, [activeKey])

          if (items.length === 0 || geometry === null) return null

          // 收起态：手柄（触发区域 = 手柄本身），横杆数 = 已加载条数
          if (!open) {
            if (geometry.detailsOpen) return null
            const bars = []
            for (let i = 0; i < barCount; i++) {
              bars.push(React.createElement('span', { key: i, className: 'dsh-nav-bar' }))
            }
            return React.createElement('div', {
              className: 'dsh-nav-zone',
              style: {
                right: geometry.right,
                top: geometry.topBase + Math.max(0, (geometry.areaHeight - HANDLE_HEIGHT) / 2),
                height: HANDLE_HEIGHT,
                width: HANDLE_WIDTH,
              },
              onMouseEnter: () => setOpen(true),
            },
              React.createElement('div', { className: 'dsh-nav-handle', 'aria-hidden': 'true' },
                ...bars,
                items.length > MAX_BARS
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
            title: '聊天导航',
            style: {
              right: geometry.right,
              top: geometry.topBase + Math.max(0, (geometry.areaHeight - panelHeight) / 2),
              height: panelHeight,
            },
            onMouseLeave: () => setOpen(false),
          },
            React.createElement('div', { className: 'dsh-nav-head' },
              React.createElement('span', { className: 'dsh-nav-title' }, '消息'),
              React.createElement('span', { className: 'dsh-nav-count' },
                navCountLabel(items.length, session),
              ),
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
            hasMore
              ? React.createElement('div', { className: 'dsh-nav-more' },
                React.createElement('button', {
                  type: 'button',
                  className: 'dsh-nav-more-btn',
                  disabled: loadingOlder,
                  onClick: props.loadOlder,
                }, loadingOlder ? '加载中…' : '加载更早消息'),
              )
              : null,
          )
        }

        // ---- 注册（仅一个可加性座位：面板 + 手柄一体） ----
        slots.inject('shell.overlay', () => slots.register(
          { name: 'shell.overlay', id: 'chat-nav', order: 100, inject: () => ({ hooks: { chatNav: navSource }, loadOlder }) },
          ChatNavPanel,
        ))
      },
    }

    module.exports = plugin
    return module.exports
  },
})
