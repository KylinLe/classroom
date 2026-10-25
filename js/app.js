/* ============================================================
   普陀中学摄影社 · 上课平台 — 共享脚本
   - 密码校验（SHA-256 哈希比对，代码中不出现明文密码）
   - 教师空间文件列表（GitHub Contents API 自动读取）
   - 页面初始化（按 body 的 data-page 属性分发）
   维护时只需修改下方 CONFIG，其余逻辑无需改动。
   ============================================================ */
'use strict';

/* ==================== 配置 ==================== */
var CONFIG = {
  /* GitHub 仓库（换仓库只改这里） */
  repo: { owner: 'KylinLe', name: 'classroom' },
  branch: 'main',

  /* 访问密码的 SHA-256 哈希。
     改密码：在终端运行  printf '新密码' | shasum -a 256
     把输出替换到下面即可，代码里永远不出现明文密码。 */
  passwordHash: '36d82184c0441dd01de5a05a029b6cafe1bbcff05f7b3e904a3ea419e072dec6',

  /* 教师账号（与仓库里同名的文件夹一一对应） */
  teachers: ['hw', 'lxn', 'lzy', 'swh', 'yyz'],

  /* 支持的文件格式：badge 为列表图标，play 表示新标签页播放，否则下载 */
  fileTypes: {
    html: { badge: 'HTML', action: 'play',     label: '播放' },
    ppt:  { badge: 'PPT',  action: 'download', label: '下载' },
    pptx: { badge: 'PPTX', action: 'download', label: '下载' },
    pdf:  { badge: 'PDF',  action: 'download', label: '下载' },
    doc:  { badge: 'DOC',  action: 'download', label: '下载' },
    docx: { badge: 'DOCX', action: 'download', label: '下载' }
  },

  /* 文件列表缓存时长（毫秒）。GitHub 接口匿名每小时限 60 次，
     缓存避免反复读取触顶；点「刷新」可强制重新读取。 */
  apiCacheMs: 5 * 60 * 1000,

  /* 会话标记：输过一次密码后，本次浏览器会话内不再询问 */
  unlockKey: 'cp_unlocked'
};

/* ==================== 工具函数 ==================== */

