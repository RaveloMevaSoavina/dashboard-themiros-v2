import type { Session } from "@supabase/supabase-js"

import { supabase } from "@/shared/lib/supabase"

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data.session satisfies Session | null
}

export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    throw new Error("Email is required.")
  }

  if (!password) {
    throw new Error("Password is required.")
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    throw error
  }

  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}
