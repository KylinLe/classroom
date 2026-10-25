# 普陀中学摄影社 · 上课平台

普陀中学摄影社的上课平台：访问需输入密码，通过后从 5 个教师入口中选择进入，查看对应教师的课件。HTML 课件点击播放，PPT/PPTX/PDF/DOC/DOCX 课件点击下载。

线上地址：`https://KylinLe.github.io/classroom/`

## 技术约束（重要）

- **纯静态站点**：只能使用 HTML、JS、CSS，无后端、无构建步骤，部署在 GitHub Pages。
- **GitHub Actions 是唯一例外**：`.github/workflows/update-filelist.yml` 是部署侧的自动小助手（每次推送后生成课件清单 files.json），不参与网站运行；网站本身仍是纯静态的。
- **仓库必须保持公开**：GitHub Pages 免费版要求公开仓库；主通道 GitHub Contents API 在私有仓库下会 401（有清单通道兜底，但公开是前提）。
- 本地无需安装任何依赖，直接用浏览器打开 `index.html` 即可预览（文件列表读取的是线上 GitHub 仓库，本地也能正常工作）。

## 文件结构

```
classplatform/
├── index.html          # 入口页：密码门 + 教师选择
├── space.html          # 教师空间页：space.html?t=<账号> 显示对应老师的课件列表
├── css/style.css       # 共享样式（设计系统）
├── js/app.js           # 共享脚本（配置 + 密码校验 + 文件列表读取）
├── logo.png            # 社团 Logo（2000×2000，网页中缩放显示）
├── files.json          # 课件清单（GitHub Actions 每次推送后自动生成，不要手动修改）
├── .github/workflows/  # 自动生成 files.json 的 GitHub Actions 工作流（不要删除）
├── README.md           # 项目维护文档（机制、配置、日常维护、已知限制），其他 AI 接手必读
├── 测试清单.md          # 部署前 / 加课件后的测试清单与注意事项（给使用者的检查手册）
├── aaa.html            # 社团主页（设计参考，不属于平台流程，可保留可删除）
├── hw/                 # 教师 hw 的课件文件夹
├── lxn/                # 教师 lxn 的课件文件夹
├── lzy/                # 教师 lzy 的课件文件夹
├── swh/                # 教师 swh 的课件文件夹
└── yyz/                # 教师 yyz 的课件文件夹
```

## 访问流程

1. 打开 `index.html` → 输入访问密码 `139572`（校验的是 SHA-256 哈希，代码中无明文）。
2. 密码通过后进入「选择教室」，点击教师账号进入 `space.html?t=<账号>`。
3. 密码状态存在 `sessionStorage`（键 `cp_unlocked`）：
   - 同一浏览器会话内刷新、切换教室都不需要重新输密码；
   - 直接打开 `space.html` 而未输过密码时，会跳回密码门，输完密码后自动跳回原教室；
   - 新开一个浏览器（或新会话）需重新输密码。

## 核心机制

### 1. 密码校验

- `js/app.js` 顶部 `CONFIG.passwordHash` 保存密码的 SHA-256 哈希（纯 JS 实现，不依赖浏览器安全上下文，本地 `file://` 打开也能用）。
- **改密码**：终端运行 `printf '新密码' | shasum -a 256`，把输出替换到 `CONFIG.passwordHash`。
- **注意**：纯前端校验挡不住懂技术的人（哈希和逻辑都在源码里）。对社团上课平台够用，但不是真正的安全。

### 2. 文件自动识别（三通道读取）

- `space.html` 实时读取仓库对应教师文件夹，**无需维护文件清单**：往教师文件夹里放课件并上传到 GitHub（main 分支）后，网页列表自动出现；文件夹为空或不存在时显示「暂无课件」。
- 读取顺序（`fetchTeacherFiles`）：
  1. `sessionStorage` 会话缓存（5 分钟内直接命中，不发请求）；
  2. **主通道**：GitHub Contents API `https://api.github.com/repos/KylinLe/classroom/contents/<教师账号>`（新课件立刻可见；个别网络环境连不上时自动降级）；
  3. **清单通道**：`files.json`，与网站同源、最稳定。由 GitHub Actions 在**每次推送后自动生成**（见 `.github/workflows/update-filelist.yml`：扫描所有顶层文件夹，把支持格式的课件名和大小写入清单并提交回仓库）。新课件推送后约 1-2 分钟内出现；
  4. **备用通道**：jsDelivr CDN 数据接口 `https://data.jsdelivr.com/v1/package/gh/...@main/flat`（清单缺失时的最后兜底；CDN 有缓存，新课件可能延迟出现）；
  5. 全部失败但有旧缓存时，先显示旧列表兜底；全失败且无缓存才报错，错误提示写明原因（限流 / 网络）并附直达 GitHub 文件夹的链接。
