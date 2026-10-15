# 制作配方与能力证据

Studio原生功能配方现见 [studio-recipes.md](studio-recipes.md)，选择索引见 [studio-capabilities.md](studio-capabilities.md)。下面主要是本地验证/修正实现的证据，不应据此把制作默认转到Blender。

配方不是“Blender 能执行 Python”的同义词。复用前记录输入类别、适用条件、实际选区/对象、参数、输出、副本恢复点、评价器和成功样例。没有成功样例保持 experimental。

| 配方 | 当前实现 | 已知边界 | 状态 |
|---|---|---|---|
| 基础模型审计 | tools/workflow/blender-audit.py | 不检测自交、UV重叠、evaluated modifiers、实际变形 | 有历史实测；只证明基础审计 |
| 求值后网格采集 | tools/workflow/blender-measure.py | 固定拓扑/选区、显式相位与坐标；不测自交或艺术质量 | Blender 5.2 隔离夹具通过，生产参数尚待校准 |
| 本地执行回执 | execution.mjs + blender-execution.py | 一次派发、独立输出，不提供沙箱或回滚 | 原生 Blender 5.2 闭环通过，live MCP 待连接验证 |
| 固定条件视觉采集 | tools/workflow/blender-capture.py | 已保存 Blender 副本、固定中性环境；不判断审美、不直接采集 GLB | Blender 5.2 两次独立采图像素一致，回执接入评价器 |
| 跨拓扑冻结对应点 | measurement-contract.mjs + blender-measure.py | 显式同序样本/虚拟边；参考误差上限；不自动匹配语义或验证整片表面 | 隔离局部细分原生夹具通过；真实接口重建未验证 |
| 根骨运动移除 | tools/workflow/blender-measure.py | 显式根骨、单位缩放，区分仅平移和同时移除旋转 | 动态根骨夹具通过，生产区域仍需校准 |
| 本地操作属性契约 | tools/workflow/capability.mjs | 核对版本/格式/七类属性证据，不自动证明语义正确；不替代 Studio preflight | 契约校验回归通过，具体操作仍需实测 |
| 同拓扑保护区评价 | tools/workflow/deformation_guard.py | 调用方必须提供同拓扑、固定选区、坐标系和阈值；不自动识别身体语义 | 单元测试通过；不等于修复配方 |
| 语义权重诊断 | 黄色角色历史实验 | 对象名与骨名依赖该角色 | 案例，不作为通用已验证工具 |
| 真实接口重建和 UV/权重转移 | 尚无独立通用实现 | 必须先定位真实接口并验证转移误差 | experimental，待真实资产验证 |
| 足底连续接触测量 | 黄色角色历史实验 | 接触区域/相位及采样配置尚未通用化 | 案例，不适用无足底接触的动作 |
| 导出回读 | 按真实导出器执行，记录模型/clip/依赖 | 格式和版本敏感 | 每次交付单独验证 |

优先验证一个可重放的局部修复闭环，再在第二种资产上检验适用范围。实际模型生产、外部上传和收费任务沿用各自授权；工程测试中的合成文件不能充当配方成功样例。
