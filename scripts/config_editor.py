import json
import os
import sys

CONFIG_FILE = "config.json"

MENU_GROUPS = [
    ("服务器设置", [
        ("server.host", "服务器地址"),
        ("server.port", "服务器端口"),
    ]),
    ("叠加层样式", [
        ("overlay.title", "叠加层标题"),
        ("overlay.layout", "布局方向 [horizontal / vertical / grid]"),
        ("overlay.avatarSize", "头像尺寸 (像素)"),
        ("overlay.dimOpacity", "暗色透明度 (0.0 ~ 1.0)"),
        ("overlay.inactiveGrayscale", "非活动灰度 (0.0 ~ 1.0)"),
        ("overlay.highlightScale", "高亮缩放 (如 1.06)"),
        ("overlay.showIds", "显示ID [true / false]"),
        ("overlay.showDisplayNames", "显示昵称 [true / false]"),
        ("overlay.idFontSize", "ID字体大小 (像素)"),
        ("overlay.nameFontSize", "昵称字体大小 (像素)"),
        ("overlay.nameEllipsis", "昵称过长用省略号 [true / false]"),
    ]),
    ("OOPZ 连接", [
        ("oopz.mode", "数据源模式 [oopz-local / mock]"),
        ("oopzLocal.host", "OOPZ本地地址"),
        ("oopzLocal.port", "OOPZ本地端口"),
        ("oopzLocal.path", "OOPZ本地路径"),
        ("oopzLocal.reconnectDelaySeconds", "重连延迟秒数"),
    ]),
    ("Mock 设置", [
        ("mock.speakingIntervalMs", "说话切换间隔 (毫秒)"),
    ]),
]

VALIDATORS = {
    "overlay.layout": lambda v: v if v in ("horizontal", "vertical", "grid") else None,
    "oopz.mode": lambda v: v if v in ("oopz-local", "mock") else None,
}


def load_config():
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get_value(cfg, key_path):
    parts = key_path.split(".")
    node = cfg
    for p in parts:
        if isinstance(node, dict) and p in node:
            node = node[p]
        else:
            return None
    return node


def set_value(cfg, key_path, value):
    parts = key_path.split(".")
    node = cfg
    for p in parts[:-1]:
        if p not in node or not isinstance(node[p], dict):
            node[p] = {}
        node = node[p]
    node[parts[-1]] = value


def try_parse(value, original):
    if isinstance(original, bool):
        if value.lower() in ("true", "1", "yes", "y"):
            return True
        elif value.lower() in ("false", "0", "no", "n"):
            return False
        else:
            return original
    if isinstance(original, int):
        try:
            return int(value)
        except ValueError:
            return original
    if isinstance(original, float):
        try:
            return float(value)
        except ValueError:
            return original
    return value


def validate(key, value):
    fn = VALIDATORS.get(key)
    if fn:
        result = fn(value)
        if result is None:
            allowed = {
                "overlay.layout": "horizontal / vertical / grid",
                "oopz.mode": "oopz-local / mock",
            }
            raise ValueError("无效值。允许的值: " + allowed.get(key, "未知"))
        return result
    return value


def edit_menu_item(cfg, key, label):
    current = get_value(cfg, key)
    print(f"  当前 [{label}] 值: {current}")
    new_val = input("  请输入新值 (直接回车取消): ").strip()
    if new_val == "":
        print("  已取消。")
        input("  按回车继续...")
        return False
    try:
        parsed = try_parse(new_val, current)
        parsed = validate(key, parsed)
    except ValueError as exc:
        print(f"  输入错误: {exc}")
        input("  按回车继续...")
        return False
    set_value(cfg, key, parsed)
    save_config(cfg)
    print(f"  成功更新 [{label}]: {current} → {parsed}")
    input("  按回车继续...")
    return True


def list_mock_users(cfg):
    users = get_value(cfg, "mock.users") or []
    if not users:
        print("  (当前没有模拟用户)")
    else:
        for idx, user in enumerate(users, 1):
            name = user.get("displayName") or user.get("id") or f"User {idx}"
            avatar = user.get("avatarUrl", "")
            avatar_info = f" [头像: {avatar}]" if avatar else ""
            print(f"  {idx}. {name} (id={user.get('id', '')}){avatar_info}")
    return users


