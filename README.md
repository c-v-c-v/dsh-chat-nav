# dsh-chat-nav

DeepSeek Harness 插件：聊天窗口右侧快捷导航——ChatGPT 式悬停滑出、按提问跳转。
English: A DeepSeek Harness plugin: ChatGPT-style hover quick-navigation for the web chat.

## 功能

- 鼠标移到消息区右缘手柄 → 面板滑出；移开自动收起
- 每条 = 一个用户提问，点击跳转到对应消息
- 滚动时高亮当前轮次
- 手柄横杆数 = 消息条数（上限 10，超出显示总数）
- 只占可加性槽位，不替换任何现成 UI

## 安装

```sh
# 从 GitHub 安装到 web profile
dsh plugin --profile web add github:c-v-c-v/dsh-chat-nav
```

## 使用

重启 `dsh web` 后，鼠标悬停聊天区右缘的手柄即可使用。

## 结构

```
lib/client.js     浏览器半边（全部 UI）
lib/index.js      宿主半边（空入口）
cordis.patch.yml  插件行
package.json      dsh.bundle + dsh.client 声明
```
