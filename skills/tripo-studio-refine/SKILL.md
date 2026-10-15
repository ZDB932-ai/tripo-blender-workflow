---
name: tripo-studio-refine
description: 检查 Tripo Studio 模型多视角外形、纹理和拓扑，并按目标规划分件、补全、重拓扑、纹理编辑、绑定和动画。收费处理经独立计划执行，不默认修改已验收资产。
metadata:
  workflow_protocol: "3.6"
---

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

诊断后按项目 `docs/workflow/studio-capabilities.md` 的 M/T/A 条目选择对应操作，执行细节看 `docs/workflow/studio-recipes.md`：先分清结构、拓扑、UV、颜色、材质和动作缺陷，再决定处理。保留合格层，标记变化影响的下游关卡，避免以重生成替代局部修复。

# Studio 结果检查

检查当前 Studio 结果，提出有证据的缺陷及处理候选。

首次在本项目执行时读取项目 `docs/workflow/skill-runtime.md`；恢复运行 `node tools/workflow/work.mjs summary ASSET`。写状态和制作命令以 `tools/workflow/PRODUCTION.md` 为唯一协议。

默认职责：Tripo主生成、Blender辅助验证与局部修正。涉及内容生成、绑定/动作选路或转向Blender替代制作时，读取项目 `docs/workflow/tripo-first.md`；保留用户明确范围与既有授权。

1. 核对模型/版本和用途，多角度比较轮廓、部件、厚度、纹理；截图不证明流形或可变形。qa_review 表示检查中，恢复仍继续检查；完成后按 RECOVERY.md 记录 ready_for_transfer 或 diagnostic_transfer 报告，才交传输。
2. 交 Blender 前确认当前版本是否有纹理，而非只看显示颜色；缺失或未知时交 deliver 的“导入前纹理检查与用户选择”，不要直接默认为灰模接收。记录事实、推断和未知。按需读取 operations.md；Mesh Edit、纹理 Brush、补全与封口分开。
3. 先按tripo-first.md核查与目标相关的Tripo生成/处理能力，把缺陷、保护区、当前能力证据和费用/耗时依据交总控选路；不在本阶段重新定义全流程。
4. 需要 Studio 处理交 preflight/generate；需要内部网格诊断可导入副本，base_model仍保持未通过。
5. 动作预设点击可能启动任务，须先确认行为与授权。不能作为无条件只读测试。

仅在执行具体操作或恢复对应故障时读取 [操作细节](references/procedure.md)。 Studio 后处理按需读取 [操作表](references/operations.md)。

动画用途按项目 `docs/workflow/roundtrip.md` 与 `animation-review.md` 执行：必要结构修正→需要时上传交换副本→Tripo绑定/目标动作→Blender导回当前源预检与节奏确认→最终权重/材质/动作精修。早期试绑为可选诊断，不强制两次绑定。保留母版，核查回传实际属性与通道；已知背包等硬件变形才局部修刚性随动。每种刺激覆盖反向保护区，提供正侧面/近景/实时/慢放，局部修改做属性指纹与受影响动作回归。已有同版本意见复用，不自动迁移历史资产。

动画必须按“明确需求→Tripo对应案例/预设→创作专属动画→最后自行制作动作”选路；无论动作来源如何，骨架由Tripo绑定，Blender不得默认重绑。逐clip记录来源与失败/不可用证据，见 docs/workflow/tripo-first.md。
