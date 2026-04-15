import StatusPill from "@/app/components/StatusPill";

export type CountLine = {
  id: string;
  item_name: string;
  item_unit: string;
  item_category: string;
  item_supplier?: string | null;
  supplier?: string | null;
  supplier_name?: string | null;
  distributor?: string | null;
  distributor_name?: string | null;
  item_distributor?: string | null;
  vendor?: string | null;
  vendor_name?: string | null;
  item_vendor?: string | null;
  source?: string | null;
  item_source?: string | null;
  purchased_from?: string | null;
  order_from?: string | null;
  item_threshold: number;
  item_par: number;
  item_sort_order: number;
  trailer_qty: number;
  storage_qty: number;
};

export type ReportItem = CountLine & {
  total: number;
  status: "critical" | "low";
  suggestedOrderQty: number;
};

export function getSupplierLabel(item: ReportItem) {
  return (
    item.item_supplier ||
    item.supplier ||
    item.supplier_name ||
    item.distributor ||
    item.distributor_name ||
    item.item_distributor ||
    item.vendor ||
    item.vendor_name ||
    item.item_vendor ||
    item.source ||
    item.item_source ||
    item.purchased_from ||
    item.order_from ||
    "Other"
  );
}

type ReportItemCardProps = {
  item: ReportItem;
};

export function ReportItemsTableHead() {
  return (
    <thead>
      <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
        <th scope="col" className="py-2.5 pl-3 pr-2">
          Item name
        </th>
        <th scope="col" className="px-2 py-2.5">
          Trailer quantity
        </th>
        <th scope="col" className="px-2 py-2.5">
          Storage quantity
        </th>
        <th scope="col" className="py-2.5 pl-2 pr-3">
          Status
        </th>
      </tr>
    </thead>
  );
}

export default function ReportItemCard({ item }: ReportItemCardProps) {
  return (
    <tr className="border-b border-black/5 last:border-b-0">
      <td className="py-3 pl-3 pr-2 align-middle font-medium text-gray-900">
        {item.item_name}
      </td>
      <td className="px-2 py-3 align-middle tabular-nums text-gray-800">
        {item.trailer_qty}
      </td>
      <td className="px-2 py-3 align-middle tabular-nums text-gray-800">
        {item.storage_qty}
      </td>
      <td className="py-3 pl-2 pr-3 align-middle">
        <StatusPill status={item.status} />
      </td>
    </tr>
  );
}
