# 贡献指南

欢迎通过 Issue 或 Pull Request 提供缺陷复现、测试和改进。提交前请先阅读 README 与相关执行协议。

## 报告问题

说明操作系统、Node/Python/Blender 版本、执行命令、预期行为和实际行为。尽量提供最小可复现案例。不要上传账户凭据、cookie、签名下载链接、私人模型或完整浏览器 profile。

## 修改与测试

核心代码位于 tools/workflow，阶段指导位于 skills，运行说明位于 docs/workflow。影响行为的修改应同时核对技能与文档是否一致。

```bash
npm test --prefix tools/workflow
python tools/workflow/test_deformation_guard.py
node tools/workflow/validate.mjs --blender PATH
```

没有 Blender 时明确说明跳过哪些集成测试。不要以伪造回执、用户意见或质量报告让测试通过；合成夹具只用于工程验证，不作为生产质量证据。

保持原始资产与已验收文件不变。未知执行先对账，不自动重放；候选身份、费用范围、必要审阅与失败计数不得因修改而意外失效。新增接口应在隔离临时目录验证失败和恢复行为。

提交应聚焦一个问题，并说明行为变化、验证结果及未覆盖的部分。依赖或第三方代码需保留相应许可。贡献按本项目 MIT License 提供。
