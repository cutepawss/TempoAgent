import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Providers from '@/components/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });

export const metadata: Metadata = {
    title: "TempoAgent — Trustless AI Workflows",
    description: "Autonomous AI agents with on-chain verification, trust scoring, and adaptive escrow. Built on Tempo.",
    icons: {
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">◬</text></svg>',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${playfair.variable} antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
