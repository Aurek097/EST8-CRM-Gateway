import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { digits, logEntry, type LeadType } from "@/lib/leads";
import { useLeadActions, useLeads } from "@/lib/use-leads";

export function AddLeadDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const empty = { first_name: "", last_name: "", phone: "", email: "", city: "", state: "" };
  const [f, setF] = useState(empty);
  const [type, setType] = useState<LeadType>("mp");
  const { insertMany } = useLeadActions();
  const { data: leads = [] } = useLeads();

  const save = async () => {
    if (!f.first_name && !f.last_name && !digits(f.phone)) {
      toast.error("Add a name or phone");
      return;
    }
    const pd = digits(f.phone) || null;
    if (pd && leads.some((l) => l.phone_digits === pd)) {
      toast.error("A lead with that phone already exists");
      return;
    }
    const now = new Date();
    try {
      await insertMany([
        {
          ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null])),
          phone_digits: pd,
          lead_type: type,
          status: "new",
          lead_date: now.toISOString(),
          stage_at: { new: now.toISOString() },
          log: [logEntry("Note", "Added by hand", now)] as never,
        },
      ]);
      toast.success("Lead added");
      setF(empty);
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error("Couldn't add lead");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          {(["mp", "fe"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={type === t ? "default" : "outline"}
              onClick={() => setType(t)}
            >
              {t === "mp" ? "Mortgage protection" : "Final expense"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["first_name", "First name"],
              ["last_name", "Last name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["city", "City"],
              ["state", "State"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`add-${k}`}>{l}</Label>
              <Input
                id={`add-${k}`}
                value={f[k]}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className={k === "phone" ? "font-mono" : undefined}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ember" onClick={save}>
            Add lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
