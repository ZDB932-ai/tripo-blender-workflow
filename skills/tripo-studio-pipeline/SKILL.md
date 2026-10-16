---
name: tripo-studio-pipeline
description: 启动或恢复Tripo到Blender的资产工作流，路由参考检查、生成、精修、绑定动作与交付，支持逐阶段或首尾用户验收。当前生成采用Studio网页额度，不自动切换API。
metadata:
  workflow_protocol: "3.6"
---

本地后台操作优先项目 run-local.mjs run/resume，自动执行一次、收集日志/回执/技术清单；resume 不重跑，质量报告仍需真实证据。同缺陷连续失败按 summary.repair_routing 诊断换路，禁止只改策略编号；细节见 docs/workflow/local-automation.md。

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

# 资产工作流总控

启动或恢复Tripo资产任务。先读项目 `docs/workflow/skill-runtime.md`；已有制作运行 `node tools/workflow/work.mjs summary ASSET`，按其真实下一步继续。只读检查和同版下载按请求范围直接处理，不启动完整制作。

用户可见四阶段：需求与参考→Tripo制作→核验与必要修正→交付验收。技术能力仍由九个兼容技能提供，阶段名不要求制作或用户确认重复发生。

- 需求/参考→reference；设置/报价→preflight；提交/未知对账→generate；Studio缺陷诊断及原生处理选路→refine。
- 导入/同版传输/最终文件→deliver；Blender必要局部修正→blender-polish；原生骨架/动作验证修正→rig-motion；指定引擎→engine。
- 先复用目标相关的Tripo结果。具体操作查 `docs/workflow/studio-recipes.md`，不明确功能时查能力表；不用遍54项，也不逐项填跳过理由。
- 动画结构需修正时按 `docs/workflow/roundtrip.md`：结构稳定→交换副本上传→Tripo绑定/动作→Blender导回检查→最终权重/材质/动作精修。早期试绑可选，已有合格结果不强制重绑；保留母版，核查回传实际通道，导出明确选clip。
- 本地修改用work start/finish减少记录步骤；依赖证据复用和诊断采纳按 `tools/workflow/LEAN.md`，不凭“只改一点”继承验收。
- 复用有效范围与批准。角色/复杂结构/动画默认四独立参考，简单静态/概念按参考规范可单图。参考、适用的动画节奏、最终验收保留真实用户审阅。
- 骨架必须来自Tripo；动作明确需求后先预设再专属动画，最后才本地制作动作。缺纹理复用同版本已有选择；依赖未满足时说明可行顺序。
- 未决执行/提交/传输先对账。已有本地返工上限、停止策略、保护项和历史验收保持；Studio积分执行持续授权。完成报告覆盖实际请求全部输出及必要验证。

恢复特殊故障或具体编排时才读 [操作细节](references/procedure.md)。

本地修改次数按 docs/workflow/iteration-policy.md：新任务 progress_guarded；旧任务复用用户已有取消次数请批的指令一次迁移。不反复询问增加次数；无改善自动诊断换路，达到停滞保护时报告具体未解决要求，保留最佳候选与真实质量关卡。
