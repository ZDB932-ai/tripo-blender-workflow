# README 配图

这些图片是本项目自行绘制的架构与流程示意，采用仓库 MIT 许可，不是 Tripo 或 Blender 官方界面截图，也不展示真实生产资产。

| 文件 | 内容 |
|---|---|
| hero.png | 项目首页封面与三个主要阶段 |
| workflow.png | 单资产流程及代理、CLI 的职责 |
| recovery.png | 本地执行成功、失败和未知状态的恢复路径 |

图片在浅色和深色 GitHub 页面均使用自身深色背景。为便于浏览器和移动端显示，README 引用静态 PNG；相邻的 `generate.py` 保留可编辑绘图源文件。

重新生成（仅文档维护需要 Pillow，工作流运行不依赖它）：

```bash
python -m pip install Pillow
python docs/images/generate.py
```

脚本自动寻找常见系统字体；如果未找到，将 `README_FONT` 环境变量指向一个本地 TrueType 字体。不同字体与 Pillow 版本可能产生轻微排版差异，更新后应检查图片。
