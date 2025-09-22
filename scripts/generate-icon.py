#!/usr/bin/env python3
"""
生成应用图标
智慧河道巡查系统 - River Patrol System
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_app_icon(size):
    """创建应用图标"""
    # 创建一个带透明背景的图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 计算缩放比例
    scale = size / 1024
    
    # 绘制背景圆形 - 蓝色 #3B82F6
    margin = int(74 * scale)  # 留边距
    circle_bbox = [margin, margin, size - margin, size - margin]
    draw.ellipse(circle_bbox, fill=(59, 130, 246, 255))
    
    # 绘制水波纹 - 使用三条曲线
    wave_color = (255, 255, 255, 200)  # 白色半透明
    
    # 第一条波浪线
    wave_y1 = int(size * 0.45)
    wave_points1 = []
    for x in range(margin + 50, size - margin - 50, 10):
        y = wave_y1 + int(20 * scale * ((x - margin - 50) % 100) / 50)
        if x - margin - 50 < (size - 2 * margin - 100) / 3:
            y = wave_y1 - int(30 * scale)
        elif x - margin - 50 < 2 * (size - 2 * margin - 100) / 3:
            y = wave_y1 + int(30 * scale)
        wave_points1.append((x, y))
    
    if len(wave_points1) > 1:
        draw.line(wave_points1, fill=wave_color, width=int(30 * scale))
    
    # 第二条波浪线
    wave_y2 = int(size * 0.55)
    wave_points2 = []
    for x in range(margin + 50, size - margin - 50, 10):
        y = wave_y2 + int(15 * scale * ((x - margin - 50) % 80) / 40)
        if (x - margin - 50) % 160 < 80:
            y = wave_y2 - int(25 * scale)
        else:
            y = wave_y2 + int(25 * scale)
        wave_points2.append((x, y))
    
    if len(wave_points2) > 1:
        draw.line(wave_points2, fill=(255, 255, 255, 150), width=int(25 * scale))
    
    # 第三条波浪线
    wave_y3 = int(size * 0.65)
    wave_points3 = []
    for x in range(margin + 80, size - margin - 80, 10):
        y = wave_y3 + int(10 * scale * ((x - margin - 80) % 60) / 30)
        if (x - margin - 80) % 120 < 60:
            y = wave_y3 - int(20 * scale)
        else:
            y = wave_y3 + int(20 * scale)
        wave_points3.append((x, y))
    
    if len(wave_points3) > 1:
        draw.line(wave_points3, fill=(255, 255, 255, 100), width=int(20 * scale))
    
    # 绘制中心白色圆形
    center_size = int(120 * scale)
    center_x = size // 2
    center_y = int(size * 0.35)
    center_bbox = [
        center_x - center_size // 2,
        center_y - center_size // 2,
        center_x + center_size // 2,
        center_y + center_size // 2
    ]
    draw.ellipse(center_bbox, fill=(255, 255, 255, 230))
    
    # 绘制定位图标（简化版）
    pin_size = int(60 * scale)
    pin_x = center_x
    pin_y = center_y
    
    # 绘制定位针主体
    pin_bbox = [
        pin_x - pin_size // 4,
        pin_y - pin_size // 3,
        pin_x + pin_size // 4,
        pin_y + pin_size // 3
    ]
    draw.ellipse(pin_bbox, fill=(59, 130, 246, 255))
    
    # 绘制定位针内圆
    inner_size = int(15 * scale)
    inner_bbox = [
        pin_x - inner_size // 2,
        pin_y - inner_size // 2,
        pin_x + inner_size // 2,
        pin_y + inner_size // 2
    ]
    draw.ellipse(inner_bbox, fill=(255, 255, 255, 255))
    
    # 添加文字（如果尺寸足够大）
    if size >= 256:
        try:
            # 尝试使用系统字体
            font_size = int(48 * scale)
            # 尝试不同的字体路径
            font_paths = [
                '/System/Library/Fonts/PingFang.ttc',
                '/System/Library/Fonts/STHeiti Light.ttc',
                '/Library/Fonts/Arial Unicode.ttf',
                '/System/Library/Fonts/Helvetica.ttc'
            ]
            
            font = None
            for font_path in font_paths:
                if os.path.exists(font_path):
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        break
                    except:
                        continue
            
            if font:
                text = "智慧河道"
                text_bbox = draw.textbbox((0, 0), text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_x = (size - text_width) // 2
                text_y = int(size * 0.75)
                
                # 绘制文字背景
                bg_padding = int(20 * scale)
                bg_bbox = [
                    text_x - bg_padding,
                    text_y - bg_padding,
                    text_x + text_width + bg_padding,
                    text_y + font_size + bg_padding
                ]
                draw.rounded_rectangle(bg_bbox, radius=int(15 * scale), fill=(255, 255, 255, 230))
                
                # 绘制文字
                draw.text((text_x, text_y), text, fill=(59, 130, 246, 255), font=font)
        except Exception as e:
            print(f"无法添加文字: {e}")
    
    return img

def main():
    """主函数"""
    # 定义需要生成的尺寸
    sizes = {
        'icon.png': 1024,
        'adaptive-icon.png': 1024,
        'splash-icon.png': 400,
        'favicon.png': 48
    }
    
    # 确保输出目录存在
    output_dir = '/Users/liuzejin/chengyi/project/smart-river-patrol/RiverPatrol/assets/images'
    
    for filename, size in sizes.items():
        output_path = os.path.join(output_dir, filename)
        print(f"生成 {filename} ({size}x{size})...")
        
        # 创建图标
        icon = create_app_icon(size)
        
        # 保存图标
        icon.save(output_path, 'PNG')
        print(f"已保存到 {output_path}")
    
    print("\n所有图标生成完成！")
    print("请运行 'npx expo prebuild --clean' 以应用新图标")

if __name__ == '__main__':
    main()