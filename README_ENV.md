# 环境变量配置说明

## Supabase URL 配置

根据你的运行环境，需要使用不同的 Supabase URL：

### 1. Android 模拟器
```bash
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
```
- `10.0.2.2` 是 Android 模拟器访问主机的特殊地址

### 2. iOS 模拟器 / 真实设备
```bash
EXPO_PUBLIC_SUPABASE_URL=http://192.168.50.68:54321
```
- 使用你的局域网 IP 地址
- 查看本机 IP：`ifconfig | grep "inet "`

### 3. 本机测试（Web/命令行）
```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```
- 仅用于本机直接访问

## 切换配置方法

### 方法1：直接修改 .env 文件
编辑 `.env` 文件，修改 `EXPO_PUBLIC_SUPABASE_URL` 的值

### 方法2：使用预设配置文件
```bash
# Android 模拟器
cp .env.android .env

# iOS/真机（需要先更新 .env 中的 IP）
# 已配置为: 192.168.50.68
```

### 方法3：启动时指定
```bash
# Android 模拟器
npx expo start --android

# iOS 模拟器
npx expo start --ios
```

## 注意事项

1. **防火墙设置**：确保 54321 端口未被防火墙阻止
2. **Supabase 服务**：确保 Supabase 本地服务正在运行
   ```bash
   npx supabase status
   npx supabase start  # 如果未运行
   ```
3. **清除缓存**：更改配置后建议清除缓存
   ```bash
   npx expo start --clear
   ```

## 当前配置

当前 `.env` 文件配置为：**iOS模拟器/真实设备** (192.168.50.68)

如需使用 Android 模拟器，请：
1. 复制配置：`cp .env.android .env`
2. 重启 Expo：`npx expo start --clear`