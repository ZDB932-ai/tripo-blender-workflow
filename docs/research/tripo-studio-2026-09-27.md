# Tripo 官方资料学习与当前 Studio 核验

日期：2026-09-27。目标：将Studio作为主要制作平台，补齐功能选择、操作顺序、输入兼容、保护范围和结果验证。交付为 [功能表](../workflow/studio-capabilities.md) 与 [操作配方](../workflow/studio-recipes.md) 及九个技能接入；不是新模型生产记录。

## 学习方法和证据等级

从用户指定教程中心追踪核心产品页、发布说明、帮助中心及Studio工作台。优先采用具体功能说明和当前目标面板；泛用教程、自动生成文章和宣传语只作线索。没有完整观看/逐帧审查教程中心所有外链视频，不宣称全平台所有隐藏功能均实测。

- documented：官方文档已读；不代表账号或输入兼容。
- ui_observed：当前面板/控件/限制可见；不代表任务执行成功。
- executed：应有实际任务身份和返回产物；本次没有新增。
- validated：应有用途相关的质量检查、保护项及必要验收；本次没有新增。

本次使用项目现有 tripo_playwright 会话，只导航、读取、切换模式和打开设置；没有上传素材，没有生成、应用预设、保存模型、发送Bridge或消费试用。导航时显示的账户标识与余额不写入此共享研究。模式设置可能被Studio记忆，后续预检仍重新读取全部设置。

## 官方阅读索引

以下为已打开阅读的主要官方来源；内容归纳进入对应功能ID。配方中的验收方法和保守顺序是本项目的制作判断，不是官网效果承诺。

