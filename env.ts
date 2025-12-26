import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    ADMINS: z.string(),
    INERTIA_TOKEN: z.string(),
    INERTIA_URL: z.string().default('http://localhost:4000'),
    PARTYKIT_HOST: z.string().default('127.0.0.1:1999'),
    PARTYKIT_PUBLIC_URL: z.string().default('http://localhost:4000'),
    PARTYKIT_URL: z.url(),
    RACETIME_URL: z.url(),
    SIGNING_SECRET: z.string(),
    TOURNAMENT_SLUG: z.string(),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().default('http://localhost:4000'),
  },
  runtimeEnv: {
    ADMINS: process.env.ADMINS,
    INERTIA_TOKEN: process.env.INERTIA_TOKEN,
    INERTIA_URL: process.env.INERTIA_URL,
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    PARTYKIT_HOST: process.env.PARTYKIT_HOST,
    PARTYKIT_PUBLIC_URL: process.env.PUBLIC_URL,
    PARTYKIT_URL: process.env.PARTYKIT_URL,
    RACETIME_URL: process.env.RACETIME_URL,
    SIGNING_SECRET: process.env.SIGNING_SECRET,
    TOURNAMENT_SLUG: process.env.TOURNAMENT_SLUG,
  },
})
