"use client";

import { Modal } from "@heroui/react";
import { useId } from "react";
import { FiX } from "react-icons/fi";

interface RejectionReasonModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activityName: string;
  notes: string;
}

export default function RejectionReasonModal({
  isOpen,
  onOpenChange,
  activityName,
  notes,
}: RejectionReasonModalProps) {
  const headingId = useId();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop className="bg-slate-950/55 backdrop-blur-[2px]">
        <Modal.Container size="sm" scroll="inside" placement="center">
          <Modal.Dialog
            aria-labelledby={headingId}
            className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl sm:max-w-lg"
          >
            <Modal.CloseTrigger
              aria-label="Tutup alasan penolakan"
              className="right-4 top-4 min-h-11 min-w-11 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              <FiX aria-hidden="true" />
            </Modal.CloseTrigger>
            <Modal.Header className="shrink-0 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0 pr-10">
                <Modal.Heading
                  id={headingId}
                  className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  Alasan penolakan
                </Modal.Heading>
                <p className="mt-1 break-words text-sm leading-5 text-slate-600 [overflow-wrap:anywhere]">
                  {activityName}
                </p>
              </div>
            </Modal.Header>
            <Modal.Body
              role="region"
              aria-label="Isi alasan penolakan"
              tabIndex={0}
              className="min-h-0 max-h-[min(65dvh,28rem)] overflow-y-auto overscroll-contain px-6 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
            >
              <p className="whitespace-pre-wrap break-words border-l-2 border-rose-500 pl-4 text-base leading-7 text-slate-800 [overflow-wrap:anywhere]">
                {notes}
              </p>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
