#!/usr/bin/env python3
import argparse
import os
import sys
import tempfile
from pathlib import Path
from mutagen import File
from mutagen.id3 import ID3NoHeaderError
from color_utils import extract_palette, hex_to_rgb, hex_to_rgba


def parse_args():
    parser = argparse.ArgumentParser(
        description='Extract color palette from images and audio files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  %(prog)s ./example/bg.jpg
  %(prog)s ./example/bg.jpg --precision 0.5 --unabw --colorsys hex --present
  %(prog)s ./example/song.mp3 --max 3 --colorsys rgb
        '''
    )
    
    parser.add_argument('image_path', help='Path to image or audio file')
    parser.add_argument('--precision', type=float, default=100,
                        help='Resolution size: 1 (no compression), >1 for pixel size, 0-1 for percentage (default: 100)')
    parser.add_argument('--unabw', action='store_true',
                        help='Exclude black and white colors')
    parser.add_argument('--colorsys', choices=['hex', 'rgb', 'rgba'], default='hex',
                        help='Color system: hex, rgb, rgba (default: hex)')
    parser.add_argument('--max', type=int, dest='max_colors', default=5,
                        help='Maximum number of colors (default: 5)')
    parser.add_argument('--present', action='store_true',
                        help='Show color percentage in the image')
    parser.add_argument('--interpolation', choices=['nearest', 'linear', 'cubic', 'lanczos'], default='linear',
                        help='Interpolation mode: nearest, linear, cubic, lanczos (default: linear)')
    parser.add_argument('--dev', action='store_true',
                        help='Enable detailed debug output')
    
    return parser.parse_args()


def format_color(color, color_sys, show_percentage):
    if color_sys == 'hex':
        color_value = color.hex
    elif color_sys == 'rgb':
        color_value = f"rgb({color.rgb['r']}, {color.rgb['g']}, {color.rgb['b']})"
    elif color_sys == 'rgba':
        color_value = f"rgba({color.rgb['r']}, {color.rgb['g']}, {color.rgb['b']}, 1)"
    else:
        color_value = color.hex
    
    if show_percentage:
        return f'{color_value} ({color.percentage}%)'
    return color_value


def extract_cover_from_audio(audio_path, dev=False):
    try:
        audio_file = File(audio_path)
    except Exception as e:
        raise Exception(f'Failed to parse audio file: {e}')
    
    if audio_file is None:
        raise Exception('Could not parse audio file')
    
    cover_data = None
    cover_format = 'image/jpeg'
    
    if hasattr(audio_file, 'pictures') and audio_file.pictures:
        cover_data = audio_file.pictures[0].data
        cover_format = audio_file.pictures[0].mime or 'image/jpeg'
    elif hasattr(audio_file, 'tags'):
        tags = audio_file.tags
        if tags:
            for key in tags:
                if key.startswith('APIC:'):
                    cover_data = tags[key].data
                    cover_format = tags[key].mime or 'image/jpeg'
                    break
    
    if cover_data is None:
        raise Exception('No cover image found in the audio file')
    
    temp_dir = Path(audio_path).parent / '.temp'
    temp_dir.mkdir(exist_ok=True)
    
    ext_map = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
    }
    ext = ext_map.get(cover_format, 'jpg')
    
    temp_image_path = temp_dir / f'cover_{os.getpid()}_{os.times()[4]}.{ext}'
    
    with open(temp_image_path, 'wb') as f:
        f.write(cover_data)
    
    return str(temp_image_path)


def main():
    args = parse_args()
    
    if not args.image_path:
        print('Error: Please provide an image or audio file path', file=sys.stderr)
        print('Usage: python main.py <file_path> [options]', file=sys.stderr)
        sys.exit(1)
    
    file_path = Path(args.image_path).resolve()
    
    if not file_path.exists():
        print(f'Error: File not found: {file_path}', file=sys.stderr)
        sys.exit(1)
    
    audio_extensions = {'.mp3', '.m4a', '.flac', '.ogg', '.wav', '.wma'}
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'}
    
    ext = file_path.suffix.lower()
    
    image_path = str(file_path)
    temp_image_path = None
    
    if ext in audio_extensions:
        try:
            if args.dev:
                print(f'Extracting cover from audio file: {file_path.name}')
            temp_image_path = extract_cover_from_audio(image_path, args.dev)
            image_path = temp_image_path
            if args.dev:
                print(f'Cover extracted successfully: {Path(temp_image_path).name}')
        except Exception as error:
            print(f'Error extracting cover: {error}', file=sys.stderr)
            sys.exit(1)
    elif ext not in image_extensions:
        print(f'Error: Unsupported file type: {ext}', file=sys.stderr)
        print('Supported file types: images (jpg, png, etc.) and audio files (mp3, m4a, flac, etc.)', file=sys.stderr)
        sys.exit(1)
    
    try:
        palette = extract_palette(image_path, {
            'maxColors': args.max_colors,
            'resolution': args.precision,
            'excludeBW': args.unabw,
            'interpolation': args.interpolation,
            'dev': args.dev
        })
        
        for color in palette:
            print(format_color(color, args.colorsys, args.present))
        
        if temp_image_path and os.path.exists(temp_image_path):
            os.remove(temp_image_path)
            temp_dir = Path(temp_image_path).parent
            if temp_dir.exists() and not list(temp_dir.iterdir()):
                temp_dir.rmdir()
    except Exception as error:
        print(f'Error extracting colors: {error}', file=sys.stderr)
        if temp_image_path and os.path.exists(temp_image_path):
            os.remove(temp_image_path)
        sys.exit(1)


if __name__ == '__main__':
    main()
