import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type Theme = "dark" | "light"

const themeStorageKey = "themiros-theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function storedTheme(): Theme {
  return localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(storedTheme)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    document.documentElement.classList.toggle("light", theme === "light")
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
