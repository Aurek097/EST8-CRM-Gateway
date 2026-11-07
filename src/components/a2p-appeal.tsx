import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { changeA2p } from "@/lib/a2p.functions";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";

export function A2pAppeal({ status }: { status: string }) {
  const change = useServerFn(changeA2p),
    qc = useQueryClient();
  const [reason, setReason] = useState(""),
    [sample1, setSample1] = useState(""),
    [sample2, setSample2] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [busy, setBusy] = useState(false);
  if (!["TELNYX_FAILED", "MNO_REJECTED"].includes(status)) return null;
  const appeal = async () => {
    setBusy(true);
    try {
      const r = await change({
        data: { action: "appeal", reason, sample1, sample2, authorized: true },
      });
      if (r.ok) {
        toast.success(r.message);
        qc.invalidateQueries({ queryKey: ["a2p-self"] });
      } else toast.error(r.message);
    } catch {
      toast.error(
        "Appeal could not be confirmed. Do not repeat it until its status is reconciled.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4 border-y py-5">
      <h3 className="font-semibold">Correct samples & request review</h3>
      <p className="text-sm text-muted-foreground">
        Telnyx permits sample-message corrections and a manual appeal for this rejection state.
        Check current fees in Review & authorize first.
      </p>
      <Label htmlFor="appeal-reason">What was corrected?</Label>
      <textarea
        id="appeal-reason"
        value={reason}
        maxLength={2000}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        className="w-full rounded-md border bg-background p-3 text-sm"
      />
      <Label htmlFor="appeal-sample1">Corrected sample 1</Label>
      <Input
        id="appeal-sample1"
        value={sample1}
        maxLength={255}
        onChange={(e) => setSample1(e.target.value)}
      />
      <Label htmlFor="appeal-sample2">Corrected sample 2</Label>
      <Input
        id="appeal-sample2"
        value={sample2}
        maxLength={255}
        onChange={(e) => setSample2(e.target.value)}
      />
      <div className="flex items-start gap-3">
        <Checkbox
          id="appeal-consent"
          checked={authorized}
          onCheckedChange={(v) => setAuthorized(v === true)}
        />
        <Label htmlFor="appeal-consent" className="font-normal leading-snug">
          I authorize this appeal and the applicable reviewed charges, if incurred.
        </Label>
      </div>
      <Button
        disabled={busy || !authorized || reason.length < 20 || !sample1 || !sample2}
        onClick={appeal}
      >
        Authorize manual appeal
      </Button>
    </section>
  );
}