/* SHA-256（纯 JS 实现，本地文件方式打开也能用） */
var K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Bytes(bytes) {
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
           0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  /* 填充：0x80 开头，补零到长度 % 64 == 56，末尾追加 64 位比特长度 */
  var msg = bytes.slice();
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  var bitLenHi = Math.floor(bytes.length * 8 / 0x100000000);
  var bitLenLo = (bytes.length * 8) >>> 0;
  for (var j = 3; j >= 0; j--) msg.push((bitLenHi >>> (j * 8)) & 0xff);
  for (var b = 3; b >= 0; b--) msg.push((bitLenLo >>> (b * 8)) & 0xff);

  for (var block = 0; block < msg.length; block += 64) {
    var W = new Array(64);
    for (var t = 0; t < 16; t++) {
      var o = block + t * 4;
      W[t] = ((msg[o] << 24) | (msg[o + 1] << 16) | (msg[o + 2] << 8) | msg[o + 3]) >>> 0;
    }
    for (var s = 16; s < 64; s++) {
      var w15 = W[s - 15], w2 = W[s - 2];
      var s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      var s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      W[s] = (W[s - 16] + s0 + W[s - 7] + s1) >>> 0;
    }

    var a = H[0], b = H[1], c = H[2], d = H[3],
        e = H[4], f = H[5], g = H[6], h = H[7];

    for (var r = 0; r < 64; r++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + K[r] + W[r]) >>> 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  var hex = '';
  for (var i = 0; i < 8; i++) hex += ('00000000' + H[i].toString(16)).slice(-8);
  return hex;
}

function sha256Hex(str) {
  var utf8 = unescape(encodeURIComponent(str)); /* 字符串 -> UTF-8 字节串 */
  var bytes = [];
  for (var i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  return sha256Bytes(bytes);
}

/* GitHub 接口返回的文件名可能是 URL 编码，解码后用于展示 */
function decodeName(name) {
  try { return decodeURIComponent(name); }
  catch (e) { return name; }
}

function fileExt(name) {
  var m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

/* 会话解锁状态（sessionStorage：每次新开浏览器会话需重新输密码） */
function isUnlocked() {
  try { return sessionStorage.getItem(CONFIG.unlockKey) === '1'; }
  catch (e) { return false; }
}
function unlock() {
  try { sessionStorage.setItem(CONFIG.unlockKey, '1'); } catch (e) {}
}

/* 课件链接：走本站相对路径（GitHub Pages 与本地预览都适用） */
function fileHref(teacher, name) {
  return teacher + '/' + encodeURIComponent(name);
}

/* ==================== 文件列表读取 ==================== */

/* 记录最近一次列表来自哪个数据源，显示在课件数量旁，方便排查问题 */
var lastSource = 'cache';
var SRC_LABELS = {
  github: ' · GitHub',
  manifest: ' · 文件清单',
  jsdelivr: ' · 备用通道',
  cache: ' · 缓存',
  'cache-stale': ' · 旧缓存'
};
function srcLabel() { return SRC_LABELS[lastSource] || ''; }

/* 把一条原始文件记录转成课件条目；格式不支持返回 null */
function makeFile(displayName, size) {
  var ext = fileExt(displayName);
  var type = CONFIG.fileTypes[ext];
  if (!type) return null;
  return {
    name: displayName,
    ext: ext,
    size: size,
    badge: type.badge,
    action: type.action,
    label: type.label
  };
}

function sortFiles(files) {
  files.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
  return files;
}

/* 主通道：GitHub Contents API（新上传的课件立刻可见） */
function fetchFromGitHub(teacher) {
  var api = 'https://api.github.com/repos/' +
            CONFIG.repo.owner + '/' + CONFIG.repo.name +
            '/contents/' + encodeURIComponent(teacher);

  return fetch(api, { cache: 'no-store' })
    .then(function (res) {
      if (res.status === 404) {
        /* 文件夹还没上传过课件 -> 视为空；接口可达，清除「不可达」标记 */
        lastSource = 'github';
        try { sessionStorage.removeItem('cp_api_down'); } catch (e) {}
        return [];
      }
      if (!res.ok) {
        var e = new Error('HTTP ' + res.status);
        e.code = (res.status === 403) ? 'rate' : 'http'; /* 403 多为匿名限流 */
        throw e;
      }
      return res.json();
    })
    .then(function (items) {
      if (!Array.isArray(items)) return [];
      lastSource = 'github';
      try { sessionStorage.removeItem('cp_api_down'); } catch (e) {}
      var files = [];
      items.forEach(function (it) {
        if (it.type !== 'file') return; /* 忽略子文件夹与其他条目 */
        var f = makeFile(decodeName(it.name), it.size);
        if (f) files.push(f);
      });
      return sortFiles(files);
    });
}

/* 备用通道：jsDelivr CDN 数据接口（GitHub 接口连不上时使用）。
   注意：CDN 有缓存，新上传的课件可能要过一段时间才在这里出现。 */
function fetchFromJsdelivr(teacher) {
  var api = 'https://data.jsdelivr.com/v1/package/gh/' +
            CONFIG.repo.owner + '/' + CONFIG.repo.name + '@' + CONFIG.branch + '/flat';

  return fetch(api, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      lastSource = 'jsdelivr';
      var prefix = '/' + teacher + '/';
      var files = [];
      (data.files || []).forEach(function (it) {
        if (it.name.indexOf(prefix) !== 0) return;
        var rest = it.name.slice(prefix.length);
        if (rest.indexOf('/') !== -1) return; /* 只取文件夹顶层，与主通道行为一致 */
        var f = makeFile(decodeName(rest), it.size);
        if (f) files.push(f);
      });
      return sortFiles(files);
    });
}

/* 清单通道：files.json（GitHub Actions 在每次推送后自动生成）。
   与网站同源，不受外部接口网络影响，是最稳定的通道；
   新课件在推送后约 1-2 分钟内出现。 */
function fetchFromManifest(teacher) {
  var url = 'files.json?t=' + Date.now(); /* 加时间戳避免浏览器缓存旧清单 */
  return fetch(url, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      lastSource = 'manifest';
      var list = (data && data.teachers && data.teachers[teacher]) || [];
      var files = [];
      list.forEach(function (it) {
        var f = makeFile(decodeName(it.name), it.size);
        if (f) files.push(f);
      });
      return sortFiles(files);
    });
}

/* 主通道在本次会话内失败过（多为网络连不上），记录状态，
   后续读取直接走清单通道，避免每次都等待连接超时。
   点「刷新」（force）会重新尝试主通道。 */
function isApiDown() {
  try { return sessionStorage.getItem('cp_api_down') === '1'; } catch (e) { return false; }
}
function markApiDown() {
  try { sessionStorage.setItem('cp_api_down', '1'); } catch (e) {}
}

function readFilesCache(teacher) {
  try {
    return JSON.parse(sessionStorage.getItem('cp_files_' + teacher)) || null;
  } catch (e) { return null; } /* 缓存损坏则忽略 */
}

function writeFilesCache(teacher, files) {
  try {
    sessionStorage.setItem('cp_files_' + teacher,
      JSON.stringify({ ts: Date.now(), files: files }));
  } catch (e) { /* 存不进缓存（如隐私模式）不影响使用 */ }
}

/* 读取某教师文件夹里的课件，返回 Promise<Array>
   每个元素：{ name 展示名, ext, size, badge, action, label }
   读取顺序：会话缓存 -> GitHub 接口 -> files.json 清单 -> jsDelivr 备用接口 -> 过期缓存兜底 */
function fetchTeacherFiles(teacher, force) {
  var cached = readFilesCache(teacher);
  if (!force && cached && (Date.now() - cached.ts) < CONFIG.apiCacheMs) {
    lastSource = 'cache';
    return Promise.resolve(cached.files);
  }

  var chain;
  if (force || !isApiDown()) {
    /* 正常路径：先走主通道；失败则依次降级 */
    chain = fetchFromGitHub(teacher).catch(function (firstErr) {
      markApiDown();
      return fetchFromManifest(teacher).catch(function () {
        return fetchFromJsdelivr(teacher).catch(function () {
          throw firstErr; /* 全失败时抛主通道错误，用于提示原因 */
        });
      });
    });
  } else {
    /* 主通道本会话已失败过：直接走清单/备用通道，避免等待超时 */
    chain = fetchFromManifest(teacher).catch(function () {
      return fetchFromJsdelivr(teacher).catch(function () {
        var e = new Error('all channels failed');
        e.code = 'net';
        throw e;
      });
    });
  }

  return chain
    .then(function (files) {
      writeFilesCache(teacher, files);
      return files;
    })
    .catch(function (err) {
      if (cached) { lastSource = 'cache-stale'; return cached.files; } /* 旧缓存兜底 */
      throw err;
    });
}

/* ==================== 通用渲染 ==================== */

/* 滚动显现（与 aaa.html 相同的入场动画） */
function initReveal() {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
}

/* 顶部导航：滚动后加下边框 */
function initNav() {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  function onScroll() {
    nav.classList.toggle('is-scrolled', (window.scrollY || window.pageYOffset) > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* 渲染教师列表行 */
function teacherRowHtml(teacher, index) {
  var n = String(index + 1);
  if (n.length < 2) n = '0' + n;
  return '<a class="teacher-row" href="space.html?t=' + teacher + '">' +
           '<div class="n">' + n + '</div>' +
           '<div><span class="acc">' + teacher + '</span>' +
             '<span class="role">Classroom</span></div>' +
           '<div class="arrow">&rarr;</div>' +
         '</a>';
}

/* 渲染课件列表行 */
function fileRowHtml(teacher, file) {
  var href = fileHref(teacher, file.name);
  var attrs = 'href="' + href + '"';
  if (file.action === 'play') {
    attrs += ' target="_blank" rel="noopener"';           /* html：新标签页播放 */
  } else {
    attrs += ' download="' + file.name.replace(/"/g, '') + '"'; /* 其余：直接下载 */
  }
  return '<a class="file-row" ' + attrs + '>' +
           '<div class="badge">' + file.badge + '</div>' +
           '<div class="f-info">' +
             '<div class="f-name">' + file.name + '</div>' +
             '<div class="f-meta">' + fmtSize(file.size) + '</div>' +
           '</div>' +
           '<div class="f-act">' + file.label + (file.action === 'play' ? ' &nearr;' : ' &darr;') + '</div>' +
         '</a>';
}

/* ==================== 页面：密码门 + 教师选择（index.html） ==================== */

function initGatePage() {
  var gateView = document.getElementById('gate-view');
  var selectView = document.getElementById('select-view');
  var form = document.getElementById('gate-form');
  var input = document.getElementById('gate-input');
  var error = document.getElementById('gate-error');
  var teacherList = document.getElementById('teacher-list');

  /* 解锁后要跳回的目标页（来自 space.html 的重定向，如 ?next=space.html%3Ft%3Dhw） */
  var pendingNext = null;
  var rawNext = new URLSearchParams(location.search).get('next');
  if (rawNext && rawNext.indexOf('space.html') === 0) pendingNext = rawNext;

  function showSelect() {
    gateView.classList.remove('is-active');
    selectView.classList.add('is-active');
    document.title = '普陀中学摄影社 · 选择教室';
  }

  function goNext() {
    if (pendingNext) { location.replace(pendingNext); return; }
    showSelect();
  }

  /* 渲染教师入口（来自 CONFIG.teachers，不信任任何外部输入） */
  var rows = CONFIG.teachers.map(teacherRowHtml).join('');
  teacherList.innerHTML = rows;

  /* 已解锁：直接进入选择页或跳回原目标 */
  if (isUnlocked()) { goNext(); return; }

  gateView.classList.add('is-active');
  document.title = '普陀中学摄影社 · 上课平台';
  input.focus();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (sha256Hex(value) === CONFIG.passwordHash) {
      unlock();
      goNext();
      return;
    }
    /* 密码错误：提示 + 抖动 + 清空重输 */
    input.value = '';
    input.classList.add('is-err', 'is-shaking');
    error.textContent = '密码不正确，请重试';
    input.focus();
    setTimeout(function () {
      input.classList.remove('is-shaking');
    }, 450);
  });

  input.addEventListener('input', function () {
    input.classList.remove('is-err');
    error.textContent = '';
  });
}

/* ==================== 页面：教师空间（space.html） ==================== */

function initSpacePage() {
  var teacher = new URLSearchParams(location.search).get('t');

  /* 非法或缺失教师参数 -> 回入口页 */
  if (CONFIG.teachers.indexOf(teacher) === -1) {
    location.replace('index.html');
    return;
  }

  /* 未输过密码 -> 回密码门，并记住要去的教室 */
  if (!isUnlocked()) {
    location.replace('index.html?next=' +
      encodeURIComponent('space.html?t=' + teacher));
    return;
  }

  /* 填充页面标题与品牌 */
  document.title = '普陀中学摄影社 · ' + teacher;
  var tEl = document.getElementById('space-teacher');
  var navT = document.getElementById('nav-teacher');
  if (tEl) tEl.textContent = teacher;
  if (navT) navT.textContent = teacher;

  var list = document.getElementById('file-list');
  var count = document.getElementById('file-count');
  var refreshBtn = document.getElementById('refresh-btn');

  function render(files) {
    list.classList.remove('is-loading');
    var src = srcLabel(); /* 数据源标注，如「· 文件清单」 */
    if (files.length === 0) {
      list.innerHTML =
        '<div class="state">' +
          '<div class="state-en">No Files Yet</div>' +
          '<div class="state-cn">暂无课件</div>' +
          '<div class="state-hint">把课件文件放进 ' + teacher + ' 文件夹并上传到 GitHub 后，<br>这里会自动出现。</div>' +
        '</div>';
      count.textContent = '0 个课件' + src;
      return;
    }
    list.innerHTML = files.map(function (f) {
      return fileRowHtml(teacher, f);
    }).join('');
    count.textContent = files.length + ' 个课件' + src;
  }

  function renderError(err) {
    list.classList.remove('is-loading');
    /* 按原因给出不同的提示文案 */
    var reason = (err && err.code === 'rate') ? 'rate' : 'net';
    var msg = reason === 'rate'
      ? '访问 GitHub 的次数超过限制（每小时 60 次），请过一会儿再试'
      : '无法连接课件文件接口，可能是网络问题';
    var ghLink = 'https://github.com/' + CONFIG.repo.owner + '/' + CONFIG.repo.name +
                 '/tree/' + CONFIG.branch + '/' + teacher;
    list.innerHTML =
      '<div class="state">' +
        '<div class="state-en">Something Went Wrong</div>' +
        '<div class="state-cn">课件列表读取失败：' + msg + '</div>' +
        '<div class="state-hint">可以点右上角「刷新」再试一次，或直接到<br>' +
          '<a class="state-link" href="' + ghLink + '" target="_blank" rel="noopener">GitHub 上的 ' + teacher + ' 文件夹</a>查看课件。</div>' +
      '</div>';
    count.textContent = '';
  }

  function load(force) {
    list.classList.add('is-loading');
    list.innerHTML =
      '<div class="state">' +
        '<div class="state-en">Loading</div>' +
        '<div class="state-cn">正在读取课件列表…</div>' +
      '</div>';
    fetchTeacherFiles(teacher, force).then(render).catch(renderError);
  }

  refreshBtn.addEventListener('click', function () { load(true); });

  load(false);
  initReveal();
}

/* ==================== 启动 ==================== */

if (typeof document !== 'undefined') {
  var page = document.body.getAttribute('data-page');
  initNav();
  if (page === 'gate') {
    initGatePage();
    initReveal();
  } else if (page === 'space') {
    initSpacePage();
  }
}
