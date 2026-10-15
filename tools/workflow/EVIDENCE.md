# 测量、采图与属性契约

本页是 [PRODUCTION.md](PRODUCTION.md) 的按需执行参考；执行协议版本 3.4。

## 实际网格测量

blender-measure.py 采集 evaluated mesh，支持保护区位移、过渡边拉伸/压缩、明确接触相位的切向滑移和穿地，枚举全部场景对象。拒绝源哈希、版本、区域拓扑不符和产生不同拓扑的修改器，采样后恢复原帧；不自动识别语义权重、自交、接触相位或艺术质量。

配置字段为 asset_root、source、source_sha256、suite_id、blender_version、scale、reference_frame、samples、regions。region 包含 name/object/indices/topology_sha256/kind/space/metrics；root 空间另有 root_object（单位缩放）；contact 必须用 world 并提供 ground.point/normal 和 contact_phases.samples；transition 需要非零内部边。完整可运行示例见 tools/workflow/blender-fixture.py，只用于工程测试，不把其选区与参数复制为生产标准。

原生运行（参数使用绝对路径）：blender --background --factory-startup SOURCE.blend --python-exit-code 1 --python tools/workflow/blender-measure.py -- CONFIG.json OUTPUT.json。输出不覆盖旧文件，含 source/suite、版本、collector 哈希、config 文件引用、区域采样位置和 units/values，可直接用于报告 measurement.pointer。

标准可增加 measurement_contract={collector_sha256,blender_version,conditions}，conditions 至少冻结 samples、regions、reference_frame、scale。评价器验证配置文件哈希、source/suite、采集器/版本与冻结条件。哈希证明文件身份，不认证测量真实性；仍需实际执行证据。生产阈值未知时保持 unknown。

### 拓扑变更的冻结对应点

原同拓扑路径不变。需要更改被测对象拓扑时，使用 `measurement_contract.region_variants` 显式冻结已确定的另一组选区，不能执行后随意替换 regions。

每项字段：`id`、`basis`（为何这些样本语义对应）、`max_reference_error`（按 scale 归一的最大参考位置误差）、`evidence` 文件引用数组、`baseline_source` 文件引用、`baseline_measurement` 文件引用、`regions`。baseline_measurement 必须来自同一 suite、采集器和运行时下原 conditions 的实际测量，且不能再使用另一映射变体。基础 regions 为每个采样点提供同序且唯一的 `sample_ids`。

变体仅允许改各 region 的 object、indices、topology_sha256；区域数量、样本数量、sample_ids、空间、根运动移除、相位、指标名等均不变。新配置加 `mapping_variant: "冻结id"` 并使用对应 regions；报告仍绑定实际候选哈希。评价器核对原/新真实参考点坐标，逐点计算距离/scale，超过冻结上限或覆盖不完整即拒绝。

transition 比较必须预先为基础与变体同时定义同一 `sample_edges`，它的端点是采样列表内索引，不是网格顶点编号；这表示跨拓扑的相同测量线段。原默认内部网格边集合在重拓扑后可能改变，不能冒充同一种应变指标。采集器分别在各自稳定拓扑的场景里运行，仍拒绝采样期间修改器改变拓扑。

建议先用已授权隔离诊断确定目标拓扑与映射，再冻结新标准并重新生成原候选基线证据，最后开始正式修复批次。候选变体的顶点身份必须可预先确定；若算法输出不可预测，应先诊断归档，不能把未知结果直接晋升。候选晋升后的全量关卡沿用这份含映射的标准验证；不需要改回原顶点索引。

本机制是**人工确定语义对应点的验证**，不自动寻找对应关系，不自动证明整片表面、UV、权重、内部接口或未采样区域正确。UV/权重转移仍须独立的属性证据和实际变形检查。默认不提供资产阈值。原生夹具仅验证局部细分、顶点数量改变和已知角点对应，不是生产资产修复成功证明。

## 结构、采图与新生产证据要求

新建 production 带 evidence_policy_required=true，不能通过 configure 删除或关闭标准的 evidence_policy。新模板的 measurement_required、visual_required、capability_required 均为 true。active 标准含适用 metric 时必须有 measurement_contract，含适用 visual 时必须有 visual_contract；draft 可先准备未完成配置。旧 job/标准保持兼容，evaluate 输出 evidence_level=legacy_or_partial；完整策略输出 contract_bound，仅表示证据约束等级，不等于验收或真实性认证。不要修改旧状态来伪造升级。

