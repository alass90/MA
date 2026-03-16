'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, Globe, Shield, Sparkles } from 'lucide-react';

export const OrchestrationLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-background/50 backdrop-blur-md rounded-xl border border-border/50 p-8 text-center space-y-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative bg-background border border-border p-5 rounded-2xl shadow-2xl">
          <Globe className="w-10 h-10 text-primary animate-pulse" />
        </div>
        
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute -top-2 -right-2 bg-background border border-border p-1.5 rounded-full shadow-lg"
        >
          <Sparkles className="w-4 h-4 text-yellow-500" />
        </motion.div>
      </motion.div>

      <div className="space-y-2 relative">
        <h3 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          Orchestrating Workspace
        </h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Provisioning secure sandbox and initializing development environment...
        </p>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 bg-secondary/50 rounded-full border border-border/50 relative">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-xs font-medium text-secondary-foreground uppercase tracking-widest">
          Setting up runtime
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full max-w-[300px] mt-4 relative">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-3 py-1.5 bg-background/50 rounded-lg border border-border/30">
          <Shield className="w-3 h-3" />
          <span>Isolated Linux Kernel</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-3 py-1.5 bg-background/50 rounded-lg border border-border/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Ports mapping...</span>
        </div>
      </div>
    </div>
  );
};
