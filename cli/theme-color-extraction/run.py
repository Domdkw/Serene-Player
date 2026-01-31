#!/usr/bin/env python3
import json
import sys
import os
from pathlib import Path
from main import extract_cover_from_audio
from color_utils import extract_palette


def extract_theme_color_from_audio(audio_path, max_colors=1):
    try:
        temp_image_path = extract_cover_from_audio(audio_path, dev=False)
        palette = extract_palette(temp_image_path, {
            'maxColors': max_colors,
            'resolution': 100,
            'excludeBW': True,# 排除纯黑白颜色
            'interpolation': 'linear',
            'dev': False
        })
        
        if temp_image_path and os.path.exists(temp_image_path):
            os.remove(temp_image_path)
            temp_dir = Path(temp_image_path).parent
            if temp_dir.exists() and not list(temp_dir.iterdir()):
                temp_dir.rmdir()
        
        if palette and len(palette) > 0:
            return palette[0].hex
        return None
    except Exception as e:
        print(f'Error extracting theme color from {audio_path}: {e}', file=sys.stderr)
        return None


def process_disc_list(disc_list_path, music_dir, output_path):
    with open(disc_list_path, 'r', encoding='utf-8') as f:
        disc_list = json.load(f)
    
    music_dir = Path(music_dir).resolve()
    output_path = Path(output_path).resolve()
    
    updated_count = 0
    skipped_count = 0
    
    for server_name, songs in disc_list.items():
        if server_name == 'mirrors':
            continue
        
        print(f'\nProcessing server: {server_name}')
        print(f'Total songs: {len(songs)}')
        
        for i, song in enumerate(songs):
            song_name = song.get('name', 'Unknown')
            theme_color = song.get('themeColor', '').strip()
            
            if theme_color:
                skipped_count += 1
                print(f'[{i+1}/{len(songs)}] {song_name}: Already has theme color ({theme_color})')
                continue
            
            url = song.get('url', '')
            if not url:
                print(f'[{i+1}/{len(songs)}] {song_name}: No URL found')
                continue
            
            audio_filename = url.split('/')[-1]
            audio_path = music_dir / audio_filename
            
            if not audio_path.exists():
                print(f'[{i+1}/{len(songs)}] {song_name}: Audio file not found ({audio_path})')
                continue
            
            print(f'[{i+1}/{len(songs)}] {song_name}: Extracting theme color...')
            
            new_color = extract_theme_color_from_audio(str(audio_path))
            
            if new_color:
                song['themeColor'] = new_color
                updated_count += 1
                print(f'  -> Theme color extracted: {new_color}')
            else:
                print(f'  -> Failed to extract theme color')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(disc_list, f, ensure_ascii=False, indent=2)
    
    print(f'\n\n=== Summary ===')
    print(f'Total songs processed: {len(disc_list.get("This Server", []))}')
    print(f'Updated theme colors: {updated_count}')
    print(f'Skipped (already have theme color): {skipped_count}')
    print(f'Output saved to: {output_path}')


def main():
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent
    disc_list_path = project_root / 'public' / 'discList.json'
    music_dir = project_root / 'public' / 'music'
    output_path = project_root / 'public' / 'discList.json'
    
    print(f'Script directory: {script_dir}')
    print(f'Project root: {project_root}')
    print(f'Disc list path: {disc_list_path}')
    print(f'Music directory: {music_dir}')
    print(f'Output path: {output_path}')
    
    if not disc_list_path.exists():
        print(f'Error: discList.json not found at {disc_list_path}', file=sys.stderr)
        sys.exit(1)
    
    if not music_dir.exists():
        print(f'Error: Music directory not found at {music_dir}', file=sys.stderr)
        sys.exit(1)
    
    process_disc_list(str(disc_list_path), str(music_dir), str(output_path))


if __name__ == '__main__':
    main()