- **数据源标注**：课件数量旁会标注当前数据来源（`GitHub` / `文件清单` / `备用通道` / `缓存`），排查「新课件不出现」时先看这个标注。主通道在本会话失败过后会记住，后续直接走清单通道，避免每次等待连接超时；点「刷新」会重新尝试主通道。
- 支持格式与行为：

  | 扩展名 | 图标 | 点击行为 |
  |---|---|---|
  | html | HTML | 新标签页直接播放 |
  | ppt / pptx | PPT / PPTX | 直接下载 |
  | pdf | PDF | 直接下载 |
  | doc / docx | DOC / DOCX | 直接下载 |

- 下载走本站相对路径（如 `hw/课件.pptx`）并带 `download` 属性，中文文件名正常保留。
- **限流**：GitHub 匿名接口每 IP 每小时 60 次（403 时错误提示会说明）。已做两层防护：按教师文件夹缓存到 `sessionStorage`（5 分钟），页面上有「刷新」按钮强制重新读取。正常上课不会触顶。
- **限制**：只识别教师文件夹**顶层**的文件，不支持子文件夹；其他格式（图片等）会被忽略。

### 3. 配置（维护时只改 `js/app.js` 顶部的 CONFIG）

- `repo` / `branch`：GitHub 仓库与默认分支（换仓库只改这里）。
- `passwordHash`：密码哈希（改法见上）。
- `teachers`：教师账号数组，与仓库中同名文件夹一一对应；增删教师需同步增删文件夹。
- `fileTypes`：支持的文件格式与图标。
- `apiCacheMs`：列表缓存时长。

## 日常维护

**添加课件**：把文件放进对应教师文件夹（如 `hw/`）→ 上传到 GitHub main 分支 → 完成。推送会触发 GitHub Actions 自动刷新 files.json，约 1-2 分钟后网页（点「刷新」）即出现新课件。

**新增教师**：
1. 在仓库根目录新建文件夹（如 `abc/`）；
2. 在 `CONFIG.teachers` 数组里加 `'abc'`；
3. 上传即可。入口页会自动多一个教室，files.json 也会自动包含它。

**更换仓库**：修改 `CONFIG.repo` 的 `owner` 和 `name`（工作流里没有写死仓库名，无需改动）。

**不要动的东西**：`.github/workflows/update-filelist.yml` 和自动生成的 `files.json` 不要删除、不要手动修改。注意 `.github` 是隐藏文件夹（访达里按 `Cmd + Shift + .` 显示），上传时确保它一起上传。

## 设计系统

延续 `aaa.html`（社团主页）的视觉语言：

- 配色：`--ink:#0f0f0f`（墨黑）/ `--paper:#ffffff` / `--muted:#6e6e73` / `--faint:#a1a1a6` / `--line:#e3e3e5`（细线）；
- 特征：1px 细线分隔、大字号标题、宽字距（letter-spacing）、黑白极简、缓动 `cubic-bezier(.22,.61,.24,1)`；
- 品牌：`logo.png`；favicon 为内联 SVG 六边形光孔；
- 交互：列表行 hover 右移、滚动显现动画、移动端适配、`prefers-reduced-motion` 降级。

## 已知限制

- 密码门是「挡路人」级别，不是安全机制；仓库公开时课件在 GitHub 上本身可见。
- 主通道 GitHub 匿名接口限流 60 次/小时/IP；触顶或网络不通时自动降级到 files.json 清单通道，列表不受影响。
- 个别网络环境访问 `api.github.com` 不畅：清单通道保证列表照常更新（推送后约 1-2 分钟）；若连清单都读不到才走 jsDelivr 备用通道，此时新课件可能有延迟。
- 教师文件夹内不支持子文件夹。
- 空文件夹在 git 中不存在：新教师文件夹里至少放一个课件后，清单才会包含它。
