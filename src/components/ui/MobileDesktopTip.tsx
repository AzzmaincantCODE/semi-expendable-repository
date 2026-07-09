import { useState, useEffect } from "react";
import { Monitor, X } from "lucide-react";

/**
 * Shows a dismissible tip on mobile devices suggesting desktop mode.
 * Uses both user-agent and screen width to detect mobile.
 * Respects a sessionStorage flag so it only shows once per session.
 */
export const MobileDesktopTip = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Don't show again if already dismissed this session
        if (sessionStorage.getItem("desktop-tip-dismissed")) return;

        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
        const isNarrowScreen = window.innerWidth < 768;

        if (isMobileUA || isNarrowScreen) {
            setVisible(true);
        }
    }, []);

    const dismiss = () => {
        setVisible(false);
        sessionStorage.setItem("desktop-tip-dismissed", "1");
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-500">
            <div className="mx-auto max-w-md rounded-lg border bg-card p-4 shadow-lg flex items-start gap-3">
                <Monitor className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 text-sm">
                    <p className="font-medium text-foreground">Best viewed on Desktop</p>
                    <p className="text-muted-foreground mt-0.5">
                        For the best experience, switch to <strong>Desktop mode</strong> in your browser settings.
                    </p>
                </div>
                <button
                    onClick={dismiss}
                    className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
                    aria-label="Dismiss tip"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>
        </div>
    );
};
