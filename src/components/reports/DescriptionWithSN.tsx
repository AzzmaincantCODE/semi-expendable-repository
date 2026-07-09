import React from "react";
import { cleanDescription } from "@/lib/utils";

interface DescriptionWithSNProps {
    description?: string | null;
    serialNumber?: string | null;
    /** Extra className applied to the wrapper element */
    className?: string;
    /** Render as block (div) instead of inline (span). Default: inline */
    block?: boolean;
}

/**
 * Renders a description with an optional serial number.
 * Automatically strips any legacy "SN: …" text already embedded in the
 * description string so the SN never appears twice.
 */
export const DescriptionWithSN: React.FC<DescriptionWithSNProps> = ({
    description,
    serialNumber,
    className,
    block = false,
}) => {
    const Tag = block ? 'div' : 'span';
    const SnTag = block ? 'div' : 'span';
    return (
        <Tag className={className}>
            {cleanDescription(description)}
            {serialNumber && (
                <SnTag className={`font-semibold ${block ? 'mt-0.5' : 'ml-1'}`}>SN: {serialNumber}</SnTag>
            )}
        </Tag>
    );
};
