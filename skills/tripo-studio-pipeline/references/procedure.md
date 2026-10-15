# 按需操作说明

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

共享状态、命令与 schema 只以项目 `tools/workflow/PRODUCTION.md` 为准。本文提供领域操作细节，不覆盖当前执行器。版本、报价与控件按实际运行核实。

- 读取当前执行协议，运行 work.mjs summary（内部调用next）；handoff.json 仅为本地投影，缺少交接文件时从 production sync 重建；旧资产缺 production v2 时按历史证据迁移，不将缺失当作重新生成指令。
- 用户要求迭代验证工作流时，每轮记录具体失败、根因假设、可执行流程修正和下轮验证方式；必要时同步技能安装副本，不能只追加模型截图。连续两轮针对同一缺陷无改善时停止相同策略，比较其他已支持路线并记录换路理由；这不是新增付费授权，也不替代资产既有返工上限。
- 区分展示母版、当前候选和诊断资产。失败候选归档后将当前视图切回保留的外观版本；不要删除失败证据，不将最后生成文件默认作为当前最佳版。确认截图与场景身份后再向用户交付比较。
- 新资产运行 node tools/workflow/scaffold.mjs <asset-id>，已有资产先运行 production.mjs status，远程 run 另查 workflow.mjs status。按用户范围选择下一阶段，不无条件运行全部阶段。
- 区分当前交付与未来用途：用户说后续要动画时，先做可动性预检并记录motion_intent，不自动制作动作。用途从静态扩展时新建增量质量记录，历史静态accepted不变；更新适用标准/授权哈希后才能用于新的付费任务。工作流验证应报告实测链路、未测链路和发现的失败，不以文档齐全或脚本通过替代成品证据。
- 当前执行以 tools/workflow/PRODUCTION.md 为准，能力选路参考 docs/workflow/studio-capabilities.md 与 studio-recipes.md。先确定review_mode：guided逐阶段用户验收，autonomous 保留参考与范围确认、动画节奏草稿及 final 最终用户验收；两种模式都执行技术关卡。未选择用guided；用户要求添加选项不等于已为资产选择autonomous。
- 按 docs/workflow/tripo-first.md，以Tripo生成、Blender辅助修正为默认选路：P/H、Mesh Edit、分件补全、拓扑、纹理、绑定/动作均是Tripo候选。需要结构修正的动画路线读 docs/workflow/roundtrip.md：稳定结构→独立交换副本上传→Tripo绑定/目标动作→Blender导回核验→最终权重、材质、动作精修。早期试绑是诊断分支，不强制每个模型绑两次。保留母版及旧精修内容，上传或已绑定标志不保证旧骨架/权重/动作无损；显式选择导出clip并查实际通道和完整播放。通过部分不重复制作，每次往返记录parent/hash及失效检查。自主模式内不因换阶段重复请批，原前置检查、后端、操作范围及本地返工限制保持；Studio积分按持续授权执行。
- 阶段路由：需求/图片→reference；连接/参数/报价→preflight；提交/等待/恢复→generate；Tripo可制作性检查→refine；中间件导出→deliver；Blender精修→tripo-blender-polish；需要绑定/动作→先refine核查Tripo自动绑定/动作并交preflight/generate；已有原生结果的验证与局部修正→tripo-blender-rig-motion；最终导出→deliver；指定引擎集成→engine。reference/preflight/generate/refine/deliver/engine均为tripo-studio-前缀技能。按需读取同级技能，避免一次加载全部。
- 新资产填写workflow-policy.json与quality-spec.json，从用户请求明确设计、允许操作/后端与本地返工范围；Studio积分自动应用持续授权，不询问总积分或付费次数。run状态只表示Tripo阶段；用 production 的版本化标准、关卡和批次记录区分 Blender 制作与最终验收。Studio 连通性按当前运行核实；未来CLI/API只是适配设计，不自动切换额度。
- 每次交接检查 production.mjs check，必要时 sync 重建 handoff；不手写投影。按模式和既有授权连续完成，不在普通阶段切换时请批。调用review.mjs检查必需质量项及审阅方；自主模式中间AI判断不能伪称用户批准，技术失败不能跳过。
- 恢复任务分别检查网站、身份验证、浏览器工具连接、profile所有者、Bridge双端连接、传输结果、模型质量；不得把不同层错误当同一故障反复重试。已有本地模型时，另一格式下载仅是诊断选项，不是继续工作的硬门槛。同类恢复连续失败且无新增证据时停止重复操作，选择能检验具体假设的路径。项目案例及证据见 docs/validation/incident-review-2026-09-24.md。

- 只读检查/同版下载不强制创建 production，具体分流和初次外部文件归档见 docs/workflow/request-modes.md。已有候选且新增远程结果用 select-remote/defer-remote 明确记录；qa_review 未完成不跳过检查。同一候选可 review-bundle 预检后统一展示、accept-bundle 一次提交真实逐关卡决定，见 tools/workflow/RECOVERY.md。

- 新生成入口按 docs/workflow/reference-intake.md 执行用户指定的参考循环；已有动画用途不重问，未知不默认静态。参考数量按复杂度选择，四张独立视图路线继承动画用途，参考拒绝回修订，不进入 Tripo 试错。未来动画仅影响建模就绪要求，不自动开启本次 rig/motion；按真实本次交付配置 production.requirements。
