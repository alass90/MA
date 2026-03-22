import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Circle } from 'lucide-react';
import { getToolIcon, getUserFriendlyToolName } from './utils';
import { cn } from '@/lib/utils';

export interface ActivityStep {
    id: string;
    type: 'default' | 'thinking';
    name: string;
    parameter?: string;
    extra?: string;
    content?: React.ReactNode;
    isStreaming?: boolean;
    iconName?: string;
    messageId?: string;
    toolName?: string;
}

interface ActivityLogProps {
    steps: ActivityStep[];
    className?: string;
    onToolLogClick?: (messageId: string | null, toolName: string) => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ steps, className, onToolLogClick }) => {
    if (!steps || steps.length === 0) return null;

    return (
        <div className={cn(
            "activity-log-container mt-3 mb-4 border-[0.5px] border-[#e2e1de] dark:border-zinc-800 rounded-[12px] overflow-hidden bg-white dark:bg-zinc-950/50 divide-y divide-[#e2e1de] dark:divide-zinc-800 divide-[0.5px]", 
            className
        )}>
            {steps.map((step, index) => (
                <ActivityItem 
                    key={step.id || index} 
                    step={step} 
                    isLast={index === steps.length - 1}
                    isFirst={index === 0}
                    onToolLogClick={onToolLogClick}
                />
            ))}
        </div>
    );
};

const ActivityItem: React.FC<{ 
    step: ActivityStep, 
    isLast: boolean, 
    isFirst: boolean,
    onToolLogClick?: (messageId: string | null, toolName: string) => void 
}> = ({ step, isLast, isFirst, onToolLogClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const IconComponent = step.iconName ? getToolIcon(step.iconName) : (step.type === 'thinking' ? Circle : null);
    
    // Determine tool name
    const displayName = step.iconName ? getUserFriendlyToolName(step.iconName) : step.name;
    const hasContent = !!step.content;

    return (
        <div className={cn("block-item group relative pl-10 transition-all duration-300", 
            step.type === 'thinking' ? "thinking-container" : "default")}>
            
            {/* The vertical connector line */}
            <div className={cn(
                "absolute left-[19.5px] w-[1px] border-l border-dashed border-zinc-200 dark:border-zinc-800 z-0",
                isFirst ? "top-[16px]" : "top-0",
                isLast ? "bottom-[calc(100%-16px)]" : "bottom-0",
                step.isStreaming && "border-blue-400 dark:border-blue-600"
            )} />

            <div className="toolcall-container flex flex-col py-2 pr-2">
                {/* Header (Title Container) */}
                <div 
                    onClick={() => {
                        // Priority 1: Open side panel if callback and names are present
                        if (onToolLogClick && (step.messageId || step.id) && step.toolName) {
                            onToolLogClick(step.messageId || null, step.toolName);
                        }
                        // Priority 2: Toggle inline expansion if content exists
                        if (hasContent) {
                            setIsExpanded(!isExpanded);
                        }
                    }}
                    className={cn(
                        "toolcall-title-container flex items-center justify-between py-1 px-2 rounded-lg cursor-pointer transition-colors transition-all duration-200",
                        "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Status Icon / Node */}
                        <div className="toolcall-title-name absolute left-10 flex items-center justify-center w-[20px] h-[20px] -translate-x-[30.5px] bg-transparent z-10">
                           {step.type === 'thinking' ? (
                               <div className={cn(
                                   "w-2 h-2 rounded-full transition-all duration-500", 
                                   step.isStreaming ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] scale-110 line" : "bg-zinc-300 dark:bg-zinc-600"
                               )} />
                           ) : (
                               <div className="flex items-center justify-center w-5 h-5 bg-white dark:bg-zinc-950 rounded-full border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                   {IconComponent && <IconComponent className="h-3 w-3 text-zinc-500" />}
                               </div>
                           )}
                        </div>

                        {/* Name & Parameter */}
                        <div className="flex items-center gap-2 truncate">
                            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                                {displayName}
                            </span>
                            {step.parameter && (
                                <span className={cn(
                                    "toolcall-title-container-content text-[13px] truncate max-w-[280px]",
                                    step.isStreaming ? "text-blue-500/80" : "text-zinc-400 dark:text-zinc-500"
                                )}>
                                    {step.parameter}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Extra Info & Arrow */}
                    <div className="toolcall-title-container-extra flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {step.extra && (
                            <span className="text-[12px] text-zinc-400 dark:text-zinc-500 font-normal">
                                {step.extra}
                            </span>
                        )}
                        <ChevronRight className={cn(
                            "h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700 transition-transform duration-200",
                            isExpanded ? "rotate-90 text-zinc-500" : ""
                        )} />
                    </div>
                </div>

                {/* Expandable Content */}
                <AnimatePresence initial={false}>
                    {isExpanded && hasContent && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="toolcall-content overflow-hidden"
                        >
                            <div className="pt-1 pb-3 px-2 ml-1">
                                {step.content}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

