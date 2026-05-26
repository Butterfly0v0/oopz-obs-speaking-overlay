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
- 根据成员标识稳定分配不同颜色。
- 头像从 OOPZ 本地临时缓存读取，并通过本地 `/api/avatar` 安全提供给浏览器源。
- 保留 `mock` 模式，方便没有打开 OOPZ 时预览界面。

## 快速启动

首次使用前，先安装 requirements。不熟悉终端命令的用户，直接双击：

```text
安装依赖.bat
```

如果系统对中文文件名兼容不好，也可以双击：

```text
install-requirements.bat
```

当前版本只使用 Python 标准库，`requirements.txt` 暂无第三方依赖；保留安装步骤是为了检查 Python/pip 环境并方便后续扩展。

也可以通过终端安装：

```powershell
python -m pip install -r .\requirements.txt
```

先打开 OOPZ 客户端，并开启 OOPZ 自带屏幕覆盖功能。

不熟悉终端命令的用户，直接双击：

```text
启动OOPZ OBS叠加层.bat
```

如果系统对中文文件名兼容不好，也可以双击：

```text
start-overlay.bat
```

也可以通过终端启动：

```powershell
cd .\oopz-obs-speaking-overlay
python .\backend\app.py
```

浏览器或 OBS 中打开：

```text
http://127.0.0.1:5173/overlay
```

## OBS 接入

1. 在 OBS 中添加“浏览器”源。
2. URL 填写 `http://127.0.0.1:5173/overlay`。
3. 建议初始尺寸使用 `800 x 220`，竖排布局可用 `320 x 600`。
4. 勾选“关闭源时关闭浏览器源”，方便刷新调试。
5. 页面背景默认透明，可直接叠到直播画面上。

## 配置

项目没有 `config.json` 时会自动读取 `config.example.json`，默认已经使用真实 OOPZ 覆盖层数据。需要自定义布局或端口时，再复制一份本地配置：

```powershell
Copy-Item .\config.example.json .\config.json
```

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
- `oopz.mode`：`oopz-local` 使用真实 OOPZ 覆盖层数据；`mock` 使用模拟数据。
- `oopzLocal.port`：OOPZ 本地覆盖层 WebSocket 端口，当前默认是 `10274`。

## 探测 OOPZ 数据

如果未来 OOPZ 更新后端口或消息结构变化，可以运行只读探测脚本：

```powershell
python .\backend\oopz_local_probe.py --seconds 12
```

运行时在 OOPZ 语音频道里说话，观察输出的 `talking` 是否变化。
