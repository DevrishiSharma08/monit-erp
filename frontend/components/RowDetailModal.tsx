"use client";

import { Modal } from "@/components/Modal";

export interface DetailField {
  label: string;
  value: React.ReactNode;
  span?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: DetailField[];
}

export function RowDetailModal({ isOpen, onClose, title, fields }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 pb-2">
        {fields.map((f, i) => (
          <div key={i} className={f.span ? "col-span-2" : ""}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{f.label}</p>
            <div className="text-sm text-gray-900 break-words">
              {f.value !== undefined && f.value !== null && f.value !== "" ? f.value : (
                <span className="text-gray-400 text-xs italic">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
        <button onClick={onClose}
          className="rounded-lg bg-gray-100 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Close
        </button>
      </div>
    </Modal>
  );
}
