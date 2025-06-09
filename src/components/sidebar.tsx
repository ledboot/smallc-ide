"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FolderIcon, RocketIcon, BugIcon, SettingsIcon, SearchIcon, GitBranchIcon,PlayIcon } from "lucide-react"

export type SidebarTab = "files" | "search" | "git" | "compile" | "deploy" | "debug" | "settings"

interface SidebarProps {
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
}

const sidebarItems = [
  { id: "files" as SidebarTab, icon: FolderIcon, label: "File Explorer", shortcut: "Ctrl+Shift+E" },
  { id: "search" as SidebarTab, icon: SearchIcon, label: "Search", shortcut: "Ctrl+Shift+F" },
  { id: "git" as SidebarTab, icon: GitBranchIcon, label: "Source Control", shortcut: "Ctrl+Shift+G" },
  { id: "compile" as SidebarTab, icon: PlayIcon, label: "Compiler", shortcut: "Ctrl+Shift+C" },
  { id: "deploy" as SidebarTab, icon: RocketIcon, label: "Deploy & Run", shortcut: "Ctrl+Shift+D" },
  { id: "debug" as SidebarTab, icon: BugIcon, label: "Debug", shortcut: "Ctrl+Shift+Y" },
  { id: "settings" as SidebarTab, icon: SettingsIcon, label: "Settings", shortcut: "Ctrl+," },
]

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <TooltipProvider>
      <div className="flex h-full w-12 flex-col border-r bg-muted/40">
        <div className="flex flex-1 flex-col items-center py-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="icon"
                    className={`mb-1 h-10 w-10 ${
                      isActive
                        ? "bg-accent text-accent-foreground border-l-2 border-primary rounded-l-none"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => onTabChange(item.id)}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.shortcut}</span>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
