# Studio 浏览器接入

核心 CLI 无需浏览器；Studio 操作需要代理宿主的 Playwright MCP。安装可选依赖：

```powershell
npm ci --prefix tools/playwright
```

在宿主中将 MCP 启动命令设置为 Node 的实际路径，参数指向本仓库 tools/playwright/node_modules/@playwright/mcp/cli.js，并传 --browser chrome、--user-data-dir（专用本地 profile 路径）、--output-dir（本仓库 tools/playwright/output）。具体配置格式按宿主说明填写。

使用持久会话完成登录，再通过 tabs/snapshot 验证工作台。一个 profile 同时只由一个进程持有；遇到验证码交用户完成，不关闭证书校验或读取密钥。登录后不要另起探针浏览器争抢会话。配置文件、profile、cookies 和截图不提交 Git。

实时 Blender MCP/Studio DCC Bridge 需安装其官方对应组件并独立验证来源身份和接收回执；本仓库不内置第三方插件。可用后台 Blender 执行本地验证，但不能据此声称 Bridge 已连接。

[网页操作与恢复规范](docs/workflow/playwright-operations.md)
