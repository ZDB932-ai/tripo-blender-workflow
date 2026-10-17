# 动画制作与验收协议

本文件为执行协议3.6的增量。适用于明确的未来动画、纯绑定或当前动作需求；静态任务跳过。新scaffold要求显式配置`animation_workflow`；历史任务不自动迁移，需在现有授权范围用configure启用版本化标准。不要复制小熊的角度、骨位、面数或容差作为通用标准。

## 流程与检查时机

动作来源顺序必须遵守 [Tripo主生成](tripo-first.md)：明确需求 → 查找对应预设/案例 → 尝试创作专属动画 → 最后才在Tripo骨架上自行制作。骨架始终由Tripo绑定。

参考确认 → Tripo基础制作 → 必要结构修正 → 需要时上传稳定交换副本 → Tripo原生绑定/目标动作 → Blender导回核验与当前源预检 → 原生动作草稿节奏确认 → 最终局部精修与回归 → 导出和最终验收。已有合格原生结果直接复用；早期试绑是发现结构缺陷的可选分支。交换和属性保留边界见 [往返规范](roundtrip.md)，选路依据见 [Tripo主生成](tripo-first.md)。

1. **当前源隔离试验**：需要动作揭示结构风险时可提前试绑；已发现几何/接口缺陷则先修结构，不强制前后各付费绑定一次。取得有效Tripo骨架后，在隔离副本运行`operation=diagnostic`，优先复用原生骨架/动作，必要时仅添加最低限度压力姿势，验证用途相关的抬臂、迈步、屈膝等姿势。缺少有效骨架时回绑定/排错，不用本地代理骨架绕过来源要求。不要求先通过正式polish/rig；诊断有预算与执行回执，不自动晋升；预声明正式用途的supported产物通过正式预算、保护项和回归检查后可按执行协议adopt-diagnostic采纳，正式质量关卡仍需通过。只有完成并有当前源/标准的证据，才能记录preflight；往返或重绑后重新建立当前源检查，复用须有依赖证明。试验失败后允许geometry_repair处理真实结构问题，随后重测；禁止靠改权重名称或检查标准掩盖失败。
2. **正式精修前预检**：启用本协议的动画任务，正式本地rig、material、uv以及Studio独立texture提交前需要当前preflight。初期Studio原生绑定/动作run和隔离diagnostic可先于正式本地关卡；结构修正也不要求先有正式rig。服务若不可分离几何与纹理，允许初始生成附带纹理，但不因此跳过当前源试验；不要重复付费纹理。试验不允许越过原有Studio授权与传输检查。最终权重、刚性装备随动和动作精修安排在最后一次必要往返之后。
导入前发现缺少纹理仍需按 `tripo-studio-deliver` 询问用户；本节的先预检要求不免除告知。若纹理生成被当前 preflight 阻塞，应在询问中明确先隔离灰模诊断、再生成纹理并正式导入的顺序，复用用户已有选择和诊断授权，不把纹理意愿当作跳过预检的授权。

3. **先节奏草稿**：正式动作精修前，优先展示匹配的Tripo原生动作；需要调整时用diagnostic副本做最低限度适配，给用户展示当前各目标动作的实时和慢放。记录速度、幅度、手脚配合、重心、root策略与循环意图。按当前交互模式审阅该版本后记录rhythm。旧模式保留用户节奏意见；concise 模式由代理基于相同证据审阅；旧批准仅在同源、同标准、同草稿时复用。“允许消耗/开始制作”不等于接受尚未看过的节奏。
4. **保护区双向覆盖**：每个目标刺激都必须有保护区。人形角色至少考虑手臂→头/胸/腹、腿→下腹/骨盆中线/对侧腿、躯干→肩髋接口。非人形按实际结构定义，不强套四肢。冻结语义选区、左右边界、根运动移除、测量方式和本资产容差；隔离姿势和目标完整clip均测试。归一权重不能替代远端位移/轮廓检查。
5. **观感单独审阅**：每个目标动作/试验必须有正面、侧面、问题区域近景、1倍实时和小于1倍慢放。记录实际观察，检查轮廓、拉扯、接缝、穿插、接触、摆动自然度与循环。静态帧或脚底数字不能替代动画。技术结果与审美结论分别写明，不宣称未测范围合格。
6. **局部回归**：修改前声明具体属性选择器、受影响clip和保护项。前后采集属性指纹，检查未声明变化；对受影响clip全段/半帧检查，并复测保护区。保持不变的曲线只能证明未改动，不自动继承整个资产的验收。网格/骨架/权重变化要扩大测试到所有依赖动作；仅改指定曲线可缩小回归范围，但仍检查接口与循环。

