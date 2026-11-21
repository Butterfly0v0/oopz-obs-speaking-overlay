# OOPZ OBS Speaking Overlay

一个给 OBS Browser Source 使用的 OOPZ 语音叠加层。程序直接读取 OOPZ 自带屏幕覆盖层使用的本地 WebSocket 数据，不需要 OOPZ 凭证，也不做颜色识别。

## 工作方式

OOPZ 客户端会给它自己的覆盖层提供本地数据通道。当前探测到的默认地址是：

```text
ws://127.0.0.1:10274/
```

本程序会作为一个额外的只读客户端连接该 WebSocket，读取 `members` 消息里的 `name`、`avatar`、`talking` 和 `muted` 字段，再转换成 OBS 叠加层状态。

```json
{
  "cmd": "members",
  "voice": true,
  "members": [
    {
      "name": "ExampleUser",
      "avatar": "C:\\Users\\YourName\\AppData\\Local\\Temp\\oopz\\...\\avatar.webp.png",
      "talking": false,
      "muted": false
    }
  ]
}
```

## 当前能力

- 显示 OOPZ 当前语音频道成员的昵称和头像。
- 直接用 OOPZ 的 `talking` 字段高亮正在说话的人。
- 默认暗色显示，发言时头像、边框和名称底纹亮起。
- 发言时头像可上下浮动，幅度、周期、缓动可在编辑器中调节。
- 根据成员标识稳定分配不同颜色。
- 头像从 OOPZ 本地缓存读取，并通过本地 `/api/avatar` 安全提供给浏览器源。旧缓存位于临时目录的 `oopz`，新缓存位于 `%LOCALAPPDATA%\oopz_cache`。
- 保留 `mock` 模式，方便没有打开 OOPZ 时预览界面。
- 提供**可视化配置编辑器**，支持实时预览叠加层样式与多用户场景。
- 支持读取本机已安装字体，按字族选择 Regular / Bold / Light 等样式，并调节字号、字重、字距。
- 支持通过交互式 BAT 菜单修改配置，无需手动编辑 JSON。
- 启动脚本提供中文版与英文版，分别对应中文与英文提示信息。

## 快速启动

### 从 GitHub 获取

仓库地址：<https://github.com/Butterfly0v0/oopz-obs-speaking-overlay>

**方式一：Git 克隆（推荐）**

```powershell
git clone https://github.com/Butterfly0v0/oopz-obs-speaking-overlay.git
cd oopz-obs-speaking-overlay
```

**方式二：下载 Release ZIP（推荐给最终用户）**

