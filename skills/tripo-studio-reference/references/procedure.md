# 需求与参考操作说明

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

执行本阶段读取项目 docs/workflow/reference-intake.md：其中定义需求字段、动画用途、图片评估、单图/四图选择和批准循环；状态命令以 PRODUCTION.md 为准。

1. 查看需求和原图，理解用途、主体、比例、风格、保留特征和输出。先判断动画用途是否已有明确答案；有则记录原话，不重复问，无则询问。区分 static / future_animation / rig_only / animated，不能把初始化 false 当作用户确认静态。
2. 按动画用途评估参考是否适合建模。先按复杂度选择单图/四图；可直接用就保留，不为简单静态道具强制补图；有问题时说明部位、影响和信息缺口，让用户选择重新提供或使用生图模型按当前契约生成单图或前、左、右、后四张独立参考图。复用已有明确选择，不默认重绘。
3. 默认生图读取当前 imagegen 技能并用内置工具；同时参考 studio-recipes.md 配方1评估 Studio 模板、抠图、编辑与多视图。用户明确选择 Studio 时遵守该配方的参考前任务适配边界，不伪造参考批准。先写绑定 intake 的 generation_brief，将动画用途落实到参考姿势、关节/活动间隙、遮挡、独立部件和保留特征。四张保持同一身份、尺度、姿势和材质，不能分别画不同动作；推测背面明确标注。静态资产不强制人体 T pose。
4. 实际检查生成结果后展示。用户拒绝记 rejected，按反馈生成新版本、继续展示；不批准不进入 Tripo 生成。同版真实有效批准可复用，两种 review_mode 都不能由 AI 替代用户参考批准。
5. reference_sets/vNNN 保存本地图片、generation_brief、manifest。manifest 绑定 intake、preparation、files/prompt、decision 和真实哈希；拼版和独立视角分别标识。当前页面是否支持多视图由 preflight 核实，不把审阅拼版无条件上传为单个主体图。
6. 使用 workflow.mjs check-reference；新 prepare/提交检查需求与参考绑定，拒绝 unresolved 动画用途、不可用参考、未批准/被拒绝版本和过期身份。修改参考或用途创建新版本，不覆写已批准文件。
7. 参考批准后交 preflight，延续动画用途做模式/模型选择。参考阶段明确后端、任务操作和本地返工范围；Studio积分使用独立持续授权，不因参考审阅再次询问费用。只有用户明确改变默认图片流程时才使用 text_explicit 路线。

简单静态/概念AI单图使用generated_single_view，仍需真实user_choice_evidence、完整generation_brief及当前版本参考批准；具体契约以reference-intake.md为准。
