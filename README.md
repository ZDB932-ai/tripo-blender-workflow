<div align="center">

# Tripo × Blender Workflow

**让 AI 生成的 3D 资产，走完可追溯、可恢复、可验收的制作流程。**

An agent-assisted pipeline for Tripo Studio and Blender — from reference to verified delivery.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol](https://img.shields.io/badge/Protocol-3.6-6366f1)](tools/workflow/PRODUCTION.md)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933)](#环境要求)
[![Validation](https://img.shields.io/badge/Release_tests-118_passed-2ea44f)](docs/validation/release-validation.md)

[快速开始](#快速开始) · [工作流](#工作流) · [操作手册](docs/workflow/operator-guide.md) · [贡献指南](CONTRIBUTING.md)

</div>

---

## 这个项目解决什么问题

生成一个模型只是制作过程的一步。真正使用它，还需要确认来源、检查几何和材质、验证绑定与动作、处理返工，并确保导出的文件可以重新打开。

这个项目把这些步骤组织成一个 **代理辅助的单资产工作流**：Tripo Studio 承担主要生成、绑定与原生动作；Blender 负责验证、必要局部修正和交付检查；本地 CLI 管理状态、执行记录与质量证据。

适合通过 AI 编程代理协作制作游戏资产、角色原型或静态模型，并希望保留完整制作依据的开发者与创作者。

## 核心能力

| 能力 | 实际行为 |
|---|---|
| **明确的资产身份** | 记录候选、源版本、文件哈希和标准，避免选错模型或借用过期证据 |
| **一次执行，可恢复** | 独立后台运行 Blender，保存日志和回执；恢复只对账，不重复执行未知操作 |
| **按缺陷控制返工** | 同一缺陷连续无改善时要求诊断与方法变化，不能只换策略编号继续 |
| **证据驱动的质量关卡** | 区分技术检查、视觉审阅和最终验收；运行成功不自动变成质量通过 |
| **按需复用检查** | 属性依赖和实际指纹足够时复用证据；不支持或已变化的部分重新验证 |
| **九个阶段技能** | 从需求与参考到 Studio 制作、Blender 修正、引擎接入和交付，按目标调用 |

## 工作流

```mermaid
flowchart LR
    A[需求与参考] --> B[Tripo 制作]
    B --> C[核验与必要修正]
    C --> D[导出与回读]
    D --> E[交付验收]
    C -->|需要原生处理| B
    C -->|局部修正| F[隔离 Blender 执行]
    F --> C
```

对于需要结构修正和新增动作的资产，采用以下顺序：

**必要结构修正 → 稳定交换副本 → Tripo 绑定/动作 → 导回检查 → 最终权重、材质与动作精修 → 正式导出。**

已有合格结果直接复用。静态资产跳过动作步骤；纯绑定任务不要求制作动画。详见 [往返规范](docs/workflow/roundtrip.md)。

## 环境要求

| 组件 | 用途 | 要求 |
|---|---|---|
| Node.js | CLI、状态管理与测试 | 推荐 22 或更新版本 |
| Python | 独立检查脚本 | Python 3 |
| Blender | 后台执行、采样、修正与验证 | 可运行的本地安装，显式指定可执行文件 |
| 支持工具调用的 AI 代理 | 解释需求、操作 Studio、组织证据与审阅 | 技能和工具接入按宿主配置 |
| Tripo Studio 会话 | 网页生成与后处理 | 自有账户；操作时检查当前功能和报价 |
| Playwright MCP | 代理操作 Studio 网页 | 可选依赖，按 [接入说明](PLAYWRIGHT_SETUP.md) 配置 |

核心工作流 **没有第三方 Node 依赖**。后台 Blender 路径不依赖实时 Blender MCP；需要实时场景控制或 DCC Bridge 时，另行配置并验证连接。

发布验证环境：Windows、Node.js 26.8.2、Python 3.13.13、Blender 5.2.0 LTS。其他版本与平台需在目标环境运行验证，见 [发布记录](docs/validation/release-validation.md)。

## 快速开始

### 1. 获取源码

```bash
git clone https://github.com/ZDB932-ai/tripo-blender-workflow.git
cd tripo-blender-workflow
```

查看命令与已有任务：

```bash
node tools/workflow/work.mjs --help
node tools/workflow/work.mjs list
```

### 2. 验证本地环境

以下以 PowerShell 为例，将路径替换为自己的 Blender 安装位置：

```powershell
$blenderExe = 'C:/path/to/Blender/blender.exe'
node tools/workflow/doctor.mjs --profile local --blender $blenderExe
node tools/workflow/validate.mjs --blender $blenderExe --report docs/validation/my-check-raw.json
```

`validate` 会运行包含真实 Blender 夹具的完整测试；缺少 Blender 时失败，不静默跳过。报告文件名须未被占用。

### 3. 建立资产任务

```bash
node tools/workflow/scaffold.mjs my-asset
node tools/workflow/work.mjs summary my-asset
```

`scaffold` 只创建草稿，不会生成模型。接下来由你和代理按 [操作者入口](docs/workflow/operator-guide.md) 完成需求、参考审阅、任务范围、质量标准和本地返工配置，再按返回的下一步继续。

可以向已安装技能的代理提出这样的任务：

> 使用 tripo-studio-pipeline，基于我提供的参考制作一个静态道具，交付 GLB 和可编辑 Blender 母版。先检查当前任务与参考，再按工作流完成制作和验证。

### 4. 执行本地操作

任务已经配置、候选模型已经归档，并准备好实际操作脚本与 `work/request.json` 后：

```powershell
node tools/workflow/run-local.mjs run my-asset work/request.json --blender $blenderExe
```

命令执行一次 Blender 并收集日志、回执和技术清单。准备好基于实际检查的 `work/result.json` 后：

```bash
node tools/workflow/run-local.mjs resume my-asset --result work/result.json
```

`resume` 不会再次运行 Blender。缺少质量资料时保持待补充状态；未知执行先对账。请求、结果与诊断字段见 [本地自动执行](docs/workflow/local-automation.md) 和 [执行协议](tools/workflow/PRODUCTION.md)。

## 安装代理技能

仓库包含一个总控与八个阶段技能，须与共享执行器和文档配套使用。

```powershell
# 先预览差异
node tools/workflow/sync-skills.mjs '你的技能安装目录'

# 备份已有文件后同步
node tools/workflow/sync-skills.mjs '你的技能安装目录' --apply
```

总入口为 `tripo-studio-pipeline`。完整职责表见 [SKILLS.md](SKILLS.md)。只需检查、下载或继续已有任务时，不必重新走完整制作流程。

## 常用命令

所有命令均从仓库根目录运行，`ASSET` 替换为资产目录名。

| 目标 | 命令 |
|---|---|
| 查看全部任务 | `node tools/workflow/work.mjs list` |
| 查看下一步与返工建议 | `node tools/workflow/work.mjs summary ASSET` |
| 新建草稿 | `node tools/workflow/scaffold.mjs ASSET` |
| 一次后台执行 | `node tools/workflow/run-local.mjs run ASSET REQUEST.json --blender PATH` |
| 恢复并提交质量结果 | `node tools/workflow/run-local.mjs resume ASSET --result RESULT.json` |
| 检查正式记录 | `node tools/workflow/production.mjs check ASSET` |
| 完整本地验证 | `node tools/workflow/validate.mjs --blender PATH` |

## 积分与审阅

仓库保留原作者的配置偏好：已授权任务范围内自主使用现有 Studio 网页积分，不逐次询问；仍核对报价、余额和未知提交，不自动充值、购买套餐或切换 API。

**克隆仓库不等于获得费用授权。** 原作者的持续授权仅适用于原作者账户。其他操作者应在首次制作前配置自己的 `workflow-policy.json` 和真实授权依据；需要显式费用上限时使用 `explicit_budget` 模式。参见 [积分策略](docs/workflow/credit-policy.md)。

参考审阅、适用的动画节奏审阅及最终验收独立于费用设置，不能由积分授权代替。

## 测试与验证

```bash
# 规则与状态测试；未设置 BLENDER_TEST_EXE 时会明确跳过真实 Blender 测试
npm test --prefix tools/workflow

# Python 形变保护检查
python tools/workflow/test_deformation_guard.py
```

当前发布基线：**114 项工作流测试通过，0 失败、0 跳过；另有 4 项 Python 检查通过。** 这是本次发布的验证记录，不是持续集成实时状态。

覆盖正常执行、回执核验、源文件保护、失败记录、超时保持未知、恢复不重放、过期证据拦截及跨策略返工规则。完整验证请使用前述 `validate --blender`，详见 [机器可读摘要](docs/validation/release-summary.json)。

## 项目结构

```text
.
├── skills/                  # 总控与八个阶段技能
├── tools/
│   ├── workflow/            # 状态、执行、质量校验、Blender 脚本与测试
│   └── playwright/          # 可选浏览器 MCP 依赖
├── docs/
│   ├── workflow/            # 当前操作规范
│   ├── validation/          # 发布验证摘要
│   └── research/            # 标明日期的功能研究
├── assets/                  # 本地任务与资产，默认不提交 Git
├── PLAYWRIGHT_SETUP.md      # Studio 会话接入
└── DELIVERY.md              # 交付范围与限制
```

## 当前边界

- 支持代理辅助的单资产、单候选流程；尚无远程批量、多变体及参考批准前 Studio 收费生图适配。
- CLI 不自动点击网页；当前账户功能、页面设置、输入兼容性与报价需要实际核对。
- 后台测试不认证实时 Blender MCP/Bridge 连接，也不证明任意资产的美术、蒙皮或动作质量。
- 技术清单不代替导出回读与质量报告；本地 Python 执行不是安全沙箱。
- 未知操作不自动重放，崩溃残留锁须先核实执行者。

生产模型、浏览器 profile、会话快照、凭据和私人项目记忆不在此仓库中。[交付说明](DELIVERY.md)列出了进一步的适用范围。

## 文档导航

- [操作者入口](docs/workflow/operator-guide.md)：从新任务到交付的实际步骤。
- [本地自动执行与返工](docs/workflow/local-automation.md)：run/resume、技术记录与换路。
- [执行协议](tools/workflow/PRODUCTION.md)：正式状态、质量关卡与数据格式。
- [恢复协议](tools/workflow/RECOVERY.md)：远程未知任务、传输和审阅恢复。
- [Studio 操作配方](docs/workflow/studio-recipes.md)：按目标选择功能。
- [贡献指南](CONTRIBUTING.md)：提交问题、修改与测试约定。

## 开源许可

本项目采用 [MIT License](LICENSE)。欢迎使用、修改和贡献。

第三方软件、服务及依赖保留各自许可与使用条款；本许可证不授予 Tripo 服务使用额度，也不替生成资产决定权利归属。本项目是独立工作流项目，与 Tripo、Blender 官方无隶属关系。
