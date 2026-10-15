# 导入排错与版本展示

## 先排除导入和播放错误

导入后、开始修网格/权重/动作前，保存来源run、导出设置和实际文件哈希。在干净隔离场景核对：

1. **对象身份**：列出所有网格和骨架，按Armature绑定关系定位角色，不取第一个MESH或默认用场景包围盒。多个蒙皮部件时明确全部角色部件与辅助对象；不能自动把其余对象删除。
2. **骨架来源**：用Tripo原始文件与实际导入骨名、层级、rest pose建立对应。骨名含Mixamo不能独立证明来自Tripo。骨架必须沿用Tripo绑定。
3. **材质**：核对UV、贴图尺寸/数据/打包状态，以及所需材质节点和通道连接。Base Color可见不代表全部PBR通道完整。
4. **播放**：核对Action与slot、帧范围、fps、NLA strip、mute/solo/influence及混合模式。在临时验证场景关闭不相关轨道、单独播放目标动作，保留原始接收文件。不要修改用户未保存场景。
5. **空间**：核对轴向、尺度、rest/pose区别和root motion；比较同一时刻的Studio源预览与本地结果。仅凭前视图或动作名称不能确认正确。
6. **分类**：source_defect / import_mapping / playback_setup / unknown，分别记录证据。播放设置修正后重新验证，再决定是否修改内容。unknown不直接触发重绑或重新生成。

只读清单工具（不保存场景，也不自动认证质量）：

```powershell
& '/path/to/blender' --background --factory-startup SOURCE.blend --python tools/workflow/blender-import-inspect.py -- OUTPUT.json OPTIONAL_MESH_NAME
```

输出必须是新文件。单个蒙皮网格可自动定位；多部件/静态模型必须明确选择，工具保持ambiguous并列出清单。它不校验材质节点连接、root语义或动作自然度，这些仍需实际对照和播放证据。

## 一个展示清单，多个资产角色

production.json继续作为制作状态事实源。presentation.json只选择本次展示的已记录产物，并绑定预览，不晋升候选、不接受质量。每次展示或交付前运行：

```powershell
node tools/workflow/presentation.mjs ASSET check
node tools/workflow/presentation.mjs ASSET write
```

write先备份旧CURRENT.md到index-history，再生成当前索引。禁止手工堆叠多个“当前版本”标题。历史文件保留，通过制作记录或历史索引访问。

presentation.json包含：

```json
{
  "title":"本次展示的明确名称",
  "summary":"改动、已验证范围及剩余问题",
  "source":{"path":"相对模型路径","sha256":"实际哈希"},
  "media":[{
    "label":"正侧面实时",
    "source_sha256":"与source相同",
    "file":{"path":"视频路径","sha256":"实际哈希"},
    "provenance":{"path":"渲染/打包身份记录.json","sha256":"实际哈希"}
  }]
}
```

provenance JSON须有相同source和files数组，列出实际源与媒体文件引用。只可依据真实采图/渲染填写，不能为了通过检查补造来源。生成器检查来源属于production已记录产物、文件未变、媒体与源一致；不会判断视频画面是否正确。

索引分开显示candidate、latest_diagnostic、best_motion_draft、display_master；只有当前候选且final接受记录匹配才可显示已接受母版，其余均为待审展示。旧成品接受不迁移到新草稿。导出文件和引擎验证仍遵守原有export/final检查，不因展示索引成功就通过。
