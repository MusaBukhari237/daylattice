import { useMemo } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Trash2, Maximize2 } from "lucide-react";
import { TitleCell } from "./cells/TitleCell";
import { PriorityCell } from "./cells/PriorityCell";
import { DueDateCell } from "./cells/DueDateCell";
import { SectionCell } from "./cells/SectionCell";
import { LabelsCell } from "./cells/LabelsCell";
import { useStore } from "@/store/useStore";
import type { Label, Section, Task } from "@/lib/types";

interface Props {
  sections: Section[];
  tasks: Task[];
  labels: Label[];
}

export function TableView({ sections, tasks, labels }: Props) {
  const { openDrawer, removeTask } = useStore();

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        header: "Task",
        accessorKey: "title",
        cell: ({ row }) => <TitleCell task={row.original} />,
        size: 320,
      },
      {
        header: "Status",
        accessorKey: "section_id",
        cell: ({ row }) => <SectionCell task={row.original} sections={sections} />,
      },
      {
        header: "Priority",
        accessorKey: "priority",
        cell: ({ row }) => <PriorityCell task={row.original} />,
      },
      {
        header: "Labels",
        id: "labels",
        cell: ({ row }) => <LabelsCell task={row.original} labels={labels} />,
      },
      {
        header: "Due",
        accessorKey: "due_date",
        cell: ({ row }) => <DueDateCell task={row.original} />,
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => openDrawer(row.original.id)}
              className="rounded-md p-1 text-fg-subtle hover:bg-muted hover:text-fg"
              title="Open"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => removeTask(row.original.id)}
              className="rounded-md p-1 text-fg-subtle hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/40"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
        size: 70,
      },
    ],
    [sections, labels, openDrawer, removeTask],
  );

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="h-full overflow-auto px-5 py-4">
      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-surface-2">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-subtle"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-border last:border-0 hover:bg-surface-2/60"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-fg-subtle"
                >
                  No tasks yet — add one from the toolbar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
