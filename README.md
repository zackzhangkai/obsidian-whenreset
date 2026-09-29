# Codex Reset Radar (WhenReset)

在 Obsidian 里追踪 ChatGPT / Codex 的公开额度重置消息:状态栏倒计时、侧边栏雷达视图与新公告通知。数据来自 [whenreset.uk](https://whenreset.uk) 公开雷达,非官方产品,不读取个人账户额度。

Track public ChatGPT / Codex reset signals inside Obsidian: a status-bar countdown, a sidebar radar view, and notices for new announcements. Data comes from the public radar at [whenreset.uk](https://whenreset.uk). Unofficial; never touches your account quota.

## 功能 / Features

- 状态栏常驻倒计时(每秒本地刷新,不额外发请求)/ Always-on status bar countdown (ticks locally, no extra requests)
- 侧边栏雷达视图:同步状态、候选时间、最近事件与原帖链接 / Sidebar radar view with sync status, candidates, recent events and source links
- 新的已宣布重置 / 发卡 / 预告通知 / Notices for newly announced resets, cards and schedules
- 可配置数据源与刷新间隔(默认 15 分钟)/ Configurable data source and refresh interval (default 15 min)

## 网络与隐私 / Network & Privacy

- 本插件唯一网络行为:按刷新间隔 GET 读取公开只读 JSON `https://whenreset.uk/api/radar.json`。
- The only network activity is a periodic GET of the public read-only JSON above.
- 不收集、不上传任何用户数据,不读取笔记内容,无遥测。
- No data collection, no telemetry, no vault file access.

数据语义 / Data semantics:公开消息不等于官方公告;候选时间是统计推断,倒计时到零不代表已重置。
Public posts are not official announcements; candidate times are statistical inferences, and a countdown reaching zero does not mean a reset has happened.

## 安装 / Install

已在 Obsidian 社区插件目录提交审核;审核通过前可手动安装:从 [Releases](../../releases) 下载 `main.js`、`manifest.json`、`styles.css`,放入 `<vault>/.obsidian/plugins/whenreset/` 并启用。
Pending community directory review; until then install manually: download `main.js`, `manifest.json`, `styles.css` from [Releases](../../releases) into `<vault>/.obsidian/plugins/whenreset/` and enable the plugin.

## 开发 / Development

```bash
npm install
npm run dev      # watch 构建
npm run build    # 类型检查 + 生产构建
npm test         # node:test(需要 Node ≥ 22.18)
```

MIT License.
