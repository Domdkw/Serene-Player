// Copyright © 2026 Domdkw -MIT License

/// <reference types="@netlify/edge-functions" />

import { Hono } from 'hono'
import { handle } from 'hono/netlify'
import { cors } from 'hono/cors'
import { memCache } from 'hono-mem-cache'

import { musicRouter } from '../../functions/modules/music.ts'

const app = new Hono()
const api = app.basePath('/api')
api.route('/music', musicRouter)

api.use('/*', memCache({
    ttl: 60 * 5,
    max: 800,
}))
const ALLOWED_ORIGINS = [Netlify.env.get('URL'), 'http://localhost:3000']
api.use('/*', cors({
    origin: (origin) => {
        if (ALLOWED_ORIGINS.includes(origin)) {
            return origin
        }
        return 'localhost'
    },
    allowMethods: ['GET', 'OPTIONS'],
    credentials: true,
}))
api.use('/*', async (c, next) => {
    await next();
    if(c.res.status === 200) {
        c.res.headers.set('Cache-Control', 'public, max-age=300')
    }else{
        c.res.headers.set('Cache-Control', 'no-cache')
    }
})

export default handle(api)
