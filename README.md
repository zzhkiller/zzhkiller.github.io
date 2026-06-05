# zzhkiller 个人门户

这是一个可以直接部署到 GitHub Pages 的静态个人门户。它会把 `content/materials` 里的公开资料生成搜索索引，访客可以在首页快速搜索项目、文章、链接和关键词。

## 推荐 GitHub 地址

如果 GitHub 用户名是 `zzhkiller`，最短、最像个人门户的地址是：

- 仓库名：`zzhkiller.github.io`
- 访问地址：`https://zzhkiller.github.io/`
- 仓库地址：`https://github.com/zzhkiller/zzhkiller.github.io`

如果你的 GitHub 用户名不是 `zzhkiller`，把上面的 `zzhkiller` 替换成真实用户名。

## 更新资料

1. 把要公开的 Markdown、文本、JSON、CSV 或 HTML 文件放到 `content/materials`。
2. 编辑 `content/profile.json`，补充姓名、简介、联系方式、技能和快捷入口。
3. 运行：

```bash
python3 scripts/collect_materials.py
```

如果资料已经散落在别的本地文件夹，可以先预览导入：

```bash
python3 scripts/import_materials.py "/你的资料文件夹" --dry-run
```

确认无误后再真正复制到门户公开目录：

```bash
python3 scripts/import_materials.py "/你的资料文件夹"
python3 scripts/collect_materials.py
```

本地仓库配置好 GitHub remote 后，可以用下面的脚本自动生成索引、提交并推送：

```bash
bash scripts/update_portal.sh
```

## 本地预览

```bash
python3 scripts/collect_materials.py
python3 -m http.server 8000
```

然后打开 `http://localhost:8000`。

## 发布到 GitHub

先在 GitHub 新建公开仓库 `zzhkiller.github.io`，再在本地运行：

```bash
git remote add origin https://github.com/zzhkiller/zzhkiller.github.io.git
git push -u origin main
```

GitHub Pages 会使用 `.github/workflows/pages.yml` 自动发布站点。

## 隐私边界

默认只索引 `content/materials` 目录，不会扫描整个电脑。只有你放进这个目录并提交到 GitHub 的资料才会公开。不要把身份证件、密钥、私密合同、未公开邮箱或手机号放进公开仓库。
