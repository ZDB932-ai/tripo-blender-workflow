# 按需操作说明

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

共享状态、命令与 schema 只以项目 `tools/workflow/PRODUCTION.md` 为准。本文提供领域操作细节，不覆盖当前执行器。版本、报价与控件按实际运行核实。

## 导入 Blender 前的纹理检查与用户选择

在发起新的 Bridge 发送或模型导入前，检查所选 Tripo 资产的**当前版本**是否有可用纹理，并核对导出是否携带纹理。已有下载可只读检查 GLB 内嵌图像、OBJ/MTL 的图像引用及对应文件；只有实际导入才能确认的依赖，在独立检查场景回读，不将其当作用户已同意无纹理继续制作。不要仅凭灰色视口、存在材质槽、已有 UV 或彩色缩略图判断纹理是否存在；区分贴图、纯色/顶点色/程序材质，以及贴图存在但未随文件导出的情况。

- **确认缺失纹理**：及时说明“当前版本只有几何/基础材质，导入后不会自动获得原图配色”，询问用户“是否先在 Tripo 生成纹理，再导入 Blender；还是按无纹理模型继续？”用户选择前暂停新的正式传输/导入和依赖此选择的制作，不默认替用户本地上色。已有明确的“仅几何”“暂不生成纹理”或同版本处理选择可复用，告知当前状态即可，不重复询问；仅有宽泛费用授权不等于已选择无纹理导入。
- **纹理存在但资源遗漏**：优先修正同版导出设置、找回依赖或重下载同版，不推荐重复付费生成。
- **状态未知**：先检查当前版本、导出设置及可得文件；仍不能确认就如实说明未知，不能把未知当作缺失诱导付费。
- **用户选择先生成**：先核对该路线的前置条件、输入兼容性和实际报价，再交 preflight/generate；复用有效费用授权，不将询问本身当作付费提交授权。生成完成后重新核对结果版本、纹理和导出依赖，再传入 Blender。
- **动画任务尚缺 preflight**：在询问时同步解释现行协议要求先做几何变形试验，不能承诺立即先生成纹理。给出真实顺序：“先导入隔离灰模完成预检，再生成纹理并导入彩色版”，或暂停等待用户选择；已有隔离诊断授权可复用。保留用户“希望先有纹理再进行正式制作”的意图，不把它解释成允许绕过关卡，也不静默转入正式灰模制作。
- **用户选择无纹理继续**：记录该版本的选择和外观来源计划；没有本地上色授权时不自动增加外观制作。

将资产/版本、检查依据、纹理状态（present/missing/unknown）、实际颜色来源、导出依赖、用户原话或复用依据及下一步写入当前传输检查报告；同一版本同一状态不反复询问。纹理存在不能替代接收后的依赖核对；灰模检查显示也不应被误报为贴图丢失。未知传输仍先对账，不因这项询问中断对账或重发。

## 默认传输顺序：先准备 Blender，再连接网页 Bridge

用户要求以 Studio DCC Bridge 为主要传输方式。先确认 Blender 进程运行、Tripo Bridge 插件启用并处于 listening；准备独立接收场景和对象基线。然后在 Tripo 网页 DCC Bridge 面板的 Blender 行开启连接，核对网页已连接及插件 connected。两端成功连接后才在导出面板选择“发送至 → Blender”，发送一次并保持该接收场景至接收核对结束。仅有 Blender MCP 可用或插件已安装都不代表 Bridge 已连接。

普通“导出”按钮下载文件与“发送至 → Blender”是不同路线；文件下载失败不能直接判定 Bridge 不可用。Bridge 已收到但权重失败时，传输成功与质量失败分别记录；用户明确要求重新传输可新建独立接收记录，保留旧源，先排除旧请求仍在进行。再次收到同格式模型也不构成独立格式对照证据。