模板 options.structure=skinned|rigid|mixed。rigid 默认豁免蒙皮权重、连续接口及软体伸缩/保护区检查，保留 rigid_attachments、joint_ranges 和实际压力姿势；这些豁免不代表刚性部件可以随意变形。mixed 同时检查蒙皮和刚性部件，激活前填 structure_regions.skinned/rigid（实际对象或冻结顶点区域标识），并以 structure_map 检查区域、附件及接口对应关系。纯绑定不要求 clip。

root 空间 region 可增加 root_bone，root_object 此时为对应 armature。求值矩阵为 armature 世界矩阵×pose bone 矩阵；root_removal=translation 只移除平移，translation_rotation 同时移除平移与旋转（缺省保留此前对象模式的同时移除行为）。根骨不存在、非单位缩放或模式未知均拒绝。全部配置写入冻结 regions，不能在前后比较中更换移除策略。world 接触测量不移除根运动。

### 固定条件采图

blender-capture.py 只在独立后台 Blender 中运行：它会替换内存中的灯光、世界和相机，且不会保存场景。不要在用户 live 场景调用。输入必须是已保存、哈希匹配的 .blend；其他格式先按正式导入流程归档 Blender 候选，不能假称已直接支持其采图。

命令：`blender --background --factory-startup SOURCE.blend --python-exit-code 1 --python tools/workflow/blender-capture.py -- CONFIG.json OUTPUT.json`。配置顶层为 asset_root/source/source_sha256/suite_id/blender_version/conditions；实际运行示例在 blender-fixture.py 的 capture 对象。

conditions 包含 scene、view_layer、views、resolution、samples、transparent、color、display_device、lights、world_color、world_strength。每个 view 固定 name/frame/location/rotation/type/lens/ortho_scale/clip_start/clip_end；rotation 使用弧度欧拉角。color 固定 view_transform/look/exposure/gamma；每个灯固定 location/rotation/energy/color/size。采集器使用固定 Cycles CPU、中性 AREA 灯、固定反弹/随机种子，关闭景深、动态模糊、合成及序列输出；不能把其灯光设置当最终产品美术要求。支持范围以本机实测版本为准。

visual_contract={collector_sha256,blender_version,conditions} 冻结上述条件。报告内 visual 检查的 visual_capture 引用采图回执。评价器核对源、套件、配置、采集器/运行时、视图清单及图片哈希；比较前后实际记录的 effective_conditions，条件变化拒绝。视觉改善 comparison.checks 的 evidence 必须引用对应前后全部采图。文件哈希包含 PNG 元数据，不以文件哈希相同作为“视觉相同”的判断；工程复测比较像素内容。视觉好坏仍由实际审阅决定。

### 操作属性契约

新标准下本地非 diagnostic 计划另带 capability 文件引用。契约字段：operation（与计划相同）、method（如局部重拓扑/分件/绑定/导出）、route=blender、runtime=Blender、version、input_format、output_format、basis、evidence 文件引用数组，以及 properties。

properties 必须覆盖 topology、uv、materials、rig、animation、objects、scale，每项为 `{disposition:"preserve|change|absent",reason,verification}`。这里的字符串是三种可选值，不是原样填入。依据必须来自本次实际版本/功能/输入验证；字段存在不证明格式兼容。输入格式与候选后缀、输出格式与预留路径及 export.format 一致；version 同 execution.blender_version 冻结。

completed 结果提供 capability_report 文件引用，含 contract_sha256、source_sha256、output_sha256、runtime、version、input_format、output_format、checks。checks 恰好覆盖上述七项，各项包含 name/status（pass|fail|unknown）/observation/evidence；absent 也须证明没有意外出现属性。身份必须对应本轮；任一 fail/unknown 不晋升候选或认定 export_verified。证据需要实际导入/回读/属性测量，不预填 pass。

本执行契约已接入本地制作和导出入口，不是自动更新的跨产品能力注册表。Tripo Studio 的页面版本、输入限制、保留属性和费用仍由 preflight 实际核实，远程计划与授权入口保持原样；不能把本地 route 改为 tripo 绕过远程提交协议。未实际测试的 Studio 操作/版本继续标未验证。

动画用途新增协议见 [动画试验、观感与回归](../../docs/workflow/animation-review.md)。新任务显式配置；历史任务不自动迁移。
