# OBS 设置

## 添加浏览器源

1. 打开 OOPZ 客户端，并开启 OOPZ 自带屏幕覆盖功能。
2. 启动本地服务：`python .\backend\app.py`。
3. 在 OBS 的来源中添加“浏览器”。
4. URL 填写 `http://127.0.0.1:5173/overlay`。
5. 建议初始尺寸使用 `800 x 220`。
6. 如果使用竖排布局，可以改为 `320 x 600`。

## 常见调整

在 `config.json` 中修改：

- 横排：`"layout": "horizontal"`
- 竖排：`"layout": "vertical"`
- 网格：`"layout": "grid"`
- 头像大小：`"avatarSize": 72`
- 待机暗度：`"dimOpacity": 0.34`
- 待机黑白程度：`"inactiveGrayscale": 0.7`，范围 `0` 到 `1`；`0` 保留原本颜色，`1` 为完全黑白
- 高亮缩放：`"highlightScale": 1.06`

修改配置后重启 `backend/app.py`，再刷新 OBS 浏览器源。

## 调试

浏览器中先访问 `http://127.0.0.1:5173/overlay`。如果页面提示等待 OOPZ 覆盖层数据，确认 OOPZ 客户端和自带覆盖层已经开启。

如果仍然没有数据，运行：

```powershell
python .\backend\oopz_local_probe.py --seconds 12
```

如果浏览器可见但 OBS 不可见，检查 OBS 浏览器源尺寸、URL 和本地防火墙设置。
