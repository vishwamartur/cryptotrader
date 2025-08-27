import React, { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { twapExecution, vwapExecution, povExecution, icebergOrders } from "../lib/quant-execution"

const STRATEGIES = [
  { value: "twap", label: "TWAP" },
  { value: "vwap", label: "VWAP" },
  { value: "pov", label: "POV" },
  { value: "iceberg", label: "Iceberg" },
]

export function ExecutionStrategyPanel({ marketData }: { marketData: any[] }) {
  const [strategy, setStrategy] = useState("twap")
  const [totalQty, setTotalQty] = useState(1)
  const [intervals, setIntervals] = useState(5)
  const [percent, setPercent] = useState(0.1)
  const [displayQty, setDisplayQty] = useState(0.2)
  const [result, setResult] = useState<number[]>([])

  const handleRun = () => {
    if (strategy === "twap") {
      setResult(twapExecution(totalQty, intervals))
    } else if (strategy === "vwap") {
      setResult(vwapExecution(totalQty, marketData))
    } else if (strategy === "pov") {
      setResult(povExecution(percent, marketData))
    } else if (strategy === "iceberg") {
      setResult(icebergOrders(totalQty, displayQty))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Strategy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <Select value={strategy} onValueChange={setStrategy}>
            <SelectTrigger>
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" value={totalQty} onChange={e => setTotalQty(Number(e.target.value))} placeholder="Total Quantity" />
          {strategy === "twap" && (
            <Input type="number" value={intervals} onChange={e => setIntervals(Number(e.target.value))} placeholder="Intervals" />
          )}
          {strategy === "pov" && (
            <Input type="number" value={percent} onChange={e => setPercent(Number(e.target.value))} placeholder="POV Percent" />
          )}
          {strategy === "iceberg" && (
            <Input type="number" value={displayQty} onChange={e => setDisplayQty(Number(e.target.value))} placeholder="Display Quantity" />
          )}
          <Button onClick={handleRun}>Run Strategy</Button>
          <div className="mt-4">
            <strong>Order Slices:</strong>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
