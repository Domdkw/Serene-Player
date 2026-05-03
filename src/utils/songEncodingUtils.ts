/**
 * 编码工具函数
 * 用于处理歌曲ID列表的压缩和解压缩
 */

/**
 * 分享的歌曲信息接口
 */
export interface SharedSong {
  id: number;
  name: string;
  artist: string;
}

/**
 * 将数字数组压缩为base64字符串
 * 使用差值编码来减少数据大小
 * @param ids 歌曲ID数组
 * @returns base64编码的字符串
 */
export function compressIdsToBase64(ids: number[]): string {
  if (!ids || ids.length === 0) {
    return '';
  }

  const sortedIds = [...ids].sort((a, b) => a - b);

  const deltas: number[] = [sortedIds[0]];
  for (let i = 1; i < sortedIds.length; i++) {
    deltas.push(sortedIds[i] - sortedIds[i - 1]);
  }

  const jsonStr = JSON.stringify(deltas);

  const utf8Bytes = new TextEncoder().encode(jsonStr);

  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }

  return btoa(binary);
}

/**
 * 从base64字符串解压缩为数字数组
 * @param base64Str base64编码的字符串
 * @returns 歌曲ID数组
 */
export function decompressBase64ToIds(base64Str: string): number[] {
  if (!base64Str || base64Str.trim() === '') {
    return [];
  }

  try {
    const binary = atob(base64Str);

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const jsonStr = new TextDecoder().decode(bytes);

    const deltas: number[] = JSON.parse(jsonStr);

    if (!Array.isArray(deltas) || deltas.length === 0) {
      return [];
    }

    const ids: number[] = [deltas[0]];
    for (let i = 1; i < deltas.length; i++) {
      ids.push(ids[i - 1] + deltas[i]);
    }

    return ids;
  } catch (error) {
    console.error('解压缩base64失败:', error);
    return [];
  }
}

/**
 * 将歌曲信息数组压缩为base64字符串
 * 包含ID、名称、艺术家信息
 * @param songs 歌曲信息数组
 * @returns base64编码的字符串
 */
export function compressSongsToBase64(songs: Array<{ id: number; name: string; artist: string }>): string {
  if (!songs || songs.length === 0) {
    return '';
  }

  const simplifiedSongs = songs.map(song => ({
    i: song.id,
    n: song.name,
    a: song.artist
  }));

  const jsonStr = JSON.stringify(simplifiedSongs);

  const utf8Bytes = new TextEncoder().encode(jsonStr);

  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }

  return btoa(binary);
}

/**
 * 从base64字符串解压缩为歌曲信息数组
 * @param base64Str base64编码的字符串
 * @returns 歌曲信息数组
 */
export function decompressBase64ToSongs(base64Str: string): Array<{ id: number; name: string; artist: string }> {
  if (!base64Str || base64Str.trim() === '') {
    return [];
  }

  try {
    const binary = atob(base64Str);

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const jsonStr = new TextDecoder().decode(bytes);

    const simplifiedSongs = JSON.parse(jsonStr);

    if (!Array.isArray(simplifiedSongs)) {
      return [];
    }

    return simplifiedSongs.map((song: any) => ({
      id: song.i,
      name: song.n,
      artist: song.a
    }));
  } catch (error) {
    console.error('解压缩歌曲信息失败:', error);
    return [];
  }
}
