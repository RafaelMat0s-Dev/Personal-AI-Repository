import { create } from 'zustand'

interface UIState {
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'dark',
  sidebarOpen: true,
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: next })
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
