# 按需操作说明

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

共享状态、命令与 schema 只以项目 `tools/workflow/PRODUCTION.md` 为准。本文提供领域操作细节，不覆盖当前执行器。版本、报价与控件按实际运行核实。

- 执行路径与恢复以 PRODUCTION.md“Blender 执行路径”为准。实时 MCP 先核对 get_addon_status/get_scene_info，正文连接错误即失败；独立后台先核对可执行文件版本、归档源和隔离输出。MCP 连接失败不阻止已授权的独立后台工作，但派发未知、未保存 live 数据或执行权限限制不能通过换路径绕过。
- 源模型通过base_model可制作性检查后导入；若需诊断允许临时副本导入，但不因此将base_model标通过。保留原始GLB哈希、场景与材质，建立资产专属SOURCE/WORK集合，保存新的work/blender/vNNN文件。不要覆盖用户未保存工作或旧accepted母版，不靠Undo替代磁盘恢复点。
- 若用户仍只请求流程设计，不导入/修改已有资产。进入真实制作后，MCP的user_prompt使用用户实际原话；工具只能执行允许范围内的小批修改，不调用无关在线生图/资产服务。
- 用实际对象名运行 tools/workflow/blender-audit.py 的只读audit_objects，记录基础网格、边界、非流形、UV、材质/纹理和armature；此脚本未检查自交、UV重叠和变形，不可把未测项目记pass。按目标补做必要检查，边界边按有意薄片等例外分类，不能统一删点合并。
- 根据缺陷排序：主要轮廓和比例→必要的拓扑→UV/贴图转移→材质与法线→细节。若整体设计错误返回reference/Tripo计划，不花无限轮次雕刻补救。改UV/拓扑后重新验证贴图和权重；禁止默认对全部资产voxel remesh、decimate、全局smooth或按固定绝对阈值merge。
- 已知后续需要绑定或动作时，polish检查腋下、臂身/双腿/手指的非预期粘连、肩肘膝可用区域及rest pose。一个连通网格是正常角色结构，零非流形不证明适合蒙皮；用多视角、局部线框或截面区分肩部正常连接与沿躯干粘连。新标准把实际抬臂/弯肘等deformation_readiness压力测试放在rig关卡；创建骨架前不要求其通过，未测项也不能记pass。静态几何缺陷仍须处理，不要为通过预检盲目切断肩部。
- 按项目 docs/workflow/studio-recipes.md 比较Tripo局部几何、分件补全、重拓扑和贴图处理；Blender不承担一切。已有合格网格/材质/骨架直接保留，允许仅审计与保存母版。确定需要原生绑定/新动作且静态结构有缺陷时，先完成必要几何、分件和 UV 修正；按 `docs/workflow/roundtrip.md` 从稳定母版导出独立交换副本并固定 hash，核对外部输入入口、范围和费用。外部骨架、精修权重及旧动作不假定能无损保留；回收先只读比较几何、对象、UV、材质、骨架、权重和动画，再决定接入，不覆盖原母版。
- 用bpy操作时按RNA确认枚举和操作参数，材质节点按type查找。保留原高模/材质及修改前后证据，必要时新副本烘焙。实时 MCP 可用场景清单及视口截图观察；后台产物用独立进程回读审计与采图。冻结视觉比较统一用后台 blender-capture.py，实际查看图片。
- 按 PRODUCTION.md 保存 polish 报告，绑定候选、标准、suite 与实际证据；对象、版本、操作参数和回滚路径记录于证据。批次、分类预算、既有总上限和停止策略由 production 管理，先看 next，再由 begin 检查，不手写旧 local_revision_round 字段。权重修复交 rig-motion，几何修复附带权重保护不等于独立权重验收。
- polish使用固定中性灯光、多视角/线框、实际技术证据；由production.mjs evaluate/decide判定审阅流程。guided交用户，autonomous由AI记录ai_review（不能伪称用户批准）。需要 Studio 原生绑定/新动作交总控执行往返，接收后交 tripo-blender-rig-motion 检查与最终精修；已有合格绑定/动作则直接复用。否则交 deliver 最终导出；母版存在不代表绑定、动画或引擎验收。最后一次往返后的材质精修与仅纹理修改留在当前几何上完成，不因此重绑。

- 被测拓扑变化使用 tools/workflow/EVIDENCE.md 的 region_variants；原/新冻结 sample_ids 与测量语义必须一致，transition 使用相同 sample_edges，实际参考点误差必须在上限内。它不替代 UV/权重转移和未采样表面的验证。首次外部格式归档按 docs/workflow/request-modes.md，归档不伪称修复改善。
