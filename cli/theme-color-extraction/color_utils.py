from typing import Dict, List, Optional, Tuple
from PIL import Image
import math


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return '#' + ''.join(f'{x:02x}' for x in [r, g, b])


def hex_to_rgb(hex_color: str) -> str:
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    return f'rgb({r}, {g}, {b})'


def hex_to_rgba(hex_color: str, alpha: float = 1.0) -> str:
    r = int(hex_color[1:3], 16)
    g = int(hex_color[3:5], 16)
    b = int(hex_color[5:7], 16)
    return f'rgba({r}, {g}, {b}, {alpha})'


class ColorPalette:
    def __init__(self, hex_color: str, rgb: Tuple[int, int, int], count: int, percentage: int):
        self.hex = hex_color
        self.rgb = {'r': rgb[0], 'g': rgb[1], 'b': rgb[2]}
        self.count = count
        self.percentage = percentage


def extract_palette(image_path: str, options: Optional[Dict] = None) -> List[ColorPalette]:
    if options is None:
        options = {}
    
    max_colors = options.get('maxColors', 5)
    resolution = options.get('resolution', 100)
    exclude_bw = options.get('excludeBW', False)
    interpolation = options.get('interpolation', 'linear')
    dev = options.get('dev', False)
    
    interpolation_map = {
        'nearest': Image.NEAREST,
        'linear': Image.BILINEAR,
        'cubic': Image.BICUBIC,
        'lanczos': Image.LANCZOS
    }
    
    img = Image.open(image_path)
    original_width, original_height = img.size
    
    if dev:
        print('=== 调试信息 ===')
        print(f'图片路径: {image_path}')
        print(f'原始尺寸: {original_width} x {original_height}')
        print(f'分辨率参数: {resolution}')
        print(f'最大颜色数: {max_colors}')
        print(f'排除黑白: {exclude_bw}')
        print(f'插值模式: {interpolation}')
    
    if resolution == 1:
        width, height = original_width, original_height
        if dev:
            print(f'缩放模式: 保持原始尺寸 ({width} x {height})')
    elif resolution > 1:
        size = resolution
        if original_width > original_height:
            width = size
            height = int(round((original_height / original_width) * size))
        else:
            height = size
            width = int(round((original_width / original_height) * size))
        if dev:
            print(f'缩放模式: 固定尺寸模式 ({width} x {height})')
    else:
        scale = resolution
        width = max(1, int(round(original_width * scale)))
        height = max(1, int(round(original_height * scale)))
        if dev:
            print(f'缩放模式: 比例缩放模式 ({(scale * 100):.1f}%)')
            print(f'缩放后尺寸: {width} x {height}')
    
    resample = interpolation_map.get(interpolation, Image.BILINEAR)
    img = img.resize((width, height), resample)
    
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    pixels = list(img.getdata())
    
    if dev:
        print(f'处理后的尺寸: {width} x {height}')
        print(f'像素总数: {width * height}')
        print(f'数据长度: {len(pixels) * 4} bytes')
    
    color_counts: Dict[str, Dict] = {}
    total_valid_pixels = 0
    transparent_pixels = 0
    excluded_bw_pixels = 0
    bw_near_colors = set()
    
    factor = 12
    
    for r, g, b, a in pixels:
        if a < 128:
            transparent_pixels += 1
            continue
        
        qr = int(round(r / factor)) * factor
        qg = int(round(g / factor)) * factor
        qb = int(round(b / factor)) * factor
        key = f'{qr},{qg},{qb}'
        
        is_bw_near_color = (r + g + b < 60) or (r + g + b > 710) or (max(r, g, b) - min(r, g, b) < 15)
        
        if exclude_bw:
            if is_bw_near_color:
                excluded_bw_pixels += 1
                continue
        else:
            if is_bw_near_color:
                bw_near_colors.add(key)
        
        if key not in color_counts:
            color_counts[key] = {'r': qr, 'g': qg, 'b': qb, 'count': 0}
        color_counts[key]['count'] += 1
        total_valid_pixels += 1
    
    sorted_colors = sorted(color_counts.values(), key=lambda x: x['count'], reverse=True)
    
    if dev:
        print(f'\n=== 颜色统计 ===')
        print(f'总像素数: {width * height}')
        print(f'透明像素: {transparent_pixels}')
        print(f'排除的黑白像素: {excluded_bw_pixels}')
        print(f'有效像素: {total_valid_pixels}')
        print(f'量化后的颜色数量: {len(sorted_colors)}')
        print(f'\n=== 前10个颜色（按出现次数）===')
        for i, c in enumerate(sorted_colors[:10]):
            key = f"{c['r']},{c['g']},{c['b']}"
            is_bw_near = key in bw_near_colors
            bw_label = ' (黑白临近色)' if is_bw_near else ''
            print(f"{i + 1}. {rgb_to_hex(c['r'], c['g'], c['b'])} - 出现 {c['count']} 次 ({int(round((c['count'] / total_valid_pixels) * 100))}%){bw_label}")
    
    final_palette = []
    skipped_similar = 0
    
    for c in sorted_colors:
        if len(final_palette) >= max_colors:
            break
        
        is_too_similar = False
        for existing in final_palette:
            dr = existing.rgb['r'] - c['r']
            dg = existing.rgb['g'] - c['g']
            db = existing.rgb['b'] - c['b']
            distance = math.sqrt(dr * dr + dg * dg + db * db)
            if distance < 45:
                is_too_similar = True
                break
        
        if not is_too_similar:
            final_palette.append(ColorPalette(
                hex_color=rgb_to_hex(c['r'], c['g'], c['b']),
                rgb=(c['r'], c['g'], c['b']),
                count=c['count'],
                percentage=int(round((c['count'] / total_valid_pixels) * 100))
            ))
        else:
            skipped_similar += 1
    
    if dev:
        print(f'\n=== 最终结果 ===')
        print(f'跳过的相似颜色: {skipped_similar}')
        print(f'最终提取颜色数: {len(final_palette)}')
        for i, c in enumerate(final_palette):
            print(f"{i + 1}. {c.hex} - RGB({c.rgb['r']}, {c.rgb['g']}, {c.rgb['b']}) - {c.percentage}%")
        print('=== 调试结束 ===\n')
    
    if len(final_palette) == 0 and len(sorted_colors) > 0:
        for c in sorted_colors[:max_colors]:
            final_palette.append(ColorPalette(
                hex_color=rgb_to_hex(c['r'], c['g'], c['b']),
                rgb=(c['r'], c['g'], c['b']),
                count=c['count'],
                percentage=int(round((c['count'] / total_valid_pixels) * 100))
            ))
    
    return final_palette
