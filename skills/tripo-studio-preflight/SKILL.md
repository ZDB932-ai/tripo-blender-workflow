---
name: tripo-studio-preflight
description: 检查 Tripo Studio Playwright 登录、资源连通性、素材预览、页面参数和报价，形成可批准的网页生产计划；适用于提交前准备，不执行生成。
metadata:
  workflow_protocol: "3.6"
---

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

按项目 `docs/workflow/studio-recipes.md` 核对所选功能的输入兼容性：三角/四边面、已绑定状态、UV、面数及下游依赖。空面板存在按钮不等于当前模型可用；参数与报价从正确源版本的实际页面读取。功能索引见 `docs/workflow/studio-capabilities.md`。

# Studio 操作计划

读取当前功能、账户、输入与报价，为一次操作形成具体计划。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 先检查实际项目 Playwright 与页面。登录/CDN/工具连接分别诊断，不以生成测试连接。
2. 读取目标功能对应能力资料及本技能 procedure；按当前界面核对输入、源版本、参数、隐私及报价。
3. 使用 text/image 参考和 typed input；Studio 源固定版本及证据，本地源固定文件哈希，不编造 source run。
4. prepare 保存新 run；自动绑定持续积分授权并核对任务范围；不再为报价或旧积分上限请批。参考批准仍独立核验。
5. 不点击付费提交；计划准备好交 generate。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

动画用途按项目 `docs/workflow/roundtrip.md` 与 `animation-review.md` 执行：先稳定必要结构，需要时上传交换副本到Tripo绑定/生成动作，导回当前源预检和节奏确认后最终精修。早期试绑为可选诊断，已有合格结果不强制重绑。核查外部上传条件、当次报价及属性保留证据；不从“已绑定”推定旧权重/动作完整。每种刺激覆盖反向保护区，提供正侧面/近景/实时/慢放，局部修改做属性指纹与受影响动作回归。已有同版本意见复用，不自动迁移历史资产。

登录或连接异常时按项目 `docs/workflow/playwright-operations.md` 的统一会话恢复规则处理，复用当前 MCP 持久会话；不要调用已停用的独立恢复脚本或为了验证反复重启浏览器。

参考数量按 docs/workflow/reference-intake.md：新任务 simple_static/concept 且明确静态可选已批准单图；角色、复杂结构和动画默认四图。旧四图契约不自动迁移，逐槽核对仍保留。