1. 打开 [Releases](https://github.com/Butterfly0v0/oopz-obs-speaking-overlay/releases)。
2. 下载最新版本的 `oopz-obs-speaking-overlay-*.zip`。
3. 解压后进入文件夹即可使用。

**方式三：下载源码 ZIP**

1. 打开上方仓库链接。
2. 点击 **Code** → **Download ZIP**。
3. 解压 ZIP 文件，进入 `oopz-obs-speaking-overlay` 文件夹。

### 安装依赖

首次使用前，先安装 requirements。不熟悉终端命令的用户，直接双击：

```text
安装依赖.bat
```

如果系统对中文文件名兼容不好，也可以双击：

```text
install-requirements.bat
```

当前版本只使用 Python 标准库，`requirements.txt` 暂无第三方依赖。安装脚本会检查本机 Python：没有可用的 Python 3.10 或更高版本时，会从 python.org 自动安装 Python 3.14，只安装给当前用户。Windows 自带的 Python 占位程序不算已安装。

没有 Python 时，窗口会显示：

```text
未检测到可用的 Python。
正在下载并安装 Python 3.14，只安装给当前用户。
如果出现安装窗口，请等待它结束，不要点取消。
```

安装窗口出现后让它自己结束。点取消会导致安装失败。

也可以通过终端安装：

```powershell
python -m pip install -r .\requirements.txt
```

### 启动程序

先打开 OOPZ 客户端，并开启 OOPZ 自带屏幕覆盖功能。

不熟悉终端命令的用户，直接双击：

```text
启动OOPZ OBS叠加层.bat
```

如果系统对中文文件名兼容不好，也可以双击：

```text
start-overlay.bat
```

- `启动OOPZ OBS叠加层.bat`：启动提示为**中文**。
- `start-overlay.bat`：启动提示为**英文**。

启动时只检查 Python，不会自动安装。没有可用 Python 时，窗口会提示：

```text
未检测到可用的 Python。
请先启动「安装依赖.bat」。
```

也可以通过终端启动（需先进入项目目录）：

```powershell
python .\backend\app.py
```

### 打开叠加层

浏览器或 OBS 中打开：

```text
http://127.0.0.1:5173/overlay
```

可视化配置编辑器（需先启动服务）：

```text
http://127.0.0.1:5173/config
```

或双击 `打开配置编辑器.bat` / `open-config-editor.bat`。

## OBS 接入

1. 在 OBS 中添加「浏览器」源。
2. URL 填写 `http://127.0.0.1:5173/overlay`。
3. 建议初始尺寸使用 `800 x 220`，竖排布局可用 `320 x 600`。
4. 勾选「关闭源时关闭浏览器源」，方便刷新调试。
5. 页面背景默认透明，可直接叠到直播画面上。
6. 修改并保存配置后，如效果未刷新，可在 OBS 中刷新浏览器源。

## 配置

项目没有 `config.json` 时会自动读取 `config.example.json`，默认已经使用真实 OOPZ 覆盖层数据。需要自定义布局或端口时，再复制一份本地配置：

```powershell
Copy-Item .\config.example.json .\config.json
```

### 可视化配置编辑（推荐）

先启动叠加层服务，然后打开配置编辑器：

- 双击 `打开配置编辑器.bat`（或 `open-config-editor.bat`）
- 或在浏览器访问 `http://127.0.0.1:5173/config`

编辑器左侧可调节：

- **布局**：方向、头像尺寸
- **显示效果**：暗色透明度、非活动灰度、高亮缩放
- **说话浮动**：开关、浮动幅度、周期、缓动曲线
- **文字**：
  - 搜索并选择本机字体
  - 选择字体样式（Regular / Bold / Light / Medium / Italic 等，按该字族本机实际可用样式列出）
  - 昵称/ID 显示开关、字号、字重、字距、省略号
- **虚拟用户**：手动添加、编辑、删除测试用户，模拟多成员同屏
- **预览场景**：切换正在说话的用户，查看高亮与浮动效果

右侧 iframe 会**实时预览**修改结果。满意后点击「保存配置」，将叠加层样式与虚拟用户一并写入 `config.json`（`overlay` 与 `mock.users`）。

打开编辑器时会自动加载当前配置、本机字体列表与虚拟用户，无需手动改动即可看到预览。

### 命令行配置编辑

双击运行 `配置设置.bat`（或 `configure.bat`），可通过命令行菜单修改全部配置（含服务器、OOPZ 连接、Mock 用户等）。

输入对应编号即可修改，支持类型自动转换（布尔值、整数、浮点数、字符串）。

### 手动配置

默认关键配置：

```json
{
  "oopz": {
    "mode": "oopz-local"
  },
  "oopzLocal": {
    "host": "127.0.0.1",
    "port": 10274,
    "path": "/"
  }
}
```

常用配置：

- `overlay.layout`：`horizontal`、`vertical` 或 `grid`。
- `overlay.avatarSize`：头像尺寸。
- `overlay.dimOpacity`：无人说话时的暗色透明度。
- `overlay.inactiveGrayscale`：无人说话时的黑白程度，范围 `0` 到 `1`；`0` 保留原本颜色，`1` 为完全黑白。
- `overlay.highlightScale`：说话高亮时的缩放强度。
- `overlay.speakFloatEnabled`：是否启用说话时头像上下浮动。
- `overlay.speakFloatAmplitude`：浮动幅度（像素）。
- `overlay.speakFloatDuration`：浮动周期（秒）。
- `overlay.speakFloatEase`：浮动缓动，如 `ease-in-out` / `linear`。
- `overlay.fontFamily`：字体族名称（本机字体名，如 `Microsoft YaHei`）。
- `overlay.fontStyle`：字体样式，如 `Regular` / `Bold` / `Light`。
- `overlay.fontFace`：实际使用的字面全名（可由字体 + 样式自动推导）。
- `overlay.nameFontSize` / `overlay.idFontSize`：昵称 / ID 字号（像素）。
- `overlay.nameFontWeight` / `overlay.idFontWeight`：昵称 / ID 字重（`100`–`900`）。
- `overlay.nameLetterSpacing` / `overlay.idLetterSpacing`：昵称 / ID 字距（`em`）。
- `overlay.nameEllipsis`：`true` 昵称过长显示省略号，`false` 换行显示完整内容。
- `oopz.mode`：`oopz-local` 使用真实 OOPZ 覆盖层数据；`mock` 使用模拟数据。
- `oopzLocal.port`：OOPZ 本地覆盖层 WebSocket 端口，当前默认是 `10274`。

## 常用脚本

| 脚本 | 说明 |
| --- | --- |
| `启动OOPZ OBS叠加层.bat` | 启动服务（中文提示） |
| `start-overlay.bat` | 启动服务（英文提示） |
| `打开配置编辑器.bat` | 在浏览器打开可视化配置编辑器 |
| `open-config-editor.bat` | 同上（英文文件名） |
| `配置设置.bat` / `configure.bat` | 命令行交互式配置菜单 |
| `安装依赖.bat` / `install-requirements.bat` | 检查 Python，缺失时自动安装，然后安装依赖 |

## 探测 OOPZ 数据

如果未来 OOPZ 更新后端口或消息结构变化，可以运行只读探测脚本：

```powershell
python .\backend\oopz_local_probe.py --seconds 12
```

运行时在 OOPZ 语音频道里说话，观察输出的 `talking` 是否变化。

## 系统要求

- Windows（推荐；本机字体枚举优先使用 Windows 字体注册表）
- Python 3.10 或更高版本。未安装时，运行「安装依赖.bat」会自动安装 Python 3.14。程序只使用标准库，无需额外第三方包
- 已安装并开启屏幕覆盖的 OOPZ 客户端（真实数据模式）
