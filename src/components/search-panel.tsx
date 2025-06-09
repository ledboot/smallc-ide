"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { SearchIcon, ReplaceIcon, FileIcon } from "lucide-react"
import type { FileType } from "@/lib/types"

interface SearchPanelProps {
  files: FileType[]
  onFileSelect: (file: FileType) => void
}

interface SearchResult {
  file: FileType
  line: number
  column: number
  text: string
  match: string
}

export default function SearchPanel({ files, onFileSelect }: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [replaceQuery, setReplaceQuery] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setSearchResults([])

    // Simulate search delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const results: SearchResult[] = []

    files.forEach((file) => {
      const lines = file.content.split("\n")
      lines.forEach((line, lineIndex) => {
        let searchPattern = searchQuery
        let flags = "g"

        if (!caseSensitive) flags += "i"

        if (!useRegex) {
          searchPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        }

        if (wholeWord) {
          searchPattern = `\\b${searchPattern}\\b`
        }

        try {
          const regex = new RegExp(searchPattern, flags)
          let match

          while ((match = regex.exec(line)) !== null) {
            results.push({
              file,
              line: lineIndex + 1,
              column: match.index + 1,
              text: line.trim(),
              match: match[0],
            })

            if (!regex.global) break
          }
        } catch (e) {
          // Invalid regex, skip
          console.error(e)
        }
      })
    })

    setSearchResults(results)
    setIsSearching(false)
  }

  const handleResultClick = (result: SearchResult) => {
    onFileSelect(result.file)
    // In a real implementation, you would also scroll to the specific line
  }

  return (
    <div className="flex h-full flex-col p-4 space-y-4">
      <div className="flex items-center gap-2">
        <SearchIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Search</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Find and Replace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                placeholder="Search in files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch()
                }}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                <SearchIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="replace">Replace</Label>
            <div className="flex gap-2">
              <Input
                id="replace"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
              />
              <Button variant="outline" disabled>
                <ReplaceIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="caseSensitive"
                checked={caseSensitive}
                onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
              />
              <Label htmlFor="caseSensitive" className="text-sm">
                Match Case
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="wholeWord"
                checked={wholeWord}
                onCheckedChange={(checked) => setWholeWord(checked as boolean)}
              />
              <Label htmlFor="wholeWord" className="text-sm">
                Whole Word
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useRegex"
                checked={useRegex}
                onCheckedChange={(checked) => setUseRegex(checked as boolean)}
              />
              <Label htmlFor="useRegex" className="text-sm">
                Use Regular Expression
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Search Results
              <Badge variant="secondary" className="ml-2">
                {searchResults.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-96 overflow-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="cursor-pointer rounded-md border p-2 text-sm hover:bg-muted"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileIcon className="h-3 w-3" />
                    <span className="font-medium">{result.file.name}</span>
                    <span className="text-muted-foreground">
                      {result.line}:{result.column}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground pl-5">{result.text}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isSearching && <div className="text-center text-sm text-muted-foreground">Searching...</div>}
    </div>
  )
}
