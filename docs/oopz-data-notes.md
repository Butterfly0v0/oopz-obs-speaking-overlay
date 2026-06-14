# OOPZ 本地覆盖层数据说明

## 数据来源

OOPZ 自带屏幕覆盖层使用本地 WebSocket 接收成员状态。当前探测到的地址是：

```text
ws://127.0.0.1:10274/
```

本项目只读连接这个地址，监听 OOPZ 推送的 `members` 消息，并把 `talking` 字段映射为 OBS 叠加层的 `speaking`。

显示层支持通过 `overlay.inactiveGrayscale` 自定义成员未说话时的黑白程度，范围 `0` 到 `1`；`0` 保留原本颜色，`1` 为完全黑白。

## 消息结构

当前观测到的消息示例：

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

字段含义：

- `voice`：当前是否处于语音频道相关状态。
- `members`：OOPZ 覆盖层显示的成员列表。
- `name`：显示名。
- `avatar`：本地头像缓存路径。
- `talking`：是否正在说话。
- `muted`：是否静音。

## 探测命令

```powershell
python .\backend\oopz_local_probe.py --seconds 12
```

如果 OOPZ 更新导致无法显示真实状态，先运行这个命令确认端口和消息字段是否变化。
