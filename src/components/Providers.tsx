'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tempoTestnet } from '@/lib/tempo';

// --- App-wide context ---
interface AppContextType {
    isDemoMode: boolean;
}

const AppContext = createContext<AppContextType>({ isDemoMode: true });
export const useAppContext = () => useContext(AppContext);

// --- React Query ---
const queryClient = new QueryClient();

// --- Main Provider ---
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function Providers({ children }: { children: ReactNode }) {
    if (!PRIVY_APP_ID) {
        return (
            <AppContext.Provider value={{ isDemoMode: true }}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </AppContext.Provider>
        );
    }

    return (
        <AppContext.Provider value={{ isDemoMode: false }}>
            <QueryClientProvider client={queryClient}>
                <PrivyProvider
                    appId={PRIVY_APP_ID}
                    config={{
                        appearance: {
                            theme: 'dark',
                            accentColor: '#3B82F6',
                        },
                        embeddedWallets: {
                            ethereum: {
                                createOnLogin: 'all-users',
                            },
                        },
                        supportedChains: [tempoTestnet],
                        defaultChain: tempoTestnet,
                    }}
                >
                    {children}
                </PrivyProvider>
            </QueryClientProvider>
        </AppContext.Provider>
    );
}
