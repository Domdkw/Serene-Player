import json
import sys
from pathlib import Path

DEFAULT_MIRROR = "https://v6.gh-proxy.org/https://raw.githubusercontent.com/Domdkw/Serene-Player/refs/heads/main/public"

def generate_mirrors(disc_list_path, mirror_url, output_path):
    with open(disc_list_path, 'r', encoding='utf-8') as f:
        disc_list = json.load(f)
    
    mirrors_data = {"": []}
    
    for server_name, songs in disc_list.items():
        if server_name == 'mirrors':
            continue
        
        if not isinstance(songs, list):
            continue
        
        for song in songs:
            if not isinstance(song, dict):
                print(f"Warning: Invalid song format in {server_name}, skipping")
                continue
            
            url = song.get("url", "")
            if not url:
                print(f"Warning: Song missing URL in {server_name}, skipping")
                continue
            
            mirrored_song = {
                "name": song.get("name", "Unknown"),
                "artist": song.get("artist", "Unknown"),
                "themeColor": song.get("themeColor", "#ffffff")
            }
            
            if url.startswith("./music/"):
                filename = url.replace("./music/", "")
                mirrored_song["url"] = f"{mirror_url}/music/{filename}"
            else:
                mirrored_song["url"] = url
            
            mirrors_data[""].append(mirrored_song)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mirrors_data, f, ensure_ascii=False, indent=4)
    
    print(f"mirrors.json generated successfully at {output_path}")
    print(f"Mirror URL: {mirror_url}")
    
    disc_list["mirrors"] = {
        "link": f"{mirror_url}/mirrors.json"
    }
    
    with open(disc_list_path, 'w', encoding='utf-8') as f:
        json.dump(disc_list, f, ensure_ascii=False, indent=2)
    
    print(f"discList.json updated with mirrors link at {disc_list_path}")

def main():
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent
    disc_list_path = project_root / 'public' / 'discList.json'
    output_path = project_root / 'public' / 'mirrors.json'
    
    mirror_url = DEFAULT_MIRROR
    use_default = False
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'mirror':
            if len(sys.argv) > 2:
                mirror_url = sys.argv[2]
            else:
                use_default = True
        else:
            print("Usage: python main.py mirror [mirror_url]")
            print("If mirror_url is not provided, the default mirror will be used.")
            return
    else:
        use_default = True
    
    if use_default:
        print("WARNING: No mirror URL provided. Using default mirror.")
        print(f"Default mirror: {DEFAULT_MIRROR}")
        print()
    
    generate_mirrors(str(disc_list_path), mirror_url, str(output_path))

if __name__ == '__main__':
    main()
