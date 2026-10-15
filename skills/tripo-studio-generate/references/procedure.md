# 按需操作说明

费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

网页操作先读取项目 docs/workflow/playwright-operations.md，按观察→唯一定位→确认行为/费用→执行一次→核验→留证，不将重复点击作为恢复方式。

共享状态、命令与 schema 只以项目 `tools/workflow/PRODUCTION.md` 为准。本文提供领域操作细节，不覆盖当前执行器。版本、报价与控件按实际运行核实。

- 读取现行 PRODUCTION.md、workflow-policy 与 run state/plan/approval，恢复以 production.mjs next 为准。check-plan核验任务操作、后端、参考hash和当前报价，默认自动使用持续积分授权，不以旧积分上限或付费次数拦截。未知任务先对账；消耗及退款仍据真实证据记录，历史费用缺失显示unknown。
- 运行 workflow.mjs check-plan ASSET RUN；仅planned且通过后，先mark submitting并持久化证据，再基于最新页面定位点击一次目标提交按钮。生成按钮可能仍可点击，不代表应再次提交。
- 记录可见新资产URL、时间、版本、进度和余额，mark processing。等待期间使用有界等待和低频页面观察，给用户必要进度，不用固定长睡眠或频繁刷新。
- 提交后通信异常、无任务身份、或发现本地submitting时，按submission_unknown核对资产列表/历史。禁止自动重提；发现原任务后继续跟踪。服务明确失败时记录原因和退款未知性，不擅自重试收费操作。
- 完成后必须模型成功加载且进度结束，再mark studio_result_ready，交接refine；若资源网络异常，保留已完成任务身份，恢复加载而非新生成。
- 本技能也可执行已获授权的后处理run，但必须使用其实际面板按钮、源模型、版本和报价，不能把所有操作写作Generate或套用API任务状态。

- check-plan/mark submitting 会校验已确认动画用途、可用且已批准的参考、需求哈希、页面实值与计划一致性及上传文件范围。失败退回相应阶段补真实资料；不能伪造批准或修改旧 accepted 来绕过。当前页面有变化即重新准备计划，时间未过期不等于页面仍一致。
