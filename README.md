# Tripo × Blender Workflow

可交付的代理辅助单资产制作工作流。Tripo Studio 负责主要生成、绑定与原生动作；Blender 用于验证、必要局部修正、正式导出与回读。执行协议 3.6，分发版本 0.1.0。

## 能做什么

- 从需求与参考、单候选 Studio 制作到交付验收，保留明确的来源与版本。
- 管理操作范围、积分授权、质量标准、用户审阅和未知任务对账。
- 一条命令运行隔离 Blender，收集日志、回执和技术清单；恢复不重放。
- 同一缺陷连续无改善时要求诊断和实质换路，不能只换策略编号。
- 根据真实依赖证据复用检查，并保留必要的参考、节奏和最终审阅。

它不是无人值守的一键生成服务。CLI 不自动点击 Studio，也不把脚本成功认定为美术合格。在线网页、实时 MCP 和 Bridge 需按部署环境连接验证。

## 环境

Node.js 22 或更新版本、Python 3、可运行的 Blender。核心工作流无第三方 Node 依赖。此版本的真实 Blender 测试环境与结果见 发布验证（本地历史资料，未随包分发）。跨平台支持以实际测试为准；本次本地验证运行于 Windows。

Studio 网页操作需支持 Playwright MCP 的代理宿主及登录会话；后台 Blender 运行不依赖实时 Blender MCP。参见 [浏览器接入](PLAYWRIGHT_SETUP.md)。

## 开始使用

在仓库根目录运行：

```powershell
node tools/workflow/work.mjs --help
node tools/workflow/work.mjs list
node tools/workflow/scaffold.mjs my-asset
node tools/workflow/work.mjs summary my-asset
```

scaffold 仅创建草稿。按 [操作者入口](docs/workflow/operator-guide.md) 配置真实用途、参考、质量标准及本地返工范围，然后制作。不要把示例或夹具中的批准内容用于真实资产。

```powershell
node tools/workflow/run-local.mjs run my-asset work/request.json --blender '实际的/blender.exe' --result work/result.json
node tools/workflow/run-local.mjs resume my-asset --result work/result.json
```

请求和结果格式：[本地执行与返工选路](docs/workflow/local-automation.md)、[执行协议](tools/workflow/PRODUCTION.md)。

## 安装阶段技能

```powershell
node tools/workflow/sync-skills.mjs '你的技能安装目录'
node tools/workflow/sync-skills.mjs '你的技能安装目录' --apply
```

第一次为预览，第二次备份并同步。技能需要与此仓库配套使用。入口和九个阶段见 [SKILLS.md](SKILLS.md)。

## 验证

```powershell
npm test --prefix tools/workflow
python tools/workflow/test_deformation_guard.py
node tools/workflow/validate.mjs --blender '实际的/blender.exe' --report docs/validation/local-raw.json
```

普通 npm test 在未指定 BLENDER_TEST_EXE 时明确跳过真实 Blender 测试；完整交付检查必须使用 validate，缺少 Blender 会失败。测试报告不证明在线服务或任意新资产质量。

## 当前费用默认值

本私有项目保留仓库所有者已明确授权的偏好：任务范围内自主消耗现有 Studio 网页积分，不逐次询问；不自动充值、买套餐或切 API。见 [积分策略](docs/workflow/credit-policy.md)。移交其他操作者或账户时，必须使用该操作者自己的授权，不继承原所有者指令。

## 分发内容与边界

包含通用源码、测试、九个技能、当前操作规范和发布验证。未包含生产模型、浏览器 profile、登录信息、会话截图、私人项目记忆及针对特定角色的一次性修复脚本；这些仍保留在原工作目录。assets 默认被 Git 忽略，避免后续误传产物或账号信息。

暂未提供远程批量、多变体和参考批准前 Studio 收费生图适配；实时 Blender MCP/Bridge 不由后台测试认证。更多限制见 [交付说明](DELIVERY.md)。
