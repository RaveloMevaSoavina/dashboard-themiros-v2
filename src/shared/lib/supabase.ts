import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl) {
  throw new Error("Missing VITE_SUPABASE_URL")
}

if (!supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_PUBLISHABLE_KEY")
}

/**
 * Garde-fou : la cle `service_role` contourne les RLS. Embarquee dans le
 * bundle, elle donnerait a n'importe quel visiteur un acces total a la base.
 * Seule la cle `anon` a sa place cote navigateur.
 */
function assertNotServiceRoleKey(key: string) {
  try {
    const [, payload] = key.split(".")

    if (!payload) {
      return
    }

    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { role?: string }

    if (decoded.role === "service_role") {
      throw new Error(
        "VITE_SUPABASE_PUBLISHABLE_KEY contient une cle service_role. " +
          "Cette cle contourne les RLS et ne doit jamais etre exposee au " +
          "navigateur : utilisez la cle anon."
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("service_role")) {
      throw error
    }
    // Cle non decodable (format inattendu) : on laisse Supabase la rejeter.
  }
}

assertNotServiceRoleKey(supabaseAnonKey)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storageKey: "themiros-auth",
  },
})
