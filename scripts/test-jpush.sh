#!/bin/bash

echo "🔍 极光推送配置验证"
echo "===================="

# 检查环境变量
echo "1. 检查环境配置..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local 文件存在"
    grep "JPUSH_APP_KEY" .env.local > /dev/null && echo "✅ AppKey已配置" || echo "❌ AppKey未配置"
else
    echo "❌ .env.local 文件不存在"
fi

# 检查npm包
echo ""
echo "2. 检查npm依赖..."
if grep -q "jpush-react-native" package.json; then
    echo "✅ jpush-react-native 已安装"
else
    echo "❌ jpush-react-native 未安装"
fi

if grep -q "jcore-react-native" package.json; then
    echo "✅ jcore-react-native 已安装"
else
    echo "❌ jcore-react-native 未安装"
fi

# 检查Android配置
echo ""
echo "3. 检查Android配置..."
if [ -f "android/app/src/main/AndroidManifest.xml" ]; then
    grep -q "JPUSH_APPKEY" android/app/src/main/AndroidManifest.xml && echo "✅ Android已配置" || echo "❌ Android未配置"
else
    echo "⚠️  Android原生代码未生成"
fi

# 检查iOS配置
echo ""
echo "4. 检查iOS配置..."
if [ -f "ios/RiverPatrol/Info.plist" ]; then
    grep -q "JPushAppKey" ios/RiverPatrol/Info.plist && echo "✅ iOS已配置" || echo "❌ iOS未配置"
else
    echo "⚠️  iOS原生代码未生成"
fi

echo ""
echo "===================="
echo "配置状态总结："
echo ""

# 判断是否需要执行prebuild
if [ ! -d "android" ] && [ ! -d "ios" ]; then
    echo "❌ 需要先生成原生代码："
    echo "   运行: npx expo prebuild"
    echo "   然后: node scripts/setup-jpush.js"
else
    echo "✅ 原生代码已生成"
    echo ""
    echo "下一步操作："
    echo "1. 运行配置脚本: node scripts/setup-jpush.js"
    echo "2. 启动应用测试: npx expo run:android 或 npx expo run:ios"
fi