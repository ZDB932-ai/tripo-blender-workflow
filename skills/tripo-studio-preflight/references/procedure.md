# 按需操作说明

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

网页操作先读取项目 docs/workflow/playwright-operations.md，按观察→唯一定位→确认行为/费用→执行一次→核验→留证，不将重复点击作为恢复方式。

共享状态、命令与 schema 只以项目 `tools/workflow/PRODUCTION.md` 为准。本文提供领域操作细节，不覆盖当前执行器。版本、报价与控件按实际运行核实。

- 读取 PRODUCTION.md 的远程输入/对账章节、PLAYWRIGHT_SETUP.md 和当前资产文件。优先使用项目tripo_playwright工具；检查工具实际可用性，不将配置文件存在视为接通。profile一次只允许一个浏览器实例，登录问题由用户完成。
- 通过Studio可见页面确认账户余额和已有模型可加载；网络失败只诊断读操作，不用生成测试网络、不关闭证书校验或读取登录密钥。历史错误可能暂时恢复，记录当前证据而非编造修复。
- 参考批准后才能选入对应图片，查看正确图像、张数、朝向和预览。源为模型时核对页面资产URL、版本和本地文件哈希。输入含上传隐私须遵守用户授权范围。
- 逐项读取并设置实际UI：生成模式、可见模型名、几何、AI增强、纹理分辨率、PBR、拓扑、面数、隐私、分件和试用开关。Studio会自动保存，不能依赖旧默认。记录原值与新值；不把仅分享称作完全私密。
- 保存settings和quote快照及预览；plan包含契约所需字段。具体值来自当前页面，不复用历史45积分。未知报价不提交。
- prepare创建新run并自动绑定持续积分授权；核对候选数、实际报价、当前余额与输出后继续，不要求用户确认积分预算。参考批准与任务范围仍独立核验。新任务必须有workflow-policy.json；旧accepted任务不追溯扩大范围。
- 后处理使用当前协议的 typed input；旧格式仍需 source_run_id、source_asset_url、source_version、source_file/source_sha256，不能把旧字段强加给纯本地或纯 Studio 输入。账号无此功能时标注缺口并交接可行替代，不能自动回退API。
- 外部模型输入读 docs/workflow/roundtrip.md：从已保存、结构稳定的母版另存交换副本，核对当前上传格式/大小/姿势、实际输入哈希、所选绑定/动作功能及报价。上传成功或已绑定标志不证明精修权重、旧动作和材质参数无损；保护项留待回传实测。原授权覆盖就继续，新增任务范围才补所缺信息；旧积分上限不触发请批。
- 先读 docs/workflow/studio-capabilities.md 目标条目及 studio-recipes.md 对应配方。新游戏资产同时评估P/Smart Mesh与H/高精度；逐项记录documented、ui_observed、executed、validated证据。分件须检查四边面/绑定兼容性，Smart UV须核实面数上限；Mesh Edit与Magic Brush、快速封口与AI补全、重贴图与超分/PBR分开。当前CLI仅支持candidate_count=1，P2多变体需先扩展契约与测试，不以“同价”绕过限制。

- 新生成先核对 reference-intake.md 的动画用途与当前参考批准；选择模式/模型时把用途写进 selection_reason，切换后重新核对全部受影响设置及报价。plan 绑定 intake_sha256、settings、ui_verification；页面核对来自实际观察，不复制计划伪造。图片输入须属于已批准文件，核对三视图拼版与多槽入口的区别。

- 动画资产纹理处理须将页面实际source_input绑定当前预检；非确切当前candidate的输入须提供preflight_input_binding及几何/轴向/骨架对应性证据，按tools/workflow/LEAN.md第5节核验。不能用本地候选通过替代另一个Studio版本的预检。
