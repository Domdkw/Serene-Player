// API from https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced
// Copyright © 2026 Domdkw -MIT License

import { Hono, Context } from 'hono'

export const musicRouter = new Hono()

musicRouter.get('/search', async (c) => {
    const keywords = c.req.query('keywords') || '';
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = parseInt(c.req.query('offset') || '0');
    const data = await fetch163(`/api/search/get?s=${keywords}&limit=${limit}&offset=${offset}&type=1`, c);
    return c.text(data);
})
musicRouter.get('/song/detail', async (c) => {
    const ids = c.req.query('ids') || '';
    const data = await fetch163(`/api/song/detail?ids=[${ids}]`, c);
    return c.text(data);
})
musicRouter.get('/lyric', async (c) => {
    const id = c.req.query('id') || '';
    const data = await fetch163(`/api/song/lyric?id=${id}&tv=-1&lv=-1&rv=-1&_nmclfl=1`, c);
    return c.text(data);
})
musicRouter.get('/search/hot', async (c) => {
    const data = await fetch163(`/api/search/hot`, c);
    return c.text(data);
})
musicRouter.get('/search/hot/detail', async (c) => {
    const data = await fetch163(`/api/hotsearchlist/get`, c);
    return c.text(data);
})
musicRouter.get('/artist/detail', async (c) => {
    const id = c.req.query('id') || '';
    const data = await fetch163(`/api/artist/head/info/get?id=${id}`, c);
    return c.text(data);
})
musicRouter.get('/search/suggest', async (c) => {
    const keywords = c.req.query('keywords') || '';
    const type = c.req.query('type') || 'mobile';
    const source = type == 'mobile' ? 'keyword' : 'web';
    const data = await fetch163(`/api/search/suggest/${source}?s=${keywords}`, c);
    return c.text(data);
})


const fetch163 = async (url: string, c: Context) => {
    const res = await fetch('https://music.163.com' + url, {
        method: 'GET',
        headers: {
            'Referer': 'https://music.163.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0',
            'Origin': 'https://music.163.com',
            'Accept': 'application/json, text/plain, */*',
        },
    });
    if(!res.ok) {
        c.status(res.status as any);
        return '';
    }
    const data = await res.text();
    return data;
}