def mock_users_menu(cfg):
    while True:
        os.system("cls" if os.name == "nt" else "clear")
        print("=" * 50)
        print("  Mock 用户管理")
        print("=" * 50)
        users = list_mock_users(cfg)
        print("-" * 50)
        print("  1. 添加用户")
        print("  2. 删除用户")
        print("  3. 修改用户")
        print("  0. 返回上级菜单")
        print("=" * 50)
        choice = input("  请输入编号: ").strip()
        if choice == "0":
            break
        if choice == "1":
            user_id = input("  用户ID: ").strip()
            if not user_id:
                print("  ID 不能为空。")
                input("  按回车继续...")
                continue
            display = input("  显示昵称 (回车使用ID): ").strip()
            avatar = input("  头像URL (回车留空): ").strip()
            users.append({"id": user_id, "displayName": display or user_id, "avatarUrl": avatar})
            set_value(cfg, "mock.users", users)
            save_config(cfg)
            print("  添加成功。")
            input("  按回车继续...")
        elif choice == "2":
            if not users:
                print("  没有可删除的用户。")
                input("  按回车继续...")
                continue
            idx_str = input("  要删除的用户编号: ").strip()
            if not idx_str.isdigit() or not (1 <= int(idx_str) <= len(users)):
                print("  无效编号。")
                input("  按回车继续...")
                continue
            removed = users.pop(int(idx_str) - 1)
            set_value(cfg, "mock.users", users)
            save_config(cfg)
            print(f"  已删除: {removed.get('displayName') or removed.get('id', '')}")
            input("  按回车继续...")
        elif choice == "3":
            if not users:
                print("  没有可修改的用户。")
                input("  按回车继续...")
                continue
            idx_str = input("  要修改的用户编号: ").strip()
            if not idx_str.isdigit() or not (1 <= int(idx_str) <= len(users)):
                print("  无效编号。")
                input("  按回车继续...")
                continue
            user = users[int(idx_str) - 1]
            print(f"  当前ID: {user.get('id', '')}")
            new_id = input("  新ID (回车保持不变): ").strip()
            if new_id:
                user["id"] = new_id
            print(f"  当前昵称: {user.get('displayName', '')}")
            new_name = input("  新昵称 (回车保持不变): ").strip()
            if new_name:
                user["displayName"] = new_name
            print(f"  当前头像URL: {user.get('avatarUrl', '')}")
            new_avatar = input("  新头像URL (回车保持不变): ").strip()
            if new_avatar:
                user["avatarUrl"] = new_avatar
            set_value(cfg, "mock.users", users)
            save_config(cfg)
            print("  修改成功。")
            input("  按回车继续...")
        else:
            print("  无效输入。")
            input("  按回车继续...")


def main():
    while True:
        cfg = load_config()
        os.system("cls" if os.name == "nt" else "clear")
        print("=" * 50)
        print("  OOPZ OBS Speaking Overlay 配置菜单")
        print("=" * 50)
        idx = 1
        item_map = {}
        for group_name, items in MENU_GROUPS:
            print(f"\n  [{group_name}]")
            for key, label in items:
                val = get_value(cfg, key)
                print(f"    {idx:2d}. {label:40s} 当前值: {val}")
                item_map[str(idx)] = (key, label)
                idx += 1
        print("\n  [其他]")
        print(f"    {idx:2d}. Mock 用户管理 (添加/删除/修改模拟用户)")
        item_map[str(idx)] = ("__mock_users__", "Mock 用户管理")
        idx += 1
        print(f"    {idx:2d}. 退出")
        item_map[str(idx)] = ("__exit__", "退出")
        print("=" * 50)
        choice = input("  请输入编号: ").strip()
        if choice == str(idx) or choice == "0":
            print("  已退出。")
            break
        if choice not in item_map:
            print("  无效输入，请按回车继续...")
            input()
            continue
        key, label = item_map[choice]
        if key == "__exit__":
            print("  已退出。")
            break
        if key == "__mock_users__":
            mock_users_menu(cfg)
            continue
        edit_menu_item(cfg, key, label)


if __name__ == "__main__":
    main()