- 先读当前 tools/workflow/PRODUCTION.md，确认当前是transfer（Tripo中间件）还是final（最终成品）。文件 transfer 校验完成后 run 可保持 downloaded；Bridge 无本地 GLB 时用 transfer received 回执并交 Blender，不请用户把中间下载当最终验收。历史仅静态GLB任务仍保持其原accepted范围。
- transfer核对资产URL、选中版本和输出规格。qa_review 先回 refine 完成检查报告，ready_for_transfer/diagnostic_transfer 后才 mark exporting；旧 exporting/export_failed 继续同版恢复。打开实际导出对话框，读取格式及纹理；保持已存在纹理，不默认为升级。逐 clip 明确勾选目标动作并核对数量，检查骨骼导出开关；页面可能默认勾选 0 个动作，当前播放某动作不代表它已加入导出。当前实测GLB，其他格式需确认实际控件和读取器。
- 用Playwright先监听download事件再点击导出，saveAs到本run exports。事件结束还需检查failure、文件大小、格式、依赖、哈希。下载失败转export_failed；重下同结果不重生成。
- 恢复下载时区分网站错误、MCP Transport closed、专用profile被占用和人机验证。验证优先在当前 MCP 会话完成并保留窗口；只有独立登录窗口确实占用同一 profile、需要交还所有权时才请用户关闭，再接回原 profile；不启用isolated新身份、不终止用户浏览器、不绕过验证。已触发download但saveAs失败仍未下载完成，先核对实际落盘文件；重试仅导出同版本，保留失败记录。工具启动被策略拒绝时不能换命令绕过。
- GLB调用 mark downloaded ASSET RUN exports路径的正确CLI顺序：node tools/workflow/workflow.mjs mark ASSET RUN downloaded runs/RUN/exports/model.glb。此步骤生成qa.json；保留已有人工意见，不能把基础结构检查称作完整规范/拓扑验收。
- 其他格式按契约记录独立export manifest并用匹配工具验证，不能用改后缀或伪造GLB检查。绑定输出还需核对 skins、clips、实际骨骼/根节点动画通道与完整播放；仅有旧 clip 名称不能证明旧动作保留。
- 用户已指定Studio DCC Bridge为优先传输路线；文件导出/导入用于故障回退，或有明确理由的格式属性对比、独立归档，记录所选路线依据。Bridge不是Tripo API插件，也不是Blender MCP。先检查插件启用、两端连接、接收实例和导出设置；当前安装版本1.0.34，仍以运行时为准。重启后未启用需恢复并保存偏好，不重复安装。Studio导出面板的“发送至”是悬停菜单，等待目标项出现再选择Blender。
- 发送前写独立transfer记录及接收对象基线，接收后保存来源、对象清单与母版。无本地GLB时不能伪造mark downloaded检查。发送无回执时先核对插件日志、网页和新增对象；仍不明则记transfer_unknown，不盲目重发。回退文件前断开该Bridge连接以防迟到传输重复导入，并再次核对场景，仅使用同一已生成版本，不重新生成。回Tripo再回Blender保留双向parent/hash，检查网格、UV、权重和clip。
- Bridge开关必须限定在已观察到的DCC面板Blender行内；绑定页另有骨骼显示开关，禁止使用全页switch.first()。打开面板后重新确认行和状态，网页“已连接”与Blender状态需一致。绑定导出另核对导出对话框内“导出骨骼”开关。发送等待期间固定接收场景，不在同一实例切换场景做其他诊断。
- 保存DELIVERY.md：参考版本、页面参数、模型URL、报价与实际/估算成本、文件、SHA256、面数证据、正侧背截图、已知缺陷和未测项目。不写cookie或签名URL。
- final从版本化Blender母版导出到deliverables/vNNN，不覆盖Tripo原始输出；按导出器实际支持烘焙必要动画/材质，保存.blend、文件hash和source lineage。在干净场景重新导入检查几何/材质及需要的skins/clips并播放；指定引擎时交engine再汇总结果。
- 最终报告使用 production.mjs evaluate/decide 与当前 production 引用的版本化制作标准验证 final；两种模式都由用户最终验收，记录技术状态与真实用户意见，只接受绑定到当前母版、标准、报告和交付文件的意见；不要把Tripo run自动改成Blender资产accepted。仅原先静态交付路径沿用run的awaiting_user_review→accepted状态。

## Blender 返回 Tripo

Bridge 优先仅指 Studio→Blender；不假设自动双向同步。完整往返选路与保留边界按项目 `docs/workflow/roundtrip.md`。Blender→Studio 从必要几何、分件、UV 修正完成的稳定母版导出独立交换副本，固定父版本和文件哈希；母版保留已有外观、权重和旧动作。preflight 核对当前功能的外部上传入口、输入格式和报价，不能从格式支持推断外部骨架、精修权重或已有动作能无损保留。没有入口就报告，不切换 API。收到新结果先只读核对来源、几何、分件、UV、材质、骨架、权重和实际动画通道，再按独立传输回执归档；验证前不覆盖当前候选。重新绑定后重新建立 rig/motion 证据，不继承旧版通过。最后一次往返后交 Blender 精修实际缺陷；已有合格结果或仅纹理小改不强制往返。网页操作遵循 docs/workflow/playwright-operations.md。

## 纹理选择的可执行下一步

发现缺失纹理后，先执行只读路由，再提出方案：

`node tools/workflow/texture-route.mjs assets/ASSET assets/ASSET/work/texture-check.json`

检查文件包含 `source:{path,sha256}`（当前正式候选）、`texture_status:present|missing|unknown`、`evidence:[{path,sha256}]`，可选 `export_dependencies_verified:true`。已获选择写 `choice:{value:generate_first|continue_untextured,source_sha256,evidence:用户原话或既有批准}`。未接收为本地候选时，先按上文检查 Studio 当前版本并告知选择；此工具不能虚构尚未接收的候选。

工具只读且始终不授予提交权限。`complete_geometry_preflight` 表示保留先纹理的意愿，但须先完成已授权隔离诊断；不重复询问纹理意愿，不生成收费任务。`prepare_texture_submission` 才交正常 preflight/generate 核对当时报价、输入和授权。`reconcile_transfer` 优先对账。源版本变化应重新核对检查证据；纹理已存在但依赖未核实应修正导出，不重新付费生成。远程提交仍执行现有 readiness，不能靠本工具绕过。

## 当前交付入口

资产根目录以 `CURRENT.md` 为当前交付索引，历史 `DELIVERY.md` 保留并链接到当前索引。索引明确更新时间、正式候选、最新诊断、当前展示、最终文件和未通过项目；展示文件的源身份与 production 角色分开。每次交付或版本切换后同步核对来源哈希和链接，不以“编号最新”推断验收。
