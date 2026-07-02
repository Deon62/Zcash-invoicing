import { CheckCircle2, Clock, FileEdit, Link2, Link2Off } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatus, ReconStatus } from "@/lib/types";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "paid")
    return (
      <Badge variant="success">
        <CheckCircle2 className="size-3" /> Paid
      </Badge>
    );
  if (status === "awaiting_payment")
    return (
      <Badge variant="warning">
        <Clock className="size-3" /> Awaiting payment
      </Badge>
    );
  return (
    <Badge variant="muted">
      <FileEdit className="size-3" /> Draft
    </Badge>
  );
}

export function ReconBadge({ status }: { status: ReconStatus }) {
  if (status === "reconciled")
    return (
      <Badge variant="success">
        <Link2 className="size-3" /> Reconciled
      </Badge>
    );
  return (
    <Badge variant="muted">
      <Link2Off className="size-3" /> Unreconciled
    </Badge>
  );
}