| 来源 | 解决的问题 / 对应功能 |
|---|---|
| [教程中心](https://www.tripo3d.ai/zh/tutorials) | 全链路索引、基础生成、质量、集成与排错导航 |
| [Studio逐页教程](https://www.tripo3d.ai/blog/tripo-studio-tutorial-english) | 旧七类工作区；G05/G08、M03/M07/M10、T08/T09、D01/D02；界面会演进 |
| [P2.0发布与操作](https://www.tripo3d.ai/zh/blog/tripo-p2-0-preview) | G04/G07、M01；四图、多变体、Mesh Edit及H/P定位 |
| [Smart Mesh](https://www.tripo3d.ai/zh/features/smart-mesh) | G04与游戏/实时拓扑取向 |
| [高精度模型](https://www.tripo3d.ai/zh/features/high-detail-model) | G03；高密度几何路线 |
| [图片转3D](https://www.tripo3d.ai/zh/features/image-to-3d-model) | G01、显示模式D03及后处理概览 |
| [文字转3D](https://www.tripo3d.ai/zh/features/text-to-3d-model) | G02；提示词生成入口 |
| [图像模板与多视图工作流](https://www.tripo3d.ai/zh/blog/gpt-image-2-5-sunburst-tripo) | R01–R09、G08；模板、Edit Image、Cutout和多视图；模型公告不当作账号默认值 |
| [Smart UV](https://www.tripo3d.ai/zh/blog/smart-uv) | M08/M09；上限、二维/三维联动、利用率、重试 |
| [部件分割功能页](https://www.tripo3d.ai/zh/features/ai-model-segmentation) | M02/M03；组件可编辑、外部输入线索 |
| [Segmentation v2](https://www.tripo3d.ai/zh/blog/tripo-segmentation-v2) | G06、M02/M04/M05；粒度、切口和两种补全 |
| [四边重拓扑功能页](https://www.tripo3d.ai/zh/features/ai-quad-remesher) | 本次正文出现大量图片转3D内容；不据其URL断言全部重拓扑参数 |
| [AI贴图](https://www.tripo3d.ai/zh/features/ai-texturing) | T01–T03/T07；风格、PBR、去光处理 |
| [局部纹理重绘](https://www.tripo3d.ai/blog/repaint-specific-texture-area) | T04/T05；Gen/Paint及局部处理范围 |
| [局部纹理修复工作流](https://www.tripo3d.ai/blog/repaint-part-of-3d-texture) | 先底图、局部修复，再放大/核查PBR |
| [8K Texture](https://www.tripo3d.ai/blog/tripo-8k-texture) | T06、D06；Use Original UV、BaseColor与其他贴图尺寸区别 |
| [现有模型纹理提升](https://www.tripo3d.ai/blog/upscale-retexture-existing-model) | 根据局部/全局/分辨率问题分流；其“8K即将上线”已与新说明/UI冲突 |
| [艺术风格说明](https://www.tripo3d.ai/zh/blog/how-to-achieve-different-artistic-styles) | T09；生成前/后风格化，旧预设不能假定仍有入口 |
| [绑定功能页](https://www.tripo3d.ai/zh/features/ai-auto-rigging) | A01，外部网格与FBX/GLB携骨架 |
| [已有模型上传与动画限制](https://www.tripo3d.ai/zh/help/features/is-it-possible-to-upload-my-existing-model-for-animation) | A01/A04/D06；人形/四足与姿势限制 |
| [纹理、绑定与锁定帧更新](https://www.tripo3d.ai/zh/blog/hd-texture-rigging-update) | A02/A07、X01；动作检索与静态帧输出 |
| [多个动画导出到单文件](https://www.tripo3d.ai/zh/help/features/how-do-i-export-multiple-animations-into-a-single-file-for-blender) | D04；启用动画并回读Actions |
| [导出到DCC](https://www.tripo3d.ai/zh/help/features/how-to-export-and-import-to-dcc-tools) | D05；Bridge及同版文件导出两种路线 |
| [Blender集成专页](https://www.tripo3d.ai/zh/integrations/blender) | 区分Studio Bridge与API生成插件 |
| [泛用Bridge教程](https://www.tripo3d.ai/zh/tutorials/master-dcc-bridge-blender-tutorial) | 存在API token描述，不据此要求Studio Bridge改用API |
| [导出格式教程](https://www.tripo3d.ai/zh/tutorials/tripo-ai-export-formats) | D04；格式用途概览，实际携带属性仍以回读为准 |
| [8月更新](https://www.tripo3d.ai/zh/blog/tripo-august-update) | D07、X01；Gallery/AI展示、Viewer/Compressor和集成变化 |
| [帮助中心功能目录](https://www.tripo3d.ai/zh/help/features) | 失败、下载、图片适用性和功能支持入口 |
| [更好的图片输入](https://www.tripo3d.ai/zh/help/features/how-to-get-better-image-to-3d-results) | G01；输入质量和一致性 |
| [API与插件目录](https://www.tripo3d.ai/zh/help/api-plugins) | X03；Studio与API/集成边界 |
| [3D Viewer](https://www.tripo3d.ai/zh/3d-tools/3d-viewer) | X01；配套浏览器查看工具 |
| [Converter](https://www.tripo3d.ai/zh/3d-tools/convert) | X01；派生格式转换，不能保证属性无损 |
| [File Compressor](https://www.tripo3d.ai/zh/3d-tools/file-compressor) | X01；压缩前后比较 |
| [STL Repair](https://www.tripo3d.ai/zh/3d-tools/stl-repair) | X02；打印网格检查/修复 |
| [STL Editor](https://www.tripo3d.ai/zh/3d-tools/stl-editor) | X02；尺寸、测量和方向调整 |

## 当前 UI 核验（本次只读观察）

观察时间约20:20–20:40，中国标准时间。工作台路由前缀为 `https://studio.tripo3d.ai/zh/workspace/`。空面板用于核对入口，已有小宇航员模型只用于读取可见设置；不改变其源文件、验收、账本或动作。以下报价仅是当时显示，不能拿来提交未来任务；未完成对应输入和设置冻结的价格不构成正式报价。

| 页面 / 输入上下文 | 实际观察 | 边界 |
|---|---|---|
| generate（无输入） | H3.1；分部件生成、8K、几何与纹理、私密性；图片JPG/PNG/WEBP≤20MB | 未上传参考；价格随设置变化 |
| generate→智能网格（无输入） | P2.0，生成数量1/2/4；显示实时网格编辑即将上线 | 未展开完整参数、未提交变体 |
| generate-image（无图） | 文本、更多模板、Nano Banana 2默认、比例、数量1–4及4K | 未生成图像；其他模型/图后功能未逐项执行 |
| segmentation（无输入） | 明确“不适用于：四边面模型、已绑定骨骼的模型” | 不能把官方泛称任意模型当作可用；当前限制以后仍须复核 |
| fill-parts（无输入） | 上传/从资产选择进行部件补全 | 具体封口/补全控件需兼容的分件输入 |
| smart-uv（无输入） | 三角≤80,000 / 四边≤40,000 | 只验证页面限制，未验证输出 |
| retopology（已有H模型） | 四边/三角选项、智能网格P1.0、面数控制；显示40积分 | 不能据此推导P2范围或重拓扑保留骨架 |
| smart-uv（已有H模型） | 展开UV与导出入口 | 未点击展开、未假定收费/免费 |
| texture（已有H模型） | 去光处理、2K/4K/8K；显示20积分 | 不表示所有档位同价 |
| texture-edit（已有H模型） | 生成模式、绘制模式、创意强度、纹理预览、保存；生成预览显示5积分 | 明确预览也可能计费；未生成/刷选/保存 |
| texture-upscale（已有H模型） | 4K 4096²、8K 8192²；立即提升显示10积分 | 尚未选不同档位核价，实际通道尺寸未回读 |
| texture-pbr（已有H模型） | 独立生成PBR；显示5积分 | 未点击生成 |
| rigging（已有绑定H模型） | 骨架显示开关、通向动画、重试显示20积分 | 未重绑；保留原Tripo骨架 |
| animate（已有绑定H模型） | 预设/AI动画，检索、筛选、最近使用；文字描述、时长控件、生成显示20；提示支持文字或视频、建议T/A人形 | 未应用预设，视频格式/长度未核实 |
| animate→多阶段动作 | 起点、节点A、添加关键帧、各节点动作/时间；说明生成后再应用 | 打开设置后离开，未输入、生成或应用 |
| 已有P2模型查看 | Quad，面数/顶点统计；有纹理生成与导出 | 没有确认可操作的Mesh Edit，维持unknown；旁边H生成设置不代表当前模型来源 |
| 全工作台资产侧栏 | OBJ/FBX/STL/GLB上传≤150MB；资产与属性标签、管理；顶部DCC Bridge | 上传入口通用不表示所有处理接受这些属性 |

页面身份与部分控件原始快照由Playwright保存在 `tools/playwright/output/page-2026-09-27T12-*.yml`；原始记录可能含账户信息，不复制进共享知识库。本文是脱敏的人工核查摘要，不冒充资产计划的 `ui_verification`。源文件不可用于未来提交报价。

## 发现的冲突及处理决定

1. 教程中心称默认四边/水密，具体模式和真实输出不同：按用途验证实际文件，不作为质量保证。
2. 老纹理文章称8K未上线，当前专页/UI已可见：使用新功能说明并逐通道查分辨率；不把BaseColor的8K套到所有通道。
3. 老Studio教程把上传模型列为Coming Soon，当前上传入口已存在：外部网格返回Tripo成为可评估路线，但逐功能兼容性独立检查。
4. 分割宣传范围很广，当前面板排除quad/rigged：预先安排分件；不在绑定后破坏合格结果来“用上分割”。
5. P2公告讲Mesh Edit，当前部分UI仍预告：记录文档/UI差异，不把没找到写成全平台不支持，也不宣布该功能已跑通。
6. 公告列图像模型与当前默认模型不同：实际模型按页面选择，功能研究不硬编码供应商型号。
7. 绑定页泛称多种生物，帮助页有更窄姿势/体型要求；当前自定义动画提示T/A人形：按具体功能和输入核验。
8. 官网/API价格与Studio显示可能不同：只以绑定输入、设置和时间的正式Studio报价进入预算。
9. 浏览器可用、按钮可见、任务成功、成品合格分别记证据。本次没有新增端到端功能成功样例。

## 对旧流程的诊断与落地

原有Tripo-first方向正确，但缺少完整入口索引、兼容性排程、Smart UV及细分材质/动画指引；九技能间容易重复阅读旧矩阵，README还把3.3称为最新。此次增加按需功能表和配方，精简refine操作表为路由，接入所有相关阶段，修正当前入口版本说明和四视图措辞。参考、节奏与最终真实用户验收保留。

保留未适配项：Studio参考阶段收费生成、批量3D、一次多变体尚缺对应执行器契约；Mesh Edit、视频上传与风格化的全部目标输入仍缺实测。前两类不能绕过既有提交检查；后几类按实际任务预检。功能调查与标准制定已经落地，但不据此声称这些功能已自动化生产或质量合格。

下一次有真实资产需求时，优先验证有直接收益的单输入功能：Smart UV、局部纹理/PBR、专属/多阶段动画；用版本化副本与现有授权累积执行和质量证据。无需为覆盖率开展无目的收费试验。
