"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Loader2, User, Calendar, Phone, Mail } from "lucide-react"
import { searchPatients, type PatientSearchResult } from "@/lib/api/patient-search"
import { useNavigation } from "@/contexts/navigation-context"
import { formatDate } from "@/lib/utils/date-formatter"

export function PatientSearchPage() {
  const { openPatient } = useNavigation()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [externalId, setExternalId] = useState("")

  const [results, setResults] = useState<PatientSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!firstName && !lastName && !dateOfBirth && !externalId) {
      setError("Please enter at least one search criteria")
      return
    }

    setIsLoading(true)
    setError(null)
    setHasSearched(true)

    const result = await searchPatients({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      dateOfBirth: dateOfBirth || undefined,
      externalId: externalId || undefined,
      limit: 50,
    })

    setIsLoading(false)

    if (result.success && result.data) {
      setResults(result.data.patients)
      setTotal(result.data.total)
    } else {
      setError(result.error || "Search failed")
      setResults([])
      setTotal(0)
    }
  }, [firstName, lastName, dateOfBirth, externalId])

  const handleClear = () => {
    setFirstName("")
    setLastName("")
    setDateOfBirth("")
    setExternalId("")
    setResults([])
    setTotal(0)
    setError(null)
    setHasSearched(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const handleRowClick = (patient: PatientSearchResult) => {
    openPatient(patient.id.toString())
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Search Form */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Patient Search
            </CardTitle>
            <CardDescription>Search for patients by name, date of birth, or external ID</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="externalId">External ID</Label>
                <Input
                  id="externalId"
                  placeholder="MRN, Member ID, etc."
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
            </div>

            {error && <p className="text-destructive text-sm mt-4">{error}</p>}
          </CardContent>
        </Card>

        {/* Results */}
        {hasSearched && (
          <Card className="bg-card">
            <CardHeader>
              <CardTitle>
                Results {total > 0 && <span className="text-muted-foreground font-normal">({total} found)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {isLoading ? "Searching..." : "No patients found matching your criteria"}
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Date of Birth</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead>Contact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((patient) => (
                        <TableRow
                          key={patient.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRowClick(patient)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {patient.lastName}, {patient.firstName}
                                  {patient.middleName && ` ${patient.middleName}`}
                                </div>
                                <div className="text-xs text-muted-foreground">ID: {patient.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {patient.dateOfBirth ? formatDate(patient.dateOfBirth) : "—"}
                            </div>
                          </TableCell>
                          <TableCell>{patient.gender || "—"}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {patient.phone && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {patient.phone}
                                </div>
                              )}
                              {patient.email && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {patient.email}
                                </div>
                              )}
                              {!patient.phone && !patient.email && "—"}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
