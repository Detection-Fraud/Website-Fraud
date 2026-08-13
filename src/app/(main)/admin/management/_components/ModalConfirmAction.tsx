"use client";

import { Button, Modal } from "@heroui/react";
import { FiAlertTriangle } from "react-icons/fi";

interface ModalConfirmActionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  confirmColor?: string;
  isDanger?: boolean;
}

export default function ModalConfirmAction({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title,
  description,
  confirmText = "Ya, Lanjutkan",
  confirmColor,
  isDanger = false,
}: ModalConfirmActionProps) {
  const isDangerAction = isDanger || confirmColor === "danger";
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="center">
          <Modal.Dialog className="max-w-md w-full rounded-2xl border border-slate-200/60 shadow-xl bg-slate-50 p-6 space-y-4">
            <Modal.CloseTrigger />

            <Modal.Header className="flex flex-row items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${
                isDangerAction ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-amber-50 text-amber-600 border-amber-100"
              }`}>
                <FiAlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-lg leading-snug">
                  {title}
                </p>
              </div>
            </Modal.Header>

            <Modal.Body className="px-0">
              <div className="text-sm text-slate-600 leading-relaxed space-y-1">
                {description}
              </div>

              <div className="flex gap-2.5 pt-6">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl font-semibold border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  onClick={onClose}
                  isDisabled={isLoading}
                >
                  Batal
                </Button>
                <Button
                  className={`flex-1 rounded-xl font-semibold text-white shadow-xs transition-all ${
                    isDangerAction ? "bg-rose-600 hover:bg-rose-700" : "bg-sky-600 hover:bg-sky-700"
                  }`}
                  onClick={onConfirm}
                  isPending={isLoading}
                >
                  {confirmText}
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
