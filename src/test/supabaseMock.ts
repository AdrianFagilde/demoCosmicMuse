/* eslint-disable @typescript-eslint/no-explicit-any */
export type SupabaseResult = { data?: any; error?: any; count?: number }

export type SupabaseCall = { table: string; method: string; args: any[] }

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'containedBy',
  'range',
  'order',
  'limit',
  'or',
  'not',
  'filter',
  'match',
  'single',
  'maybeSingle',
] as const

const defaultStorage = () => ({
  upload: { data: { path: 'uploaded' }, error: null } as SupabaseResult,
  remove: { data: [], error: null } as SupabaseResult,
  createSignedUrl: { data: { signedUrl: 'signed-url' }, error: null } as SupabaseResult,
})

export function createSupabaseMock() {
  const calls: SupabaseCall[] = []
  const queues = new Map<string, SupabaseResult[]>()
  let storageConfig = defaultStorage()
  let session: { user: { id: string } } | null = null

  const record = (table: string, method: string, args: any[]) => {
    calls.push({ table, method, args })
  }

  // Devuelve el siguiente resultado de la tabla. Con un solo resultado encolado
  // se reutiliza siempre (cómodo para tests de un único fetch); con varios se
  // van consumiendo en orden.
  const nextResult = (table: string): SupabaseResult => {
    const q = queues.get(table)
    if (!q || q.length === 0) return { data: null, error: null }
    if (q.length > 1) return q.shift() as SupabaseResult
    return q[0] as SupabaseResult
  }

  const makeBuilder = (table: string) => {
    const builder: any = {}
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: any[]) => {
        record(table, method, args)
        return builder
      }
    }
    builder.then = (onFulfilled?: any, onRejected?: any) =>
      Promise.resolve(nextResult(table)).then(onFulfilled, onRejected)
    builder.catch = (onRejected?: any) => Promise.resolve(nextResult(table)).catch(onRejected)
    builder.finally = (fn?: any) => Promise.resolve(nextResult(table)).finally(fn)
    return builder
  }

  const client = {
    from: (table: string) => {
      record(table, 'from', [])
      return makeBuilder(table)
    },
    rpc: (fn: string, args?: unknown) => {
      record('rpc', fn, [args])
      return Promise.resolve(nextResult(`rpc:${fn}`))
    },
    channel: (name: string) => {
      record('realtime', 'channel', [name])
      const channel: any = {
        on: (...args: any[]) => {
          record('realtime', 'on', args)
          return channel
        },
        subscribe: (...args: any[]) => {
          record('realtime', 'subscribe', args)
          return channel
        },
      }
      return channel
    },
    removeChannel: (channel: unknown) => {
      record('realtime', 'removeChannel', [channel])
      return Promise.resolve('ok')
    },
    auth: {
      getSession: async () => {
        record('auth', 'getSession', [])
        return { data: { session: session ? { user: session.user } : null } }
      },
    },
    storage: {
      from: (bucket: string) => {
        record('storage', 'from', [bucket])
        return {
          upload: async (...args: any[]) => {
            record(bucket, 'upload', args)
            return storageConfig.upload
          },
          remove: async (...args: any[]) => {
            record(bucket, 'remove', args)
            return storageConfig.remove
          },
          createSignedUrl: async (...args: any[]) => {
            record(bucket, 'createSignedUrl', args)
            return storageConfig.createSignedUrl
          },
        }
      },
    },
  }

  return {
    client,
    calls,
    queue(table: string, ...results: SupabaseResult[]) {
      queues.set(table, [...results])
    },
    setStorage(next: Partial<ReturnType<typeof defaultStorage>>) {
      storageConfig = { ...storageConfig, ...next }
    },
    setSession(next: { user: { id: string } } | null) {
      session = next
    },
    reset() {
      calls.length = 0
      queues.clear()
      storageConfig = defaultStorage()
      session = null
    },
  }
}

export const supabaseMock = createSupabaseMock()
export const client = supabaseMock.client
