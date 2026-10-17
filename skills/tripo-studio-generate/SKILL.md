---
name: tripo-studio-generate
description: 按已有明确授权在 Tripo Studio 提交单次资产生成或处理任务，追踪网页进度并处理未知提交；适用于已完成参考和报价准备的 run。
metadata:
  workflow_protocol: "3.6"
---

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

Studio 多步处理按项目 `docs/workflow/studio-recipes.md` 记录生成预览、应用、保存的各自状态与费用；成功预览不等于已保存产物。纹理生成、局部编辑、超分与 PBR 都遵守动画预检依赖；执行器仅支持单候选，不能把多变体按钮当作已有批量适配。

默认按项目 docs/workflow/concise-mode.md 执行：内部检查和恢复由代理处理，不将 blocked 直接变成用户请示；只在真实缺失设计输入、访问要求、范围变更或最终验收时询问。

# Studio 执行与对账

执行已准备且授权覆盖的单次生成/后处理，或恢复已有远程任务。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 读取 plan、approval、policy 与当前页面；check-plan 通过后，点击前 mark submitting 持久化意图，然后仅提交一次。
2. 保存远程身份与当前证据；断线或任务不明先核对，禁止再点生成。
3. 明确结果使用 workflow.mjs reconcile ASSET RUN RECORD；失败/取消须任务身份及证据，not_created 须明确服务确认。预算不自动释放。
4. 任务成功且结果加载完成后进入 studio_result_ready，交 refine；资源加载失败只恢复已有结果。
   输入为Blender交换副本或新绑定结果时，按 `docs/workflow/roundtrip.md` 关联父母版、上传文件和返回版本；不把“已绑定”或同名clip当作旧权重/动作完整保留，导回核验后才作质量结论。
5. 有界等待并报告进度。操作完成不等于模型质量通过。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。

参考数量按 docs/workflow/reference-intake.md：新任务 simple_static/concept 且明确静态可选已批准单图；角色、复杂结构和动画默认四图。旧四图契约不自动迁移，逐槽核对仍保留。

本地修改次数按 docs/workflow/iteration-policy.md：新任务 progress_guarded；旧任务复用用户已有取消次数请批的指令一次迁移。不反复询问增加次数；无改善自动诊断换路，达到停滞保护时报告具体未解决要求，保留最佳候选与真实质量关卡。
