# 发布 VS Code 扩展指南

## 已完成的准备工作 ✅

1. ✅ `.vscodeignore` - 已存在，用于排除不必要的文件
2. ✅ `LICENSE` - 已创建 MIT 许可证
3. ✅ `vsce` 工具 - 已安装（虽然有 Node 版本警告，但仍可使用）

## 后续步骤

### 1. 添加扩展图标 (必需)

**重要**: 你需要添加一个 `icon.png` 文件（128x128 像素）到项目根目录。

可以使用以下方式创建：

-   AI 图片生成工具（DALL-E、Midjourney）
-   在线图标生成器
-   Figma、Sketch 等设计工具

图标建议：

-   简洁明了
-   与 AI + Git 主题相关
-   小尺寸下清晰可见

### 2. 更新 Publisher ID (必需)

**当前状态**: `package.json` 中的 `publisher` 已设置为 `"YOUR_PUBLISHER_ID"`

你需要：

1. 前往 [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
2. 使用 Microsoft 或 GitHub 账号登录
3. 创建一个发布者（Publisher）
4. 将 `package.json` 中的 `"YOUR_PUBLISHER_ID"` 替换为你的实际 Publisher ID

### 3. 获取 Personal Access Token (发布时需要)

1. 前往 [Azure DevOps](https://dev.azure.com/)
2. 点击右上角用户图标 → Personal access tokens
3. 点击 "New Token"
4. 设置：
    - Name: vsce-publish
    - Organization: All accessible organizations
    - Scopes: **Marketplace** → **Manage** (勾选)
5. 复制生成的 token（只显示一次）

### 4. 本地测试打包

```bash
# 编译项目
npm run compile

# 打包成 .vsix 文件（用于本地测试）
vsce package

# 本地安装测试
code --install-extension ai-commit-assistant-0.1.0.vsix
```

### 5. 发布到 Marketplace

```bash
# 首次发布需要登录（使用 Azure DevOps 的 PAT）
vsce login YOUR_PUBLISHER_ID

# 发布
vsce publish

# 或者发布并自动增加版本号
vsce publish patch  # 0.1.0 → 0.1.1
vsce publish minor  # 0.1.0 → 0.2.0
vsce publish major  # 0.1.0 → 1.0.0
```

## 注意事项

⚠️ **Node 版本警告**: 你当前使用 Node v18.18.0，vsce 推荐 Node 20+。虽然仍可使用，但建议升级：

```bash
# 使用 nvm 升级（如果已安装）
nvm install 20
nvm use 20
```

⚠️ **第一次发布**: 发布后可能需要几分钟才能在 Marketplace 上显示

⚠️ **更新扩展**: 每次更新都需要增加 `package.json` 中的 `version` 号

## 快速命令参考

```bash
# 打包测试
vsce package

# 发布（需要先登录）
vsce login YOUR_PUBLISHER_ID
vsce publish

# 查看包内容
vsce ls
```

## 相关链接

-   [VS Code 扩展发布文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
-   [Marketplace 管理面板](https://marketplace.visualstudio.com/manage)
-   [Azure DevOps](https://dev.azure.com/)