## 配置

在版本化quality spec中增加：

```json
{
  "animation_workflow": {
    "version": 1,
    "probes": ["arm_raise", "leg_lift"],
    "clips": ["Run", "Wave"],
    "protection_matrix": [
      {"id":"arm_belly","stimulus":"arm_raise","region":"冻结腹部选区文件/索引","root_removal":"hips translation_rotation","measurement":"位移和轮廓；填本资产校准容差"},
      {"id":"leg_lower_belly","stimulus":"leg_lift","region":"冻结下腹与中线选区","root_removal":"hips translation_rotation","measurement":"位移和边长变化；填本资产校准容差"}
    ]
  }
}
```

`clips`对future_animation/rig_only可填命名的预期运动试验；不代表要额外交付动作。实际motion_required=false时不要求rhythm，最终观感仍覆盖所声明的试验。配置内容必须匹配brief，不能删掉难测部位以通过检查。

## 检查点命令

```
node tools/workflow/production.mjs animation-review ASSET work/checkpoint.json
```

checkpoint字段：job_id、source_sha256（当前正式候选）、quality_spec_sha256、kind=preflight|rhythm、iteration_id（已完成且结论为supported的diagnostic）、artifact（该诊断产物文件引用）、decision=accepted、reviewer、review_evidence（实际意见）、evidence、protection、presentation。preflight允许AI审阅；rhythm 在旧模式必须 user，concise + autonomous 可由 ai 审阅。检查器验证身份、来源与文件哈希，不认证自然语言是谁说的，不自动判断视频审美。

`protection`逐项包含`{id,status:"pass",observation,evidence:[文件引用]}`，覆盖冻结矩阵。测量文件应保存实际姿势、选区、单位、阈值及结果；未知和失败不能填pass。

`presentation`逐项包含`{name,status:"pass",observation,views:[...]}`。name覆盖preflight的全部probes或rhythm的全部clips。views每项包含role、file；role必须覆盖front、side、closeup、realtime、slow_motion。closeup增加region；播放项增加speed（实时1，慢放0至1之间）。同一多面板视频可被多个role引用，但必须真正包含所声称画面。

标准变化使检查点过期；候选变化仅在冻结依赖和完整属性指纹证明不受影响时复用。采纳同一已审阅诊断产物可复用该产物的检查点，不能复用别的草稿；详见tools/workflow/LEAN.md。下一轮结构/绑定/动作调整前按实际影响重新试验或展示草稿；不得把旧同名文件当新证据。试验使用diagnostic，不产生循环依赖：它不要求正式rig/motion前序关卡，也不自动晋升产物。正式制作计划可以读取已确认草稿，但仍在预留输出副本上执行。

## 观感报告与局部回归

启用后rig、motion、final报告新增`animation_review`文件引用。该文件绑定job_id/source_sha256/quality_spec_sha256，包含protection与presentation。rig展示probes；motion/final展示clips。导出回读报告也需要同一母版的观感证据，另附实际导出播放结果。已有固定静态采图契约仍有效，两类证据互补。

非诊断、非导出的repair计划新增：

```json
{
  "change_scope": {
    "changed": ["action:Run:具体曲线选择器"],
    "protected": ["object:Body:weights", "object:Body:geometry"],
    "affected_clips": ["Run"]
  }
}
```

completed结果新增`regression`文件引用，内容：source_sha256、output_sha256、plan_sha256、before/after快照引用、playback逐clip的name/status/observation/evidence、protection。快照含source_sha256、collector_sha256、blender_version与`properties:{选择器:SHA256}`；前后使用同一采集器和Blender版本。检查器拒绝快照缺失项与所有未声明变化；没有检测到变化不证明动作质量。当前指纹比较要求前后属性清单完整且一致；增删对象或曲线时，先扩展采集器为双方生成共同清单及明确的缺失标记指纹，不可直接省略已删除属性。

只读采集器：

```
blender --background --factory-startup SOURCE.blend --python-exit-code 1 --python tools/workflow/blender-regression-snapshot.py -- SNAPSHOT.json
```

要求干净归档文件，输出不覆盖；支持Blender5分层Action、网格坐标/拓扑/平滑标志、UV、权重、材质槽、静止骨架与对象变换。不覆盖材质节点值、驱动、约束、NLA、形态键和自交；修改涉及这些属性时必须补充对应采集器/属性指纹及实际回读，不能声称内置脚本已测。统一采样帧，避免姿势不同造成对象变换误报。

纹理处理的实际输入必须对应当前preflight；不同Studio版本或本地文件须先验证几何、轴向与骨架对应关系，字段见[精简执行](../../tools/workflow/LEAN.md)第5节。
