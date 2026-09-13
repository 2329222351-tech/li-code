// Nitro server route - GET /api/ping
// Nuxt/Nitro auto-imports this from server/api/

import { createLogger } from '../utils/logger'

const log = createLogger('ping')

export default defineEventHandler(() => {
  log.debug('ping')
  return {
    ok: true,
    message: 'pong',
    time: new Date().toISOString(),
  }
})
