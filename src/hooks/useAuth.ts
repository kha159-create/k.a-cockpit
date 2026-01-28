// Re-export hook from context

// import { AuthCtx } from '@/context/AuthContext'; // We can't import Context if it's not exported. 
// Actually, AuthContext.tsx exports useAuth already. 
// But existing code imports useAuth from '@/hooks/useAuth'.
// So we should re-export getting it from Context, OR move the context hook here.

// Better approach: Re-export the hook from AuthContext, 
// OR simpler: Redirect this file to import from context.
// But AuthContext.tsx defines useAuth... let's just make this file re-export it or wrap it.

// Wait, AuthContext is in src/context/AuthContext.tsx.
// I will just make THIS file (hooks/useAuth.ts) be the source of truth if possible, 
// OR just make it delegate.

// Problem: AuthContext.tsx imports User from types.ts. types.ts is fine.
// AuthContext.tsx exports useAuth.
// So hooks/useAuth.ts can just be:
export { useAuth } from '../context/AuthContext';
export type { AuthState } from '../context/AuthContext'; // If exported