---
name: tripo-studio-deliver
description: 导出Tripo中间模型到Blender，或交付Blender精修后的最终资产，检查文件依赖、回读、证据与用户验收；明确区分中间下载和最终交付。
metadata:
  workflow_protocol: "3.6"
---

本地后台操作优先项目 run-local.mjs run/resume，自动执行一次、收集日志/回执/技术清单；resume 不重跑，质量报告仍需真实证据。同缺陷连续失败按 summary.repair_routing 诊断换路，禁止只改策略编号；细节见 docs/workflow/local-automation.md。

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

按项目 `docs/workflow/studio-recipes.md` 配方7检查版本、格式保留属性、全部目标动作与纹理依赖；Studio 导出逐 clip 显式核对勾选，不假定播放中的动作自动导出。功能范围见 `docs/workflow/studio-capabilities.md` 的 D/X 条目。Bridge 传输与文件导出分别留证。分享、渲染、转换或压缩按用途选用，不从交付请求推定公开发布授权。

# 传输与最终打包

区分 transfer（同版模型接收）与 final-package（验证后的交付文件）。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

导入 Blender 前必须按 [纹理检查与用户选择](references/procedure.md#导入-blender-前的纹理检查与用户选择) 核对当前版本的贴图与导出依赖。确认缺失且没有既有明确选择时，及时询问是否先在 Tripo 生成纹理；说明实际可执行顺序，不静默导入灰模继续制作。

1. transfer：新传输先核对 ready_for_transfer/diagnostic_transfer 报告，qa_review 尚未完成检查；历史 exporting/downloaded 继续同版恢复。保持 Bridge 优先；先确认接收场景及双端连接，登记 sending 意图，发送一次。未知记 unknown 并核对对象/日志；对账前禁止切场景或重发。
2. 使用 production.mjs transfer 保存回执。received 记录归档 candidate 哈希，再 attach-source；文件回退也只用同一结果。Blender→Studio→Blender 按 `docs/workflow/roundtrip.md` 保存独立交换副本与父版本，接收先只读比较所需属性，不覆盖原母版；新绑定不继承旧 rig/motion 验收。详见 procedure。
3. final-package：按 PRODUCTION.md“Blender 执行路径”从版本化母版导出；后台导出无需连接 live MCP。export 计划写 format、输出路径、成功和保护检查；新标准另需 capability 契约及 capability_report，核对版本、输入输出格式与七类属性的实际回读证据。不必编造几何缺陷假设。
4. 干净场景回读几何/材质/所需 clip，保存依赖与哈希。export_verified 不等于最终 accepted。
5. 指定引擎时先输出测试文件再交 engine；引擎与最终报告填写 export_iteration_id，文件集合必须等于该有效导出批次，不夹带未测试文件。较新导出失败后不自动退回旧成功版本。
6. 最终 evaluate/decide 绑定当前版本和真实用户意见；保留原 run 静态验收范围。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

动画用途的往返顺序按项目 `docs/workflow/roundtrip.md`，动作审阅按 `docs/workflow/animation-review.md`。原生绑定和所需新动作接收验证后，才在 Blender 完成最终权重、材质与动作精修。已有合格结果直接复用，局部纹理修改不触发重新绑定/动画；同版本意见复用，新结果保留真实验收范围。

导入排错、单动作隔离播放及当前展示统一按项目 `docs/workflow/import-and-presentation.md` 执行。修模型前先区分源问题与播放问题；CURRENT.md由presentation.json生成，不能把最新草稿自动标为成品。
