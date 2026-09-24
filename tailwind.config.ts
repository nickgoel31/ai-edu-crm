import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        heading: ["var(--font-heading)", "Plus Jakarta Sans", "var(--font-sans)", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.04em" }],
        xs: ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        sm: ["12px", { lineHeight: "18px", letterSpacing: "-0.005em" }],
        base: ["13px", { lineHeight: "20px", letterSpacing: "-0.01em" }],
        md: ["14px", { lineHeight: "22px", letterSpacing: "-0.015em" }],
        lg: ["16px", { lineHeight: "24px", letterSpacing: "-0.02em" }],
        xl: ["18px", { lineHeight: "26px", letterSpacing: "-0.025em" }],
        "2xl": ["22px", { lineHeight: "28px", letterSpacing: "-0.03em" }],
        "3xl": ["26px", { lineHeight: "32px", letterSpacing: "-0.035em" }],
      },
      colors: {
        // Core Shadcn / CSS Variables (OKLCH supported)
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        // Custom Brand Color Scale
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },

        // 9-Step Calibrated CRM Pure Neutral Dark Scale (Zinc / True Neutral)
        crm: {
          950: "#0A0A0A", // Deepest background (canvas)
          900: "#121212", // Elevated container / card background
          850: "#18181b", // Interactive panel / card body
          800: "#222226", // Elevated row / hover background
          750: "#27272a", // Borders & separators
          700: "#323238", // Subtle borders & dividers
          600: "#52525b", // Dimmed icons & secondary labels
          500: "#71717a", // Placeholder & muted text
          400: "#a1a1aa", // Secondary body text (passes WCAG AA)
          300: "#d4d4d8", // Primary body text
          200: "#e4e4e7", // Bright headers & labels
          100: "#f4f4f5", // Purest high contrast white/zinc
        },

        // Semantic Lead Stage Colors
        stage: {
          cold: {
            DEFAULT: "#06b6d4",
            bg: "rgba(6, 182, 212, 0.12)",
            border: "rgba(6, 182, 212, 0.3)",
            text: "#22d3ee",
          },
          warm: {
            DEFAULT: "#f59e0b",
            bg: "rgba(245, 158, 11, 0.12)",
            border: "rgba(245, 158, 11, 0.3)",
            text: "#fbbf24",
          },
          hot: {
            DEFAULT: "#f43f5e",
            bg: "rgba(244, 63, 94, 0.12)",
            border: "rgba(244, 63, 94, 0.3)",
            text: "#fb7185",
          },
          converting: {
            DEFAULT: "#8b5cf6",
            bg: "rgba(139, 92, 246, 0.12)",
            border: "rgba(139, 92, 246, 0.3)",
            text: "#a78bfa",
          },
          lost: {
            DEFAULT: "#71717a",
            bg: "rgba(113, 113, 122, 0.12)",
            border: "rgba(113, 113, 122, 0.25)",
            text: "#a1a1aa",
          },
        },

        // Semantic Status States
        status: {
          paid: {
            DEFAULT: "#10b981",
            bg: "rgba(16, 185, 129, 0.12)",
            border: "rgba(16, 185, 129, 0.3)",
            text: "#34d399",
          },
          overdue: {
            DEFAULT: "#f43f5e",
            bg: "rgba(244, 63, 94, 0.12)",
            border: "rgba(244, 63, 94, 0.3)",
            text: "#fb7185",
          },
          verified: {
            DEFAULT: "#14b8a6",
            bg: "rgba(20, 184, 166, 0.12)",
            border: "rgba(20, 184, 166, 0.3)",
            text: "#2dd4bf",
          },
          pending: {
            DEFAULT: "#f59e0b",
            bg: "rgba(245, 158, 11, 0.12)",
            border: "rgba(245, 158, 11, 0.3)",
            text: "#fbbf24",
          },
        },

        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.35), 0 1px 2px -1px rgba(0, 0, 0, 0.35)",
        panel: "0 4px 16px -2px rgba(0, 0, 0, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.3)",
        lift: "0 10px 30px -4px rgba(0, 0, 0, 0.6), 0 4px 12px -2px rgba(0, 0, 0, 0.4)",
        drag: "0 20px 35px -5px rgba(0, 0, 0, 0.8), 0 10px 15px -5px rgba(0, 0, 0, 0.5)",
        "glow-brand": "0 0 20px -3px rgba(59, 130, 246, 0.35)",
        "glow-emerald": "0 0 20px -3px rgba(16, 185, 129, 0.35)",
        "glow-rose": "0 0 20px -3px rgba(244, 63, 94, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
