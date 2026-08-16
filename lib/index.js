/**
 * dsh-chat-nav 宿主半边：聊天快捷导航的 UI 全部在浏览器半边
 * （exports["./client"] → lib/client.js，由 dsh.client 声明交给
 * client-modules 扫描进 window.__DSH_BOOT__）。宿主半边无行为，
 * 仅提供一个可挂载的插件入口。
 */

export const name = 'dsh-chat-nav'

export function apply() {
  // 浏览器半边注册 shell.overlay 与会话头部导航开关。
}
