"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { SettingsIcon, PaletteIcon, CodeIcon, SaveIcon } from "lucide-react"

export default function SettingsPanel() {
  const [theme, setTheme] = useState("dark")
  const [fontSize, setFontSize] = useState("14")
  const [tabSize, setTabSize] = useState("2")
  const [wordWrap, setWordWrap] = useState(true)
  const [minimap, setMinimap] = useState(false)
  const [autoSave, setAutoSave] = useState(true)
  const [autoSaveDelay, setAutoSaveDelay] = useState("1000")

  const handleSaveSettings = () => {
    // In a real implementation, save to localStorage or backend
    console.log("Settings saved")
  }

  return (
    <div className="flex h-full flex-col p-4 space-y-4">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Settings</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <PaletteIcon className="h-4 w-4" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CodeIcon className="h-4 w-4" />
            Editor
          </CardTitle>
          <CardDescription>Configure editor behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fontSize">Font Size</Label>
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12px</SelectItem>
                  <SelectItem value="14">14px</SelectItem>
                  <SelectItem value="16">16px</SelectItem>
                  <SelectItem value="18">18px</SelectItem>
                  <SelectItem value="20">20px</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tabSize">Tab Size</Label>
              <Select value={tabSize} onValueChange={setTabSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="8">8 spaces</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Word Wrap</Label>
                <div className="text-sm text-muted-foreground">Wrap long lines</div>
              </div>
              <Switch checked={wordWrap} onCheckedChange={setWordWrap} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Minimap</Label>
                <div className="text-sm text-muted-foreground">Show code minimap</div>
              </div>
              <Switch checked={minimap} onCheckedChange={setMinimap} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <SaveIcon className="h-4 w-4" />
            Auto Save
          </CardTitle>
          <CardDescription>Configure automatic file saving</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto Save</Label>
              <div className="text-sm text-muted-foreground">Automatically save files after changes</div>
            </div>
            <Switch checked={autoSave} onCheckedChange={setAutoSave} />
          </div>

          {autoSave && (
            <div className="space-y-2">
              <Label htmlFor="autoSaveDelay">Auto Save Delay (ms)</Label>
              <Input
                id="autoSaveDelay"
                value={autoSaveDelay}
                onChange={(e) => setAutoSaveDelay(e.target.value)}
                placeholder="1000"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSaveSettings} className="w-full">
        <SaveIcon className="mr-2 h-4 w-4" />
        Save Settings
      </Button>
    </div>
  )
}
