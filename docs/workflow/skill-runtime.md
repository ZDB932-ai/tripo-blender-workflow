# 当前工作流入口（协议3.6）

> 费用：任务范围内默认自主使用现有 Studio 积分，按项目 docs/workflow/credit-policy.md 执行，不逐次请批。参考/质量审阅、本地返工限制、未知任务对账仍保留。

实际命令、阶段出口和中断处理见[操作者入口](operator-guide.md)。不知道恢复哪个资产时先运行 `node tools/workflow/work.mjs list`；安装或改动后用 `validate.mjs --blender PATH` 跑包含真实 Blender 的完整验证。

用户可见四阶段：**需求与参考 → Tripo制作 → 核验与必要修正 → 交付验收**。阶段不是必做操作清单；合格部分直接复用。

## 先读当前任务

在包含 `SKILLS.md` 和 `tools/workflow/production.mjs` 的项目根目录，已有完整制作任务运行 `node tools/workflow/work.mjs summary ASSET`。它从正式状态生成当前需求、候选、预算、验收、下一步及相关技能入口，不另存一套状态。原 `production.mjs next` 保留用于诊断。

只读检查、同版下载不建立完整job；按 [请求范围](request-modes.md) 直接处理。新制作才 scaffold。已有请求范围、动画用途、参考或费用授权仍有效时复用，不因换阶段重复询问。

## 四阶段

| 阶段 | 必要工作 | 按需细节 |
|---|---|---|
| 需求与参考 | 明确用途、范围、交付与本地返工范围；Studio积分应用持续授权；简单静态道具/概念可单图，角色/复杂结构/动画默认四图；真实用户确认参考 | [参考规范](reference-intake.md) |
| Tripo制作 | P/H选型、当前输入/设置/报价；按实际缺陷选择网格、UV、材质及动作处理；已有结果能用就复用 | [Studio配方](studio-recipes.md)；不确定能力时查[功能表](studio-capabilities.md) |
| 核验与必要修正 | 导入诊断、用途相关检查；只修不合格部分。默认Tripo制作，Blender验证和有依据的局部修正 | [Tripo-first](tripo-first.md)；动画才读[动画规范](animation-review.md) |
| 交付验收 | 指定格式、依赖、干净回读；要求引擎时核验引擎；真实最终验收 | deliver/engine技能 |

动画资产需要结构修正和新增原生动作时，默认按 **Tripo基础制作 → 必要结构修正 → 稳定交换副本上传 → Tripo绑定/动作 → Blender导回检查 → 最终权重/材质/动作精修 → 正式导出** 交接。已有合格结果跳过重复步骤；早期试绑用于揭示结构问题，最终精修留在最后一次必要往返之后。属性保留、显式选择导出动作和回读检查见 [往返规范](roundtrip.md)。

## 少填记录，保留证据

独立后台优先 `run-local.mjs run ASSET REQUEST.json --blender PATH [--result RESULT.json]`，自动收集日志、回执和技术清单；中断或补交报告使用 resume，绝不自动重跑。连续缺陷失败按 summary.repair_routing 先诊断/换路；字段与限制见 [本地自动执行](local-automation.md)。

本地修改统一 `work.mjs start ASSET REQUEST.json` → 执行返回的代码或后台参数一次 → `work.mjs finish ASSET RESULT.json`。入口自动填写身份/哈希并串联底层记录；不代替实际脚本、质量证据或审阅。未知执行只对账，不重复start。字段、恢复及底层兼容命令按需读 [执行协议](../../tools/workflow/PRODUCTION.md)。

有冻结依赖和完整属性指纹时，只让受影响关卡/检查点失效；没有证据则重新检查。按用途配置概念预览、静态、动画或引擎交付标准，旧任务不自动降级。合格诊断产物经过正式预算、保护项和回归校验后可用 `adopt-diagnostic` 选为正式候选，仍需正式质量关卡。使用这些路径时读 [精简执行与证据复用](../../tools/workflow/LEAN.md)。

同源连续关卡可合并展示审阅；guided逐阶段、autonomous常规中间AI审阅，均复用参考批准并保留最终用户确认；concise 的节奏检查由代理审阅。技术失败不得通过。标准改变不能继承旧验收。

## 始终保留的边界

- Studio网页与API分账；不自动切API。先查当前兼容与报价，未知提交/传输先对账。
- 保留源版本、已验收资产和未保存场景；Bridge优先同版传输，不为下载失败重生模型。
- 骨架来自Tripo；动作按需求→预设→专属动画→最后在原生骨架上本地制作。不得用诊断产物绕过此要求。
- 四图旧契约保留；旧任务交互与次数策略按已有简化授权一次迁移，历史验收不改写；Studio积分策略已按持续授权更新。记录一致、按钮可见和成品合格分别判断。
- 只读取当前步骤需要的procedure；历史设计与54项功能目录不是每次任务必读或必填清单。

环境异常才运行 `doctor.mjs`。导入异常或展示身份不清时读 [导入与展示](import-and-presentation.md)；提交/传输未知时读 [恢复协议](../../tools/workflow/RECOVERY.md)；建立测量/采图标准时读 [证据契约](../../tools/workflow/EVIDENCE.md)。
