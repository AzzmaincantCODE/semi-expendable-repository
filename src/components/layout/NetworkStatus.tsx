import { useState, useEffect } from 'react';
import { Wifi, WifiOff, WifiHigh, WifiLow } from 'lucide-react';

export const NetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [latency, setLatency] = useState<number | null>(null);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => {
            setIsOnline(false);
            setLatency(null);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        let interval: NodeJS.Timeout;

        const measureLatency = async () => {
            if (!navigator.onLine) return;

            // Use browser's native connection API if available (Chrome/Edge/Android)
            const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
            if (connection && typeof connection.rtt === 'number') {
                setLatency(connection.rtt);
                
                // Also listen for changes to the connection natively
                const handleConnectionChange = () => setLatency(connection.rtt);
                connection.addEventListener('change', handleConnectionChange);
                return () => connection.removeEventListener('change', handleConnectionChange);
            }

            // Fallback for Safari/Firefox: Simple ping to measure latency
            const ping = async () => {
                if (!navigator.onLine) return;
                try {
                    const start = performance.now();
                    // Fetch a small, commonly-present asset to gauge network speed.
                    // Use a dedicated lightweight ping file served from `public/` and make it base-aware.
                    const pingUrl = `${import.meta.env.BASE_URL}ping?${new Date().getTime()}`;
                    const res = await fetch(pingUrl, { method: 'HEAD', cache: 'no-store' });
                    if (res && res.ok) {
                        setLatency(Math.round(performance.now() - start));
                    }
                } catch (e) {
                    // Ignore errors, we might be offline or the origin blocks HEAD requests
                }
            };

            ping();
            interval = setInterval(ping, 10000); // Poll every 10s if native API is missing
            return () => clearInterval(interval);
        };

        let cleanup: any;
        measureLatency().then(cleanFn => { cleanup = cleanFn; });

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (cleanup && typeof cleanup === 'function') cleanup();
            if (interval) clearInterval(interval);
        };
    }, []);

    const getStatusInfo = () => {
        if (!isOnline) return { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-400/20', text: 'Offline' };
        if (latency === null) return { icon: Wifi, color: 'text-slate-300', bg: 'transparent', text: 'Calculating...' };
        
        // RTT is round trip time in ms
        if (latency <= 150) return { icon: WifiHigh, color: 'text-green-400', bg: 'bg-green-400/20', text: 'Strong' };
        if (latency <= 500) return { icon: Wifi, color: 'text-yellow-400', bg: 'bg-yellow-400/20', text: 'Moderate' };
        return { icon: WifiLow, color: 'text-orange-400', bg: 'bg-orange-400/20', text: 'Weak' };
    };

    const { icon: Icon, color, bg, text } = getStatusInfo();

    return (
        <div 
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-white/10 ${bg} transition-colors cursor-help`}
            title={latency !== null ? `Status: ${text} (${latency}ms latency)` : `Status: ${text}`}
        >
            <Icon className={`w-3.5 h-3.5 ${color}`} />
            <span className={`text-xs font-medium ${color} hidden md:inline-block`}>
                {text}
            </span>
        </div>
    );
};
