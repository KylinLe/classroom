# 普陀中学摄影社 · 上课平台

普陀中学摄影社的上课平台：访问需输入密码，通过后从 5 个教师入口中选择进入，查看对应教师的课件。HTML 课件点击播放，PPT/PPTX/PDF/DOC/DOCX 课件点击下载。

线上地址：`https://KylinLe.github.io/classroom/`

## 技术约束（重要）

- **纯静态站点**：只能使用 HTML、JS、CSS，无后端、无构建步骤，部署在 GitHub Pages。
- **仓库必须保持公开**：GitHub Pages 免费版要求公开仓库，且文件自动识别依赖 GitHub 匿名接口（私有仓库下接口会 401）。
- 本地无需安装任何依赖，直接用浏览器打开 `index.html` 即可预览（文件列表读取的是线上 GitHub 仓库，本地也能正常工作）。

## 文件结构

```
classplatform/
├── index.html          # 入口页：密码门 + 教师选择
├── space.html          # 教师空间页：space.html?t=<账号> 显示对应老师的课件列表
├── css/style.css       # 共享样式（设计系统）
├── js/app.js           # 共享脚本（配置 + 密码校验 + 文件列表读取）
├── logo.png            # 社团 Logo（2000×2000，网页中缩放显示）
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

### 2. 文件自动识别（GitHub Contents API）

- `space.html` 通过 GitHub 接口实时读取仓库对应文件夹：
  `https://api.github.com/repos/KylinLe/classroom/contents/<教师账号>`
- **无需维护文件清单**：往教师文件夹里放课件并上传到 GitHub（main 分支）后，网页列表自动出现；文件夹为空或不存在（接口 404）时显示「暂无课件」。
- 支持格式与行为：

  | 扩展名 | 图标 | 点击行为 |
  |---|---|---|
  | html | HTML | 新标签页直接播放 |
  | ppt / pptx | PPT / PPTX | 直接下载 |
  | pdf | PDF | 直接下载 |
  | doc / docx | DOC / DOCX | 直接下载 |

- 下载走本站相对路径（如 `hw/课件.pptx`）并带 `download` 属性，中文文件名正常保留。
- **限流**：GitHub 匿名接口每 IP 每小时 60 次。已做两层防护：按教师文件夹缓存到 `sessionStorage`（5 分钟），页面上有「刷新」按钮强制重新读取。正常上课不会触顶。
- **限制**：只识别教师文件夹**顶层**的文件，不支持子文件夹；其他格式（图片等）会被忽略。

### 3. 配置（维护时只改 `js/app.js` 顶部的 CONFIG）

- `repo`：GitHub 仓库（换仓库只改这里）。
- `passwordHash`：密码哈希（改法见上）。
- `teachers`：教师账号数组，与仓库中同名文件夹一一对应；增删教师需同步增删文件夹。
- `fileTypes`：支持的文件格式与图标。
- `apiCacheMs`：列表缓存时长。

## 日常维护

**添加课件**：把文件放进对应教师文件夹（如 `hw/`）→ 上传到 GitHub main 分支 → 完成。网页下次打开（或点「刷新」）即出现。

**新增教师**：
1. 在仓库根目录新建文件夹（如 `abc/`）；
2. 在 `CONFIG.teachers` 数组里加 `'abc'`；
3. 上传即可。入口页会自动多一个教室。

**更换仓库**：修改 `CONFIG.repo` 的 `owner` 和 `name`。

## 设计系统

延续 `aaa.html`（社团主页）的视觉语言：

- 配色：`--ink:#0f0f0f`（墨黑）/ `--paper:#ffffff` / `--muted:#6e6e73` / `--faint:#a1a1a6` / `--line:#e3e3e5`（细线）；
- 特征：1px 细线分隔、大字号标题、宽字距（letter-spacing）、黑白极简、缓动 `cubic-bezier(.22,.61,.24,1)`；
- 品牌：`logo.png`；favicon 为内联 SVG 六边形光孔；
- 交互：列表行 hover 右移、滚动显现动画、移动端适配、`prefers-reduced-motion` 降级。

## 已知限制

- 密码门是「挡路人」级别，不是安全机制；仓库公开时课件在 GitHub 上本身可见。
- 匿名接口限流 60 次/小时/IP（有缓存兜底）。
- 教师文件夹内不支持子文件夹。
- 空文件夹在 git 中不存在：新教师文件夹里至少放一个课件后，接口才能读到它。
